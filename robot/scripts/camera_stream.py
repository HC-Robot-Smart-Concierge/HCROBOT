#!/usr/bin/env python3
"""
Camera Stream Server (WebRTC + MJPEG) — Raspberry Pi 5.

Chay WebRTC Video Server (P2P zero-latency) va fallback HTTP MJPEG stream.
Ho tro ca Picamera2 (Camera Module CSI) va OpenCV (USB webcam).

Usage tren Pi 5:
    python3 camera_stream.py
    python3 camera_stream.py --port 8554 --fps 15 --width 640 --height 480
"""
import io
import os
import sys
import time
import signal
import logging
import argparse
import fractions
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

# Auto re-exec using robot venv if aiortc is missing in current interpreter
_VENV_PYTHON = os.path.expanduser("~/HCROBOT/robot/.venv/bin/python")
if os.path.exists(_VENV_PYTHON) and sys.executable != _VENV_PYTHON:
    try:
        import aiortc  # noqa: F401
    except ImportError:
        os.execv(_VENV_PYTHON, [_VENV_PYTHON] + sys.argv)

try:
    import asyncio
    import av
    from aiohttp import web
    from aiortc import (
        MediaStreamTrack,
        RTCPeerConnection,
        RTCSessionDescription,
        RTCConfiguration,
        RTCIceServer,
        VideoStreamTrack,
    )
    from aiortc.contrib.media import MediaRelay
    WEBRTC_AVAILABLE = True
except ImportError:
    WEBRTC_AVAILABLE = False

logger = logging.getLogger("pi5-camera")

DEFAULT_PORT = 8554
DEFAULT_FPS = 15
DEFAULT_WIDTH = 640
DEFAULT_HEIGHT = 480


def suppress_c_stderr():
    """Chuyen huong C-level stderr sang /dev/null de an cac thong bao loi libjpeg."""
    if sys.platform != "win32":
        try:
            devnull = os.open(os.devnull, os.O_WRONLY)
            os.dup2(devnull, 2)
            os.close(devnull)
        except Exception:
            pass


