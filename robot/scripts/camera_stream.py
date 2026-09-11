#!/usr/bin/env python3
"""
MJPEG Camera Stream Server — Raspberry Pi 5.

Chạy HTTP server phát video stream MJPEG từ camera Pi 5.
Hỗ trợ Picamera2 (Camera Module CSI) + OpenCV fallback (USB webcam).

Usage trên Pi 5:
    python3 camera_stream.py
    python3 camera_stream.py --port 8554 --fps 15 --width 1280 --height 720

SSH Tunnel từ Windows:
    ssh -L 8554:localhost:8554 pi@<PI5_IP> -N

Sau đó mở: http://localhost:8554/stream
"""
import io
import sys
import time
import signal
import logging
import argparse
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

logger = logging.getLogger("pi5-camera")

DEFAULT_PORT = 8554
DEFAULT_FPS = 15
DEFAULT_WIDTH = 1280
DEFAULT_HEIGHT = 720


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

    def stop(self):
        raise NotImplementedError


class Picamera2Backend(CameraBackend):
    """Backend sử dụng Picamera2 cho Camera Module CSI trên Pi 5."""

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
        logger.info(
            f"Picamera2 started: {self.width}x{self.height} @ {self.fps}fps"
        )

    def capture_jpeg(self):
        buf = io.BytesIO()
        self._camera.capture_file(buf, format="jpeg")
        return buf.getvalue()

    def stop(self):
        if self._camera:
            self._camera.stop()
            self._camera.close()
            self._camera = None


class OpenCVBackend(CameraBackend):
    """Fallback backend sử dụng OpenCV (USB webcam hoặc V4L2)."""

    def __init__(self, width, height, fps):
        super().__init__(width, height, fps)
        self._cap = None

    def start(self):
        import cv2

        self._cv2 = cv2
        self._cap = cv2.VideoCapture(0)
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self._cap.set(cv2.CAP_PROP_FPS, self.fps)

        if not self._cap.isOpened():
            raise RuntimeError("Cannot open camera via OpenCV")

        logger.info(
            f"OpenCV camera started: {self.width}x{self.height} @ {self.fps}fps"
        )

    def capture_jpeg(self):
        ret, frame = self._cap.read()
        if not ret:
            raise RuntimeError("Failed to read frame from camera")
        _, jpeg = self._cv2.imencode(
            ".jpg", frame, [self._cv2.IMWRITE_JPEG_QUALITY, 80]
        )
        return jpeg.tobytes()

    def stop(self):
        if self._cap:
            self._cap.release()
            self._cap = None


def create_camera_backend(width, height, fps):
    """Tự động chọn backend phù hợp: Picamera2 -> OpenCV."""
    try:
        backend = Picamera2Backend(width, height, fps)
        backend.start()
        return backend
    except (ImportError, RuntimeError) as e:
        logger.warning(f"Picamera2 không khả dụng ({e}), thử OpenCV fallback...")

    try:
        backend = OpenCVBackend(width, height, fps)
        backend.start()
        return backend
    except (ImportError, RuntimeError) as e:
        logger.error(f"OpenCV cũng không khả dụng: {e}")
        raise RuntimeError(
            "Không tìm thấy camera backend nào (cần picamera2 hoặc opencv-python)"
        )


camera_backend = None


class MJPEGHandler(BaseHTTPRequestHandler):
    """HTTP handler phát MJPEG stream và health check."""

    def do_GET(self):
        if self.path == "/stream":
            self._handle_stream()
        elif self.path == "/health":
            self._handle_health()
        elif self.path == "/":
            self._handle_index()
        else:
            self.send_response(404)
            self.end_headers()

    def _handle_stream(self):
        self.send_response(200)
        self.send_header(
            "Content-Type", "multipart/x-mixed-replace; boundary=frame"
        )
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        interval = 1.0 / camera_backend.fps

        try:
            while True:
                frame = camera_backend.capture_jpeg()
                self.wfile.write(b"--frame\r\n")
                self.wfile.write(b"Content-Type: image/jpeg\r\n")
                self.wfile.write(
                    f"Content-Length: {len(frame)}\r\n\r\n".encode()
                )
                self.wfile.write(frame)
                self.wfile.write(b"\r\n")
                time.sleep(interval)
        except (BrokenPipeError, ConnectionResetError):
            logger.info("Client disconnected from stream")

    def _handle_health(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(b'{"status":"ok","service":"pi5-camera-stream"}')

    def _handle_index(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        html = """<!DOCTYPE html>
<html><head><title>Pi5 Camera</title></head>
<body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh">
<img src="/stream" style="max-width:100%;max-height:100vh" />
</body></html>"""
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        logger.debug(format, *args)


class ThreadedHTTPServer(HTTPServer):
    """HTTP server xử lý mỗi request trên thread riêng (hỗ trợ nhiều client)."""

    def process_request(self, request, client_address):
        thread = threading.Thread(
            target=self.process_request_thread,
            args=(request, client_address),
            daemon=True,
        )
        thread.start()

    def process_request_thread(self, request, client_address):
        try:
            self.finish_request(request, client_address)
        except Exception:
            self.handle_error(request, client_address)
        finally:
            self.shutdown_request(request)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Pi 5 MJPEG Camera Stream Server"
    )
    parser.add_argument(
        "--port", type=int, default=DEFAULT_PORT, help=f"HTTP port (default: {DEFAULT_PORT})"
    )
    parser.add_argument(
        "--fps", type=int, default=DEFAULT_FPS, help=f"Frame rate (default: {DEFAULT_FPS})"
    )
    parser.add_argument(
        "--width", type=int, default=DEFAULT_WIDTH, help=f"Frame width (default: {DEFAULT_WIDTH})"
    )
    parser.add_argument(
        "--height", type=int, default=DEFAULT_HEIGHT, help=f"Frame height (default: {DEFAULT_HEIGHT})"
    )
    return parser.parse_args()


def main():
    global camera_backend

    args = parse_args()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    camera_backend = create_camera_backend(args.width, args.height, args.fps)

    server = ThreadedHTTPServer(("0.0.0.0", args.port), MJPEGHandler)

    def shutdown_handler(sig, frame):
        logger.info("Shutting down camera stream server...")
        camera_backend.stop()
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    logger.info("📹 Pi5 MJPEG Camera Stream Server started")
    logger.info(f"   Stream URL : http://0.0.0.0:{args.port}/stream")
    logger.info(f"   Health URL : http://0.0.0.0:{args.port}/health")
    logger.info(f"   Preview    : http://0.0.0.0:{args.port}/")
    logger.info(f"   Resolution : {args.width}x{args.height} @ {args.fps}fps")

    server.serve_forever()


if __name__ == "__main__":
    main()
