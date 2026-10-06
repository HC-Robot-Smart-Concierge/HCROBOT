import io
import os
import time
import logging
from typing import Optional, Dict, Any

from app.core.config import settings

logger = logging.getLogger(__name__)

class CloudinaryService:
    def __init__(self):
        self._is_configured = False
        self._init_cloudinary()

    def _init_cloudinary(self):
        """Khởi tạo cấu hình Cloudinary từ biến môi trường."""
        try:
            import cloudinary
            import cloudinary.uploader
            import cloudinary.api

            if settings.CLOUDINARY_URL:
                cloudinary.config()
                self._is_configured = True
                logger.info("CloudinaryService: Đã khởi tạo thành công qua CLOUDINARY_URL.")
            elif (
                settings.CLOUDINARY_CLOUD_NAME
                and settings.CLOUDINARY_API_KEY
                and settings.CLOUDINARY_API_SECRET
            ):
                cloudinary.config(
                    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                    api_key=settings.CLOUDINARY_API_KEY,
                    api_secret=settings.CLOUDINARY_API_SECRET,
                    secure=True,
                )
                self._is_configured = True
                logger.info(f"CloudinaryService: Đã kết nối Cloudinary cloud='{settings.CLOUDINARY_CLOUD_NAME}'.")
            else:
                logger.warning(
                    "CloudinaryService: Chưa cấu hình CLOUDINARY_CLOUD_NAME / API_KEY trong .env. "
                    "Hệ thống sẽ tự động fallback lưu video local tại ./uploaded_recordings."
                )
                self._is_configured = False
        except Exception as e:
            logger.error(f"CloudinaryService: Lỗi khởi tạo Cloudinary: {e}")
            self._is_configured = False

    @property
    def is_configured(self) -> bool:
        return self._is_configured

    async def upload_video_recording(
        self,
        file_bytes: bytes,
        filename: str,
        folder: Optional[str] = None,
        duration: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Tải video ghi hình cuộc gọi lên Cloudinary (hoặc local fallback nếu chưa nhập API Key).
        Trả về: { secure_url, public_id, duration, thumbnail_url, storage_provider }
        """
        import asyncio
        target_folder = folder or settings.CLOUDINARY_FOLDER or "hcrobot/call_recordings"

        if self._is_configured:
            try:
                import cloudinary.uploader

                def _do_upload():
                    file_io = io.BytesIO(file_bytes)
                    upload_res = cloudinary.uploader.upload_large(
                        file_io,
                        resource_type="video",
                        folder=target_folder,
                        overwrite=True,
                        chunk_size=6000000,
                    )
                    return upload_res

                res = await asyncio.to_thread(_do_upload)
                secure_url = res.get("secure_url", "")
                public_id = res.get("public_id", "")
                calc_duration = int(res.get("duration") or duration or 0)
                
                # Cloudinary tự sinh thumbnail từ video bằng cách đổi đuôi sang .jpg
                thumbnail_url = secure_url.rsplit(".", 1)[0] + ".jpg" if "." in secure_url else secure_url

                logger.info(f"CloudinaryService: Upload video thành công: {secure_url} (public_id={public_id})")
                return {
                    "secure_url": secure_url,
                    "public_id": public_id,
                    "duration": calc_duration,
                    "thumbnail_url": thumbnail_url,
                    "storage_provider": "cloudinary",
                }
            except Exception as ex:
                logger.error(f"CloudinaryService: Upload lên Cloudinary thất bại ({ex}). Kích hoạt local fallback...")

        # Fallback lưu trữ local để đảm bảo hệ thống không bao giờ bị lỗi gián đoạn
        return await self._save_locally(file_bytes, filename, duration)

    async def _save_locally(self, file_bytes: bytes, filename: str, duration: Optional[int] = None) -> Dict[str, Any]:
        """Lưu video ghi hình vào thư mục local ./uploaded_recordings."""
        import asyncio

        def _write():
            local_dir = os.path.join(os.getcwd(), "uploaded_recordings")
            os.makedirs(local_dir, exist_ok=True)
            safe_name = f"rec_{int(time.time())}_{filename}"
            target_path = os.path.join(local_dir, safe_name)
            with open(target_path, "wb") as f:
                f.write(file_bytes)
            # URL truy cập tĩnh phục vụ dashboard
            local_url = f"/api/v1/operations/concierge/recordings/local/{safe_name}"
            return local_url, safe_name

        local_url, safe_name = await asyncio.to_thread(_write)
        logger.info(f"CloudinaryService: Video đã lưu local tại {safe_name}")
        return {
            "secure_url": local_url,
            "public_id": f"local_{safe_name}",
            "duration": duration or 0,
            "thumbnail_url": None,
            "storage_provider": "local",
        }


cloudinary_service = CloudinaryService()