def generate_placeholder_raw(text="CAMERA DISCONNECTED / RECONNECTING..."):
    """Tao mot numpy frame BGR thong bao trang thai khi camera dang ket noi lai."""
    try:
        import numpy as np
        import cv2

        img = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.rectangle(img, (10, 10), (630, 470), (40, 40, 40), 2)
        cv2.putText(img, "HC-ROBOT VIDEO FEED", (160, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 200, 255), 2)
        cv2.putText(img, text, (100, 260), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(img, timestamp, (230, 310), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)
        return img
    except Exception:
        import numpy as np
        return np.zeros((480, 640, 3), dtype=np.uint8)


def generate_placeholder_jpeg(text="CAMERA DISCONNECTED / RECONNECTING..."):
    """Tao mot JPEG frame thong bao trang thai khi camera dang ket noi lai."""
    try:
        import cv2
        raw = generate_placeholder_raw(text)
        _, jpeg = cv2.imencode(".jpg", raw, [cv2.IMWRITE_JPEG_QUALITY, 70])
        return jpeg.tobytes()
    except Exception:
        return (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08"
            b"\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \","
            b"#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00"
            b"\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
            b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
        )


class CameraBackend:
    """Abstract camera backend interface."""

    def __init__(self, width, height, fps):
        self.width = width
        self.height = height
        self.fps = fps

    def start(self):
        raise NotImplementedError

    def capture_jpeg(self):
        raise NotImplementedError

    def capture_raw_frame(self):
        raise NotImplementedError

    def stop(self):
        raise NotImplementedError


class Picamera2Backend(CameraBackend):
    """Backend su dung Picamera2 cho Camera Module CSI tren Pi 5."""

    def __init__(self, width, height, fps):
        super().__init__(width, height, fps)
        self._camera = None

    def start(self):
        from picamera2 import Picamera2

        self._camera = Picamera2()
        config = self._camera.create_video_configuration(
            main={"size": (self.width, self.height), "format": "RGB888"}
        )
        self._camera.configure(config)
        self._camera.start()
        logger.info(f"Picamera2 started: {self.width}x{self.height} @ {self.fps}fps")

    def capture_jpeg(self):
        buf = io.BytesIO()
        self._camera.capture_file(buf, format="jpeg")
        return buf.getvalue()

    def capture_raw_frame(self):
        import cv2
        rgb = self._camera.capture_array()
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    def stop(self):
        if self._camera:
            self._camera.stop()
            self._camera.close()
            self._camera = None


def get_v4l2_video_devices():
    """Lay danh sach cac video device index tren Linux."""
    import glob
    import os
    import re

    indices = []
    by_id_paths = glob.glob("/dev/v4l/by-id/*index0*") or glob.glob("/dev/v4l/by-id/*")
    for bp in by_id_paths:
        try:
            target = os.path.realpath(bp)
            m = re.search(r"/dev/video(\d+)$", target)
            if m:
                idx = int(m.group(1))
                if idx not in indices:
                    indices.append(idx)
        except Exception:
            pass

    dev_paths = glob.glob("/dev/video*")
    skip_keywords = ["pispbe", "rpi-hevc", "codec", "unicam-image", "metadata"]

    for p in dev_paths:
        m = re.search(r"/dev/video(\d+)$", p)
        if m:
            idx = int(m.group(1))
            if idx in indices:
                continue
            name_file = f"/sys/class/video4linux/video{idx}/name"
            if os.path.exists(name_file):
                try:
                    with open(name_file, "r") as f:
                        dev_name = f.read().strip().lower()
                    if any(kw in dev_name for kw in skip_keywords):
                        continue
                except Exception:
                    pass
            indices.append(idx)

    return indices


def normalize_video_device(device):
    """Chuyen doi numeric values hoac /dev/videoN sang V4L2 index."""
    import re

    if not isinstance(device, str):
        return device

    value = device.strip()
    if value.isdigit():
        return int(value)

    match = re.fullmatch(r"/dev/video(\d+)", value)
    if match:
        return int(match.group(1))

    return value


class OpenCVBackend(CameraBackend):
    """
    Backend su dung OpenCV (USB webcam hoac V4L2).
    - Worker thread chuyen doc frame khong gay lock luong mang.
    - Hardware Watchdog tu dong khoi phuc camera sau khi dut ket noi hoac sut ap.
    - Dong thoi luu ca raw numpy frame (cho WebRTC) va JPEG bytes (cho MJPEG).
    """

    def __init__(self, width=640, height=480, fps=15, device=None):
        super().__init__(width, height, fps)
        self.device = device
        self._cap = None
        self._cv2 = None
        self._fail_count = 0
        self._last_reconnect_time = 0.0
        self._last_good_jpeg = None
        self._last_raw_frame = None
        self._last_frame_ts = 0.0
        self._lock = threading.Lock()
        self._worker_running = False
        self._worker_thread = None
        self._reconnecting = False

    def start(self):
        with self._lock:
            import cv2

            try:
                cv2.setLogLevel(cv2.LOG_LEVEL_ERROR)
                suppress_c_stderr()
            except Exception:
                pass

            self._cv2 = cv2
            if self.device is not None:
                candidates = [normalize_video_device(self.device)]
            else:
                system_devs = get_v4l2_video_devices()
                candidates = system_devs if system_devs else [1, 0, 2, 4, 10, 14, 16, 18, 20]

            opened = False
            for dev in candidates:
                logger.info(f"Dang thu ket noi USB camera device {dev}...")
                cap = None
                try:
                    cap = cv2.VideoCapture(dev, cv2.CAP_V4L2)
                    if not cap.isOpened():
                        cap.release()
                        cap = cv2.VideoCapture(dev)
                except Exception:
                    cap = cv2.VideoCapture(dev)

                if cap and cap.isOpened():
                    try:
                        fourcc = cv2.VideoWriter_fourcc(*"MJPG")
                        cap.set(cv2.CAP_PROP_FOURCC, fourcc)
                    except Exception:
                        pass

                    cap.set(cv2.CAP_PROP_FPS, self.fps)
                    try:
                        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    except Exception:
                        pass

                    res_candidates = [(self.width, self.height)]
                    if (self.width, self.height) != (640, 480):
                        res_candidates.append((640, 480))
                    if (self.width, self.height) != (1280, 720):
                        res_candidates.append((1280, 720))

                    for try_w, try_h in res_candidates:
                        cap.set(cv2.CAP_PROP_FRAME_WIDTH, try_w)
                        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, try_h)
                        ret, frame = cap.read()
                        if ret and frame is not None:
                            self._cap = cap
                            opened = True
                            actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                            actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                            self._fail_count = 0
                            try:
                                _, jpeg = self._cv2.imencode(
                                    ".jpg", frame, [self._cv2.IMWRITE_JPEG_QUALITY, 65]
                                )
                                self._last_good_jpeg = jpeg.tobytes()
                                self._last_raw_frame = frame
                                self._last_frame_ts = time.time()
                            except Exception:
                                pass
                            logger.info(
                                f"USB Camera ket noi thanh cong tai device {dev}: {actual_w}x{actual_h} @ {self.fps}fps"
                            )
                            break

                    if opened:
                        break
                    else:
                        cap.release()

            if not opened:
                raise RuntimeError(
                    f"Khong the mo USB camera qua OpenCV (da thu {candidates})"
                )

            self._worker_running = True
            self._worker_thread = threading.Thread(target=self._frame_grabber_loop, daemon=True)
            self._worker_thread.start()

    def _frame_grabber_loop(self):
        """Worker thread lien tuc doc frame tu phan cung."""
        while self._worker_running:
            cap = self._cap
            if cap is None or not cap.isOpened():
                time.sleep(0.05)
                continue

            try:
                ret, frame = cap.read()
            except Exception as e:
                logger.debug(f"Exception cap.read: {e}")
                ret = False
                frame = None

            if ret and frame is not None:
                try:
                    _, jpeg = self._cv2.imencode(
                        ".jpg", frame, [self._cv2.IMWRITE_JPEG_QUALITY, 65]
                    )
                    with self._lock:
                        self._last_good_jpeg = jpeg.tobytes()
                        self._last_raw_frame = frame
                        self._last_frame_ts = time.time()
                        self._fail_count = 0
                except Exception:
                    pass
            else:
                with self._lock:
                    self._fail_count += 1
                time.sleep(0.04)

            time.sleep(0.01)

    def _trigger_async_reconnect(self):
        with self._lock:
            if self._reconnecting:
                return
            now = time.time()
            if now - self._last_reconnect_time < 2.0:
                return
            self._reconnecting = True
            self._last_reconnect_time = now

        def _reconnect_task():
            logger.warning("[Camera Watchdog] Camera USB mat tin hieu/stall. Dang tu dong ket noi lai...")
            self.stop()
            time.sleep(0.3)
            try:
                self.start()
                logger.info("[Camera Watchdog] Camera USB da duoc khoi phuc thanh cong!")
            except Exception as e:
                logger.debug(f"Khoi phuc camera chua thanh cong: {e}")
            finally:
                with self._lock:
                    self._reconnecting = False

        threading.Thread(target=_reconnect_task, daemon=True).start()

    def capture_jpeg(self):
        """Non-blocking: Lay JPEG frame moi nhat."""
        now = time.time()
        with self._lock:
            last_ts = self._last_frame_ts
            last_frame = self._last_good_jpeg
            fail_cnt = self._fail_count

        if (now - last_ts > 1.5 and last_ts > 0.0) or fail_cnt >= 15:
            self._trigger_async_reconnect()
            if last_frame:
                return last_frame
            return generate_placeholder_jpeg("RECOVERING CAMERA SENSOR...")

        if last_frame:
            return last_frame

        return generate_placeholder_jpeg("INITIALIZING CAMERA...")

    def capture_raw_frame(self):
        """Non-blocking: Lay raw BGR frame moi nhat cho WebRTC track."""
        now = time.time()
        with self._lock:
            last_ts = self._last_frame_ts
            last_raw = self._last_raw_frame
            fail_cnt = self._fail_count

        if (now - last_ts > 1.5 and last_ts > 0.0) or fail_cnt >= 15:
            self._trigger_async_reconnect()
            if last_raw is not None:
                return last_raw
            return generate_placeholder_raw("RECOVERING CAMERA SENSOR...")

        if last_raw is not None:
            return last_raw

        return generate_placeholder_raw("INITIALIZING CAMERA...")

    def stop(self):
        self._worker_running = False
        with self._lock:
            if self._cap:
                try:
                    self._cap.release()
                except Exception:
                    pass
                self._cap = None


