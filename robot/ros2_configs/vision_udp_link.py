"""Bring YOLO results from the Pi into ROS. Imports no ROS package.

The Pi and WSL do not share a ROS graph, so this asks the Pi for results over UDP. The Pi
replies to the sender's address, which also works through the WSL NAT.
"""
import json
import socket
import threading
import time

VISION_PORT = 9997
SUBSCRIBE_MESSAGE = b'vision_subscribe'
SUBSCRIBE_PERIOD_SEC = 1.0
RETRY_SEC = 1.0
MAX_PACKET_BYTES = 8192


def vision_message(data):
    """The JSON text to publish, or None when the packet is not a detection result."""
    try:
        payload = json.loads(data.decode('utf-8'))
    except (UnicodeDecodeError, ValueError):
        return None
    if not isinstance(payload, dict) or payload.pop('type', None) != 'person_detections':
        return None
    return json.dumps(payload, ensure_ascii=False)


class VisionUdpLink:
    def __init__(self, pi_ip, publish, is_running, port=VISION_PORT):
        self.pi_ip, self.publish, self.is_running, self.port = pi_ip, publish, is_running, port

    def start(self):
        thread = threading.Thread(target=self.run, daemon=True)
        thread.start()
        return thread

    def run(self):
        while self.is_running():
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                    # A connected socket only receives packets from the Pi.
                    sock.connect((self.pi_ip, self.port))
                    sock.settimeout(0.25)
                    self._serve(sock)
            except OSError:  # Pi offline or vision service not started yet
                time.sleep(RETRY_SEC)

    def _serve(self, sock):
        next_subscribe = 0.0
        while self.is_running():
            now = time.monotonic()
            if now >= next_subscribe:
                next_subscribe = now + SUBSCRIBE_PERIOD_SEC
                sock.send(SUBSCRIBE_MESSAGE)
            try:
                data = sock.recv(MAX_PACKET_BYTES)
            except socket.timeout:
                continue
            message = vision_message(data)
            if message is not None:
                self.publish(message)
