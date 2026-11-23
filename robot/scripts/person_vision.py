#!/usr/bin/env python3
"""YOLO person detection for the route-stop check. Runs on the Pi without ROS.

Frames come from the stream main.py already serves, so the USB camera keeps one owner.
The laptop bridge subscribes over UDP; YOLO only runs while a subscriber is alive.
A dead camera or model is reported as FAILED so the workflow falls back to LiDAR only.
"""
import argparse
import importlib.util
import json
import logging
from pathlib import Path
import socket
import threading
import time
import urllib.request

ROBOT_DIR = Path(__file__).resolve().parents[1]
DETECTION_MODULE = ROBOT_DIR / 'src/hc_robot_client/hc_robot_client/nodes/person_detection_node.py'
CAMERA_URL = 'http://127.0.0.1:8554'
VISION_PORT = 9997
SUBSCRIBE_MESSAGE = b'vision_subscribe'
SUBSCRIBER_TTL_SEC = 5.0
MAX_SUBSCRIBERS = 4
MAX_PERSONS = 10
MAX_JPEG_BYTES = 4_000_000
MAX_FRAME_AGE_SEC = 1.0
HEALTH_PERIOD_SEC = 1.0
INFERENCE_PERIOD_SEC = 0.2  # 5 Hz leaves CPU for the safety loop and LiDAR
FAILED_PERIOD_SEC = 0.5
IDLE_SLEEP_SEC = 0.2
DEGRADED_MS = 200.0

logger = logging.getLogger('person-vision')


def read_jpeg_part(stream):
    """Read one JPEG from a multipart MJPEG stream."""
    length = None
    while True:
        line = stream.readline(256)
        if not line:
            raise EOFError('camera stream closed')
        text = line.strip().lower()
        if text.startswith(b'content-length:'):
            length = int(text.split(b':', 1)[1])
        elif not text and length is not None:
            break
    if not 0 < length <= MAX_JPEG_BYTES:
        raise ValueError(f'invalid JPEG size {length}')
    data = stream.read(length)
    if len(data) != length:
        raise EOFError('camera stream ended inside a frame')
    return data


def camera_frame_is_fresh(health, max_age=MAX_FRAME_AGE_SEC):
    """Placeholder frames keep the stream alive, so only the sensor's frame age counts."""
    age = health.get('frame_age_s') if isinstance(health, dict) else None
    return isinstance(age, (int, float)) and not isinstance(age, bool) and 0 <= age <= max_age


def detection_payload(detections, frame_width, hfov_deg, bearing_of, latency_ms, now):
    ranked = sorted(detections, key=lambda item: item['confidence'], reverse=True)[:MAX_PERSONS]
    persons = []
    for detection in ranked:
        bearing, sector = bearing_of(detection['bbox'], frame_width, hfov_deg)
        persons.append({**detection, 'bearing_deg': bearing, 'fov_sector_deg': sector})
    return {'type': 'person_detections', 'timestamp': now, 'mode': 'DEGRADED' if latency_ms > DEGRADED_MS else 'YOLO',
            'count': len(persons), 'persons': persons, 'latency_ms': round(latency_ms, 1)}


def failed_payload(reason, now):
    return {'type': 'person_detections', 'timestamp': now, 'mode': 'FAILED', 'count': 0, 'persons': [],
            'error_message': reason}


class Subscribers:
    def __init__(self, ttl=SUBSCRIBER_TTL_SEC, limit=MAX_SUBSCRIBERS):
        self.ttl, self.limit, self.seen = ttl, limit, {}

    def add(self, address, now):
        self.active(now)
        if address in self.seen or len(self.seen) < self.limit:
            self.seen[address] = now

    def active(self, now):
        self.seen = {address: at for address, at in self.seen.items() if now - at <= self.ttl}
        return list(self.seen)


class LatestFrame:
    """Keeps only the newest JPEG, so slow inference never works on a backlog."""

    def __init__(self, url):
        self.url = url
        self.enabled = threading.Event()
        self.lock = threading.Lock()
        self.jpeg = None
        self.at = 0.0

    def run(self):
        while True:
            self.enabled.wait()
            try:
                with urllib.request.urlopen(f'{self.url}/stream', timeout=5) as stream:
                    while self.enabled.is_set():
                        jpeg = read_jpeg_part(stream)
                        with self.lock:
                            self.jpeg, self.at = jpeg, time.monotonic()
            except (OSError, EOFError, ValueError) as exc:
                logger.debug('Camera stream read failed: %s', exc)
                time.sleep(1)

    def take(self, now):
        with self.lock:
            jpeg, at = self.jpeg, self.at
            self.jpeg = None
        return jpeg if jpeg is not None and now - at <= MAX_FRAME_AGE_SEC else None


