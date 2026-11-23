import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.scenario import (
    DialogueScenarioCreate,
    DialogueScenarioUpdate,
    DialogueScenarioResponse,
    DialogueScenarioListResponse,
    ScenarioAudioSyncResponse,
)
from app.services.ai.scenario_service import scenario_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=DialogueScenarioListResponse, summary="Lấy danh sách kịch bản hội thoại")
async def list_scenarios(
    category: Optional[str] = Query(None, description="Lọc theo danh mục (faq, facility, greeting, service, chitchat)"),
    is_active: Optional[bool] = Query(None, description="Lọc theo trạng thái kích hoạt"),
    search: Optional[str] = Query(None, description="Tìm kiếm theo tiêu đề hoặc câu trả lời"),
    db: AsyncSession = Depends(get_db),
):
    """
    Trả về danh sách tất cả các kịch bản hội thoại đã được cấu hình trước.
    Tự động kèm trạng thái file audio tĩnh tại folder backend (has_audio_vi, audio_url_vi, v.v.).
    """
    try:
        items = await scenario_service.list_scenarios(
            db=db,
            category=category,
            is_active=is_active,
            search=search,
        )
        return DialogueScenarioListResponse(
            total=len(items),
            items=[
                DialogueScenarioResponse.model_validate(scenario_service.attach_audio_status(it))
                for it in items
            ],
        )
    except Exception as e:
        logger.error(f"[ScenariosAPI list_scenarios Error] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể tải danh sách kịch bản: {str(e)}",
        )


@router.post("", response_model=DialogueScenarioResponse, status_code=status.HTTP_201_CREATED, summary="Tạo kịch bản hội thoại mới")
async def create_scenario(
    request: DialogueScenarioCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Tạo một kịch bản hội thoại mới.
    Sau khi tạo, hệ thống tự động làm mới In-Memory RAM Cache và tự động sinh file âm thanh offline vào folder backend.
    """
    try:
        created = await scenario_service.create_scenario(db=db, data=request)
        return DialogueScenarioResponse.model_validate(scenario_service.attach_audio_status(created))
    except Exception as e:
        logger.error(f"[ScenariosAPI create_scenario Error] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể tạo kịch bản: {str(e)}",
        )


@router.get("/{scenario_id}", response_model=DialogueScenarioResponse, summary="Xem chi tiết kịch bản")
async def get_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Lấy thông tin chi tiết của một kịch bản theo ID kèm thông tin file audio."""
    try:
        item = await scenario_service.get_scenario(db=db, scenario_id=scenario_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy kịch bản với ID '{scenario_id}'",
            )
        return DialogueScenarioResponse.model_validate(scenario_service.attach_audio_status(item))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ScenariosAPI get_scenario Error] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi đọc kịch bản: {str(e)}",
        )


@router.put("/{scenario_id}", response_model=DialogueScenarioResponse, summary="Cập nhật kịch bản hội thoại")
async def update_scenario(
    scenario_id: str,
    request: DialogueScenarioUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Cập nhật nội dung câu trả lời, từ khóa hoặc hành động của kịch bản.
    In-Memory RAM Cache sẽ được tự động đồng bộ và file audio backend được làm mới.
    """
    try:
        updated = await scenario_service.update_scenario(db=db, scenario_id=scenario_id, data=request)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy kịch bản với ID '{scenario_id}' để cập nhật",
            )
        return DialogueScenarioResponse.model_validate(scenario_service.attach_audio_status(updated))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ScenariosAPI update_scenario Error] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể cập nhật kịch bản: {str(e)}",
        )


@router.post("/generate-all-audio", response_model=ScenarioAudioSyncResponse, summary="Đồng bộ sinh toàn bộ file giọng nói offline vào folder backend")
async def generate_all_audio(
    only_fast_path: bool = Query(True, description="Chỉ sinh audio cho các kịch bản Fast-Path"),
    db: AsyncSession = Depends(get_db),
):
    """
    Duyệt qua tất cả kịch bản và sinh trước các file âm thanh MP3 lưu thẳng vào thư mục backend/static/audio_cache.
    Điện thoại PWA và Robot có thể phát trực tiếp các file này ngay cả khi mất Internet hoàn toàn.
    """
    try:
        res = await scenario_service.batch_pre_generate_all(db=db, only_fast_path=only_fast_path)
        return ScenarioAudioSyncResponse(**res)
    except Exception as e:
        logger.error(f"[ScenariosAPI generate_all_audio Error] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể sinh audio hàng loạt: {str(e)}",
        )


@router.post("/{scenario_id}/generate-audio", response_model=DialogueScenarioResponse, summary="Sinh trước file âm thanh cho 1 kịch bản cụ thể")
async def generate_scenario_audio(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Kích hoạt sinh file audio MP3 cho kịch bản được chỉ định và lưu vào backend/static/audio_cache.
    """
    try:
        item = await scenario_service.get_scenario(db=db, scenario_id=scenario_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy kịch bản với ID '{scenario_id}'",
            )
        updated_info = await scenario_service.pre_generate_scenario_audio(item)
        return DialogueScenarioResponse.model_validate(updated_info)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ScenariosAPI generate_scenario_audio Error] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi sinh audio cho kịch bản: {str(e)}",
        )


@router.get("/{scenario_id}/audio-status", summary="Kiểm tra trạng thái file audio tĩnh")
async def get_scenario_audio_status(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Trả về chi tiết trạng thái file audio MP3 vật lý trong thư mục backend."""
    try:
        item = await scenario_service.get_scenario(db=db, scenario_id=scenario_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy kịch bản với ID '{scenario_id}'",
            )
        status_info = scenario_service.attach_audio_status(item)
        return {
            "scenario_id": item.id,
            "has_audio_vi": status_info["has_audio_vi"],
            "has_audio_en": status_info["has_audio_en"],
            "audio_url_vi": status_info["audio_url_vi"],
            "audio_url_en": status_info["audio_url_en"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ScenariosAPI get_scenario_audio_status Error] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi kiểm tra audio: {str(e)}",
        )


@router.delete("/{scenario_id}", summary="Xóa kịch bản hội thoại")
async def delete_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Xóa kịch bản khỏi cơ sở dữ liệu và xóa khỏi In-Memory Cache."""
    try:
        success = await scenario_service.delete_scenario(db=db, scenario_id=scenario_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy kịch bản với ID '{scenario_id}' để xóa",
            )
        return {"success": True, "message": f"Đã xóa kịch bản '{scenario_id}' thành công"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ScenariosAPI delete_scenario Error] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể xóa kịch bản: {str(e)}",
        )


@router.post("/reload-cache", summary="Tải lại In-Memory RAM Cache thủ công")
async def reload_cache(db: AsyncSession = Depends(get_db)):
    """Đồng bộ cưỡng bức toàn bộ kịch bản từ Database vào bộ nhớ RAM của Robot."""
    try:
        await scenario_service.initialize_cache(db)
        return {
            "success": True,
            "message": "Đã tải lại toàn bộ kịch bản vào RAM Cache thành công!",
            "total_cached": len(scenario_service._cache),
        }
    except Exception as e:
        logger.error(f"[ScenariosAPI reload_cache Error] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể reload cache: {str(e)}",
        )