def create_camera_backend(width, height, fps, device=None):
    """Tu dong chon backend phu hop: OpenCV -> Picamera2."""
    try:
        backend = OpenCVBackend(width, height, fps, device=device)
        backend.start()
        logger.info("Dang su dung OpenCV V4L2 backend cho USB Camera.")
        return backend
    except (ImportError, RuntimeError) as e:
        logger.info(f"OpenCV USB backend khong kha dung ({e}), thu Picamera2 (CSI)...")

    try:
        backend = Picamera2Backend(width, height, fps)
        backend.start()
        logger.info("Dang su dung Picamera2 backend cho CSI Camera Module.")
        return backend
    except (ImportError, RuntimeError) as e:
        logger.error(f"Picamera2 cung khong kha dung: {e}")
        raise RuntimeError("Khong tim thay camera backend nao")


camera_backend = None
camera_broadcaster = None


class CameraBroadcaster:
    """Thread doc camera duy nhat va broadcast frame cho ca WebRTC va MJPEG client."""

    def __init__(self, width=640, height=480, fps=15, device=None):
        self.width = width
        self.height = height
        self.fps = fps
        self.device = device
        self.backend = None
        self._current_frame = None
        self._current_raw_frame = None
        self._lock = threading.Lock()
        self._cond = threading.Condition(self._lock)
        self._running = False
        self._thread = None

    def start(self):
        try:
            self.backend = create_camera_backend(
                self.width, self.height, self.fps, device=self.device
            )
        except Exception as e:
            logger.warning("Camera backend chua san sang luc khoi dong (%s), se thu lai...", e)
            self.backend = None

        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def _capture_loop(self):
        logger.info("Background Frame Broadcaster da khoi chay.")
        target_interval = 1.0 / self.fps
        last_reconnect_try = 0.0

        while self._running:
            now = time.time()
            if self.backend is None and (now - last_reconnect_try >= 2.0):
                last_reconnect_try = now
                try:
                    self.backend = create_camera_backend(
                        self.width, self.height, self.fps, device=self.device
                    )
                except Exception:
                    self.backend = None

            jpeg_frame = None
            raw_frame = None
            if self.backend:
                try:
                    if hasattr(self.backend, "capture_raw_frame"):
                        raw_frame = self.backend.capture_raw_frame()
                    jpeg_frame = self.backend.capture_jpeg()
                except Exception as e:
                    logger.debug("Loi capture frame: %s", e)
                    jpeg_frame = None
                    raw_frame = None

            if jpeg_frame is None:
                jpeg_frame = generate_placeholder_jpeg("RECONNECTING CAMERA SENSOR...")
            if raw_frame is None:
                raw_frame = generate_placeholder_raw("RECONNECTING CAMERA SENSOR...")

            with self._cond:
                self._current_frame = jpeg_frame
                self._current_raw_frame = raw_frame
                self._cond.notify_all()

            time.sleep(target_interval)

    def get_frame(self, timeout=0.2):
        with self._cond:
            if self._current_frame is None:
                self._cond.wait(timeout=timeout)
            return self._current_frame or generate_placeholder_jpeg("INITIALIZING CAMERA...")

    def get_raw_frame(self, timeout=0.2):
        with self._cond:
            if self._current_raw_frame is None:
                self._cond.wait(timeout=timeout)
            return self._current_raw_frame if self._current_raw_frame is not None else generate_placeholder_raw("INITIALIZING CAMERA...")

    def stop(self):
        self._running = False
        if self.backend:
            try:
                self.backend.stop()
            except Exception:
                pass
            self.backend = None


