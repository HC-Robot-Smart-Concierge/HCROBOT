import logging
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.advertisement import Advertisement
from app.schemas.advertisement import (
    AdvertisementResponse,
    AdvertisementCreate,
    AdvertisementUpdate,
    AdvertisementPushRequest,
)
from app.services.cloudinary_service import cloudinary_service
from app.services.notification_manager import NotificationConnectionManager
from app.services.rag.facility_ads_sync import sync_facility_ads_to_rag

logger = logging.getLogger(__name__)
router = APIRouter()

# Notification manager instance for broadcasting ad push events
from app.api.v1.endpoints.operations.shared import notification_manager


@router.get("", response_model=List[AdvertisementResponse], summary="Lấy danh sách tất cả quảng cáo (Admin)")
async def get_all_advertisements(db: AsyncSession = Depends(get_db)):
    try:
        stmt = select(Advertisement).order_by(desc(Advertisement.priority), desc(Advertisement.created_at))
        result = await db.execute(stmt)
        ads = result.scalars().all()
        return ads
    except Exception as e:
        logger.error(f"Error fetching advertisements: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi truy vấn danh sách quảng cáo: {str(e)}",
        )


@router.get("/active", response_model=List[AdvertisementResponse], summary="Lấy danh sách quảng cáo đang hoạt động (Robot)")
async def get_active_advertisements(
    auto_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    try:
        stmt = select(Advertisement).where(Advertisement.is_active == True)
        if auto_only:
            stmt = stmt.where(Advertisement.auto_play == True)
        stmt = stmt.order_by(desc(Advertisement.priority), desc(Advertisement.created_at))
        result = await db.execute(stmt)
        ads = result.scalars().all()
        return ads
    except Exception as e:
        logger.error(f"Error fetching active advertisements: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi nạp quảng cáo robot: {str(e)}",
        )


@router.post("/upload", response_model=AdvertisementResponse, summary="Tải lên media quảng cáo (Cloudinary) và lưu cấu hình")
async def upload_advertisement(
    file: UploadFile = File(...),
    title: str = Form(...),
    title_en: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    description_en: Optional[str] = Form(None),
    facility_key: Optional[str] = Form(None),
    target_gender: str = Form("ALL"),
    target_age_group: str = Form("ALL"),
    media_type: str = Form("IMAGE"), # 'IMAGE' hoặc 'VIDEO'
    duration_seconds: int = Form(10),
    priority: int = Form(1),
    is_active: bool = Form(True),
    auto_play: bool = Form(False),
    display_location: str = Form("ALL"),
    db: AsyncSession = Depends(get_db),
):
    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tệp tin tải lên rỗng",
            )

        # Upload file lên Cloudinary (hoặc local fallback nếu chưa có key)
        upload_result = await cloudinary_service.upload_ad_media(
            file_bytes=file_bytes,
            filename=file.filename or f"ad_{uuid.uuid4().hex[:6]}",
            media_type=media_type,
            duration=duration_seconds,
        )

        media_url = upload_result.get("secure_url")
        public_id = upload_result.get("public_id")
        thumbnail_url = upload_result.get("thumbnail_url")
        storage_provider = upload_result.get("storage_provider", "cloudinary")
        detected_duration = upload_result.get("duration") or duration_seconds

        ad_id = f"AD-{uuid.uuid4().hex[:6].upper()}"
        new_ad = Advertisement(
            id=ad_id,
            title=title.strip(),
            title_en=title_en.strip() if title_en else None,
            description=description.strip() if description else None,
            description_en=description_en.strip() if description_en else None,
            facility_key=facility_key.strip() if facility_key else None,
            target_gender=(target_gender or "ALL").strip(),
            target_age_group=(target_age_group or "ALL").strip(),
            media_type=media_type.upper(),
            media_url=media_url,
            thumbnail_url=thumbnail_url,
            public_id=public_id,
            storage_provider=storage_provider,
            duration_seconds=detected_duration,
            priority=priority,
            is_active=is_active,
            auto_play=auto_play,
            display_location=display_location,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(new_ad)
        await db.commit()
        await db.refresh(new_ad)
        await sync_facility_ads_to_rag(db)
        logger.info(f"Created new advertisement: {new_ad.id} - {new_ad.title}")
        return new_ad
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating advertisement with upload: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi tải lên và lưu quảng cáo: {str(e)}",
        )


