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
    Cho phép lọc theo danh mục và tìm kiếm nhanh.
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
            items=[DialogueScenarioResponse.model_validate(it) for it in items],
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
    Sau khi tạo, hệ thống tự động làm mới In-Memory RAM Cache để robot nhận diện ngay (<1ms).
    """
    try:
        created = await scenario_service.create_scenario(db=db, data=request)
        return DialogueScenarioResponse.model_validate(created)
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
    """Lấy thông tin chi tiết của một kịch bản theo ID."""
    try:
        item = await scenario_service.get_scenario(db=db, scenario_id=scenario_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy kịch bản với ID '{scenario_id}'",
            )
        return DialogueScenarioResponse.model_validate(item)
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
    In-Memory RAM Cache sẽ được tự động đồng bộ ngay lập tức.
    """
    try:
        updated = await scenario_service.update_scenario(db=db, scenario_id=scenario_id, data=request)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy kịch bản với ID '{scenario_id}' để cập nhật",
            )
        return DialogueScenarioResponse.model_validate(updated)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ScenariosAPI update_scenario Error] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể cập nhật kịch bản: {str(e)}",
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