if WEBRTC_AVAILABLE:
    class RobotVideoTrack(VideoStreamTrack):
        """WebRTC Video Stream Track cung cap khung hinh truc tiep tu CameraBroadcaster."""
        kind = "video"

        def __init__(self, broadcaster):
            super().__init__()
            self.broadcaster = broadcaster
            self._fps = broadcaster.fps or 15
            self._start = None
            self._timestamp = 0

        async def next_timestamp(self):
            if self.readyState != "live":
                import aiortc.mediastreams
                raise aiortc.mediastreams.MediaStreamError

            clock_rate = 90000
            time_base = fractions.Fraction(1, clock_rate)
            frame_duration = int(clock_rate / self._fps)

            if self._start is not None:
                self._timestamp += frame_duration
                wait = self._start + (self._timestamp / clock_rate) - asyncio.get_event_loop().time()
                if wait > 0:
                    await asyncio.sleep(wait)
            else:
                self._start = asyncio.get_event_loop().time()
                self._timestamp = 0

            return self._timestamp, time_base

        async def recv(self):
            pts, time_base = await self.next_timestamp()
            raw = self.broadcaster.get_raw_frame()
            if raw is None:
                raw = generate_placeholder_raw("CAMERA RECONNECTING...")
            frame = av.VideoFrame.from_ndarray(raw, format="bgr24")
            frame.pts = pts
            frame.time_base = time_base
            return frame