@router.post("", response_model=AdvertisementResponse, summary="Thêm mới quảng cáo từ URL có sẵn")
async def create_advertisement(
    payload: AdvertisementCreate,
    db: AsyncSession = Depends(get_db),
):
    try:
        ad_id = f"AD-{uuid.uuid4().hex[:6].upper()}"
        new_ad = Advertisement(
            id=ad_id,
            title=payload.title.strip(),
            title_en=payload.title_en.strip() if payload.title_en else None,
            description=payload.description.strip() if payload.description else None,
            description_en=payload.description_en.strip() if payload.description_en else None,
            facility_key=payload.facility_key.strip() if payload.facility_key else None,
            target_gender=(payload.target_gender or "ALL").strip(),
            target_age_group=(payload.target_age_group or "ALL").strip(),
            media_type=payload.media_type.upper(),
            media_url=payload.media_url,
            thumbnail_url=payload.thumbnail_url or payload.media_url,
            public_id=payload.public_id,
            storage_provider=payload.storage_provider or "external",
            duration_seconds=payload.duration_seconds,
            priority=payload.priority,
            is_active=payload.is_active,
            auto_play=payload.auto_play,
            display_location=payload.display_location,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(new_ad)
        await db.commit()
        await db.refresh(new_ad)
        await sync_facility_ads_to_rag(db)
        return new_ad
    except Exception as e:
        logger.error(f"Error creating advertisement: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi tạo quảng cáo: {str(e)}",
        )


@router.get("/{ad_id}", response_model=AdvertisementResponse, summary="Lấy chi tiết một quảng cáo")
async def get_advertisement_by_id(ad_id: str, db: AsyncSession = Depends(get_db)):
    ad = await db.get(Advertisement, ad_id)
    if not ad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy quảng cáo",
        )
    return ad


@router.put("/{ad_id}", response_model=AdvertisementResponse, summary="Cập nhật thông tin hoặc trạng thái quảng cáo")
async def update_advertisement(
    ad_id: str,
    payload: AdvertisementUpdate,
    db: AsyncSession = Depends(get_db),
):
    try:
        ad = await db.get(Advertisement, ad_id)
        if not ad:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy quảng cáo",
            )

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if value is not None:
                setattr(ad, key, value)

        ad.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(ad)
        await sync_facility_ads_to_rag(db)
        logger.info(f"Updated advertisement: {ad.id}")
        return ad
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating advertisement {ad_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi cập nhật quảng cáo: {str(e)}",
        )


@router.delete("/{ad_id}", summary="Xóa quảng cáo và tệp tin trên Cloudinary")
async def delete_advertisement(ad_id: str, db: AsyncSession = Depends(get_db)):
    try:
        ad = await db.get(Advertisement, ad_id)
        if not ad:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy quảng cáo để xóa",
            )

        # Xóa media khỏi Cloudinary nếu có public_id
        if ad.public_id:
            await cloudinary_service.delete_media(ad.public_id, ad.media_type)

        await db.delete(ad)
        await db.commit()
        await sync_facility_ads_to_rag(db)
        logger.info(f"Deleted advertisement: {ad_id}")
        return {"success": True, "message": f"Đã xóa thành công quảng cáo {ad_id}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting advertisement {ad_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi xóa quảng cáo: {str(e)}",
        )


@router.post("/{ad_id}/push", summary="Đẩy quảng cáo xuống màn hình Robot tức thì")
async def push_advertisement_to_robot(
    ad_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        ad = await db.get(Advertisement, ad_id)
        if not ad:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy quảng cáo",
            )

        payload = {
            "type": "ADVERTISEMENT_PUSH",
            "advertisement": {
                "id": ad.id,
                "title": ad.title,
                "title_en": ad.title_en,
                "description": ad.description,
                "description_en": ad.description_en,
                "facility_key": ad.facility_key,
                "target_gender": ad.target_gender,
                "target_age_group": ad.target_age_group,
                "media_type": ad.media_type,
                "media_url": ad.media_url,
                "thumbnail_url": ad.thumbnail_url,
                "duration_seconds": ad.duration_seconds,
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Broadcast qua WebSocket notification_manager tới toàn bộ màn hình Robot
        await notification_manager.broadcast_to_department("All", payload)
        logger.info(f"Broadcasted advertisement push {ad.id} to robots")

        return {
            "success": True,
            "message": f"Đã đẩy thành công quảng cáo '{ad.title}' xuống màn hình Robot",
            "pushed_ad": payload["advertisement"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error pushing advertisement {ad_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi đẩy quảng cáo xuống robot: {str(e)}",
        )