def read_health(url):
    try:
        with urllib.request.urlopen(f'{url}/health', timeout=0.8) as response:
            return json.load(response)
    except (OSError, ValueError):
        return {}


class VisionLoop:
    def __init__(self, sock, reader, detector, bearing_of, decode, health, hfov_deg):
        self.sock, self.reader, self.detector = sock, reader, detector
        self.bearing_of, self.decode, self.health, self.hfov_deg = bearing_of, decode, health, hfov_deg
        self.subscribers = Subscribers()
        self.camera_ok = False
        self.next_health = self.next_failed = 0.0
        self.last_frame_at = 0.0

    def _read_subscribers(self, now):
        while True:
            try:
                data, address = self.sock.recvfrom(64)
            except (BlockingIOError, ConnectionResetError):
                return
            if data.strip() == SUBSCRIBE_MESSAGE:
                self.subscribers.add(address, now)

    def _send(self, targets, payload):
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        for address in targets:
            try:
                self.sock.sendto(data, address)
            except OSError as exc:
                logger.debug('Cannot send vision result: %s', exc)

    def _fail(self, targets, reason, now):
        if now >= self.next_failed:
            self.next_failed = now + FAILED_PERIOD_SEC
            self._send(targets, failed_payload(reason, time.time()))
        return 0.1

    def tick(self, now):
        """Do one step and return how long to sleep."""
        self._read_subscribers(now)
        targets = self.subscribers.active(now)
        if not targets:
            self.reader.enabled.clear()
            return IDLE_SLEEP_SEC
        if not self.reader.enabled.is_set():
            self.reader.enabled.set()
            self.last_frame_at = now
            self.next_health = 0.0
        if not self.detector.is_ready:
            return self._fail(targets, 'YOLO detector not ready', now)
        if now >= self.next_health:
            self.next_health = now + HEALTH_PERIOD_SEC
            self.camera_ok = camera_frame_is_fresh(self.health())
        if not self.camera_ok:
            return self._fail(targets, 'Camera feed lost', now)
        jpeg = self.reader.take(now)
        if jpeg is None:
            if now - self.last_frame_at > MAX_FRAME_AGE_SEC:
                return self._fail(targets, 'No camera frame', now)
            return 0.02
        self.last_frame_at = now
        frame = self.decode(jpeg)
        if frame is None:
            return 0.02
        started = time.monotonic()
        try:
            detections = self.detector.detect(frame)
        except Exception as exc:  # a failed inference must not end the service
            logger.exception('YOLO inference failed')
            return self._fail(targets, f'YOLO inference failed: {exc}', now)
        elapsed = time.monotonic() - started
        self._send(targets, detection_payload(detections, frame.shape[1], self.hfov_deg, self.bearing_of,
                                              elapsed * 1000.0, time.time()))
        return max(0.0, INFERENCE_PERIOD_SEC - elapsed)


def load_detection_module():
    spec = importlib.util.spec_from_file_location('person_detection_node', DETECTION_MODULE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_vision_config():
    import yaml
    path = ROBOT_DIR / 'config/settings.yaml'
    if not path.exists():
        return {}
    with path.open(encoding='utf-8') as stream:
        return (yaml.safe_load(stream) or {}).get('vision') or {}


def decode_jpeg(jpeg):
    import cv2
    import numpy as np
    return cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)


def parse_args():
    parser = argparse.ArgumentParser(description='YOLO person detection for the workflow route-stop check')
    parser.add_argument('--camera-url', default=CAMERA_URL)
    parser.add_argument('--port', type=int, default=VISION_PORT)
    parser.add_argument('--imgsz', type=int, default=320, help='YOLO input size; 320 keeps the Pi responsive')
    return parser.parse_args()


def main():
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    config = load_vision_config()
    model = Path(config.get('model_path', 'yolov8n.pt'))
    model = model if model.is_absolute() else ROBOT_DIR / model
    module = load_detection_module()
    detector = module.PersonDetectorBackend(str(model), float(config.get('confidence_threshold', 0.40)),
                                            imgsz=args.imgsz)
    if detector.load():
        logger.info('YOLO ready: %s (imgsz=%d)', model, args.imgsz)
    else:
        logger.error('Cannot load YOLO from %s; reporting FAILED', model)

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('0.0.0.0', args.port))
    sock.setblocking(False)
    reader = LatestFrame(args.camera_url)
    threading.Thread(target=reader.run, daemon=True).start()
    loop = VisionLoop(sock, reader, detector, module.compute_bearing_and_fov, decode_jpeg,
                      lambda: read_health(args.camera_url), float(config.get('camera_hfov_deg', 70.0)))
    logger.info('Waiting for the laptop bridge on UDP %d', args.port)
    while True:
        time.sleep(loop.tick(time.monotonic()))


if __name__ == '__main__':
    main()