pcs = set()
relay = None
video_track = None


async def handle_offer(request):
    """Nhan SDP Offer tu client, khoi tao RTCPeerConnection va tra ve SDP Answer."""
    global pcs, relay, video_track, camera_broadcaster
    try:
        params = await request.json()
        offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

        pc = RTCPeerConnection(
            configuration=RTCConfiguration(
                iceServers=[
                    RTCIceServer(urls=["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"])
                ]
            )
        )
        pcs.add(pc)

        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info("WebRTC Peer connection state: %s", pc.connectionState)
            if pc.connectionState in ["failed", "closed"]:
                await pc.close()
                pcs.discard(pc)

        if relay is None:
            relay = MediaRelay()
        if video_track is None and camera_broadcaster:
            video_track = RobotVideoTrack(camera_broadcaster)

        if video_track:
            pc.addTrack(relay.subscribe(video_track))

        await pc.setRemoteDescription(offer)
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        return web.json_response(
            {
                "sdp": pc.localDescription.sdp,
                "type": pc.localDescription.type,
            },
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
            },
        )
    except Exception as e:
        logger.error("WebRTC offer error: %s", e)
        return web.json_response(
            {"error": str(e)},
            status=500,
            headers={"Access-Control-Allow-Origin": "*"},
        )


async def handle_offer_options(request):
    return web.Response(
        status=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
    )


async def handle_stream(request):
    """Phat MJPEG stream multipart/x-mixed-replace qua aiohttp."""
    global camera_broadcaster
    resp = web.StreamResponse(
        status=200,
        reason="OK",
        headers={
            "Content-Type": "multipart/x-mixed-replace; boundary=frame",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Access-Control-Allow-Origin": "*",
        },
    )
    await resp.prepare(request)
    fps = camera_broadcaster.fps if camera_broadcaster else 15
    interval = 1.0 / fps

    try:
        while True:
            frame = camera_broadcaster.get_frame(timeout=0.2)
            await resp.write(
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n"
                + frame + b"\r\n"
            )
            await asyncio.sleep(interval)
    except (ConnectionResetError, asyncio.CancelledError):
        pass
    return resp


async def handle_health(request):
    global pcs
    return web.json_response(
        {
            "status": "ok",
            "service": "pi5-camera-stream",
            "webrtc": WEBRTC_AVAILABLE,
            "active_webrtc_peers": len(pcs),
        },
        headers={"Access-Control-Allow-Origin": "*"},
    )


async def handle_snapshot(request):
    global camera_broadcaster
    frame = camera_broadcaster.get_frame(timeout=0.5) if camera_broadcaster else generate_placeholder_jpeg()
    return web.Response(
        body=frame,
        content_type="image/jpeg",
        headers={"Access-Control-Allow-Origin": "*"},
    )


async def handle_index(request):
    html = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>HCRobot Pi 5 WebRTC / MJPEG Stream</title>
  <style>
    body { margin: 0; background: #0c0a09; color: #f5f5f4; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
    video, img { max-width: 95vw; max-height: 80vh; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
    .controls { margin-top: 12px; display: flex; gap: 12px; }
    button { padding: 8px 16px; background: #292524; color: #fff; border: 1px solid #44403c; border-radius: 6px; cursor: pointer; }
    button:hover { background: #44403c; }
  </style>
</head>
<body>
  <video id="v" autoplay playsinline muted></video>
  <div class="controls">
    <button onclick="startWebRTC()">WebRTC (P2P)</button>
    <button onclick="startMJPEG()">MJPEG (HTTP)</button>
  </div>
  <script>
    async function startWebRTC() {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.ontrack = e => { document.getElementById('v').srcObject = e.streams[0]; };
      pc.addTransceiver('video', { direction: 'recvonly' });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const res = await fetch('/offer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sdp: pc.localDescription.sdp, type: pc.localDescription.type }) });
      const answer = await res.json();
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
    function startMJPEG() {
      const v = document.getElementById('v');
      v.srcObject = null;
      v.poster = '/stream';
    }
    startWebRTC().catch(startMJPEG);
  </script>
</body>
</html>"""
    return web.Response(text=html, content_type="text/html")


async def on_shutdown(app):
    global pcs, camera_broadcaster
    for pc in set(pcs):
        await pc.close()
    pcs.clear()
    if camera_broadcaster:
        camera_broadcaster.stop()


def create_aiohttp_app():
    app = web.Application()
    app.router.add_post("/offer", handle_offer)
    app.router.add_options("/offer", handle_offer_options)
    app.router.add_get("/stream", handle_stream)
    app.router.add_get("/health", handle_health)
    app.router.add_get("/snapshot", handle_snapshot)
    app.router.add_get("/", handle_index)
    app.on_shutdown.append(on_shutdown)
    return app


class MJPEGHandler(BaseHTTPRequestHandler):
    """Fallback HTTP handler neu khong co aiohttp/aiortc."""

    def do_GET(self):
        clean_path = self.path.split("?")[0]
        if clean_path == "/stream":
            self._handle_stream()
        elif clean_path == "/health":
            self._handle_health()
        elif clean_path == "/":
            self._handle_index()
        else:
            self.send_response(404)
            self.end_headers()

    def _handle_stream(self):
        global camera_broadcaster
        self.send_response(200)
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        target_interval = 1.0 / (camera_broadcaster.fps if camera_broadcaster else 15)
        try:
            while True:
                frame = camera_broadcaster.get_frame(timeout=0.2) if camera_broadcaster else generate_placeholder_jpeg()
                self.wfile.write(b"--frame\r\n")
                self.wfile.write(b"Content-Type: image/jpeg\r\n")
                self.wfile.write(f"Content-Length: {len(frame)}\r\n\r\n".encode())
                self.wfile.write(frame)
                self.wfile.write(b"\r\n")
                try:
                    self.wfile.flush()
                except Exception:
                    pass
                time.sleep(target_interval)
        except (BrokenPipeError, ConnectionResetError):
            logger.info("Client disconnected from stream")

    def _handle_health(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(b'{"status":"ok","service":"pi5-camera-stream","webrtc":false}')

    def _handle_index(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        html = """<!DOCTYPE html><html><body style="margin:0;background:#000"><img src="/stream" style="max-width:100%"/></body></html>"""
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        logger.debug(format, *args)


class ThreadedHTTPServer(HTTPServer):
    def server_bind(self):
        super().server_bind()
        try:
            import socket
            self.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except Exception:
            pass

    def process_request(self, request, client_address):
        threading.Thread(
            target=self.process_request_thread,
            args=(request, client_address),
            daemon=True,
        ).start()

    def process_request_thread(self, request, client_address):
        try:
            self.finish_request(request, client_address)
        except Exception:
            self.handle_error(request, client_address)
        finally:
            self.shutdown_request(request)


def parse_args():
    parser = argparse.ArgumentParser(description="Pi 5 WebRTC & MJPEG Camera Stream Server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"HTTP port (default: {DEFAULT_PORT})")
    parser.add_argument("--fps", type=int, default=DEFAULT_FPS, help=f"Frame rate (default: {DEFAULT_FPS})")
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH, help=f"Frame width (default: {DEFAULT_WIDTH})")
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT, help=f"Frame height (default: {DEFAULT_HEIGHT})")
    parser.add_argument("--device", default=None, help="Device index / path cho USB camera")
    return parser.parse_args()


def main():
    global camera_broadcaster, camera_backend

    args = parse_args()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    broadcaster = CameraBroadcaster(
        width=args.width, height=args.height, fps=args.fps, device=args.device
    )
    broadcaster.start()
    camera_broadcaster = broadcaster
    camera_backend = broadcaster.backend

    logger.info("Pi5 Camera Stream Server started (WebRTC=%s)", WEBRTC_AVAILABLE)
    logger.info("   WebRTC Offer : http://0.0.0.0:%d/offer", args.port)
    logger.info("   MJPEG Stream : http://0.0.0.0:%d/stream", args.port)
    logger.info("   Health Check : http://0.0.0.0:%d/health", args.port)
    logger.info("   Resolution   : %dx%d @ %dfps", args.width, args.height, args.fps)

    if WEBRTC_AVAILABLE:
        app = create_aiohttp_app()
        web.run_app(app, host="0.0.0.0", port=args.port, access_log=None)
    else:
        server = ThreadedHTTPServer(("0.0.0.0", args.port), MJPEGHandler)

        def shutdown_handler(sig, frame):
            logger.info("Shutting down camera stream server...")
            broadcaster.stop()
            server.shutdown()
            sys.exit(0)

        signal.signal(signal.SIGINT, shutdown_handler)
        signal.signal(signal.SIGTERM, shutdown_handler)
        server.serve_forever()


if __name__ == "__main__":
    main()
