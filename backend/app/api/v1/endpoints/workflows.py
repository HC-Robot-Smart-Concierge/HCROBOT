import logging
import uuid
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.workflow import RobotWorkflow, RobotWaypoint
from app.schemas.workflow import (
    WorkflowResponse,
    WorkflowCreate,
    WorkflowUpdate,
    WorkflowExecuteRequest,
    WorkflowExecuteResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Default Standard Otto-compliant Workflow with all 8 steps
DEFAULT_CONCIERGE_WORKFLOW = {
    "id": "wf-lobby-welcome",
    "name": "Đón Khách & Hướng Dẫn Dịch Vụ Sảnh Chính (8 Steps)",
    "description": "Chu trình tự động chào đón khách, hướng dẫn dịch vụ tiện ích khách sạn và thu thập đánh giá hài lòng",
    "trigger_type": "AUTO_DETECT",
    "is_active": True,
    "steps": [
        {
            "step_id": "step-1-move",
            "type": "MOVE",
            "title": "1. Di chuyển lại gần khách tại Sảnh",
            "params": {
                "target_waypoint_id": "wp-reception",
                "waypoint_name": "Quầy Lễ Tân",
                "target_x": 0.0,
                "target_y": 0.0,
                "speed": 0.5,
                "distance_threshold": 1.2
            }
        },
        {
            "step_id": "step-2-greet",
            "type": "GREET",
            "title": "2. Chào hỏi và biểu cảm thân thiện",
            "params": {
                "greeting_text": "Hello! Welcome to our Luxury Hotel. Xin chào quý khách!",
                "face_expression": "HAPPY_SMILE",
                "led_color": "CYAN",
                "enable_language_picker": True
            }
        },
        {
            "step_id": "step-3-speak",
            "type": "SPEAK",
            "title": "3. Phát thông tin giới thiệu qua loa",
            "params": {
                "speech_text": "Em là Robot Concierge. Em có thể giúp quý khách tìm đường, gọi dịch vụ buồng phòng hoặc tra cứu thực đơn.",
                "voice_speed": 1.0,
                "language": "vi-VN"
            }
        },
        {
            "step_id": "step-4-show",
            "type": "SHOW",
            "title": "4. Hiển thị thực đơn và sơ đồ tiện ích",
            "params": {
                "screen_mode": "SERVICES_GRID",
                "display_banner": "Đặc quyền nghỉ dưỡng & Ẩm thực 5 sao",
                "banner_url": "/assets/hotel_banner.png",
                "slide_duration_sec": 10
            }
        },
        {
            "step_id": "step-5-listen",
            "type": "LISTEN",
            "title": "5. Lắng nghe yêu cầu từ khách",
            "params": {
                "input_mode": "VOICE_AND_TOUCH",
                "timeout_sec": 15,
                "prompt_hint": "Quý khách vui lòng chạm màn hình hoặc nói yêu cầu..."
            }
        },
        {
            "step_id": "step-6-recommend",
            "type": "RECOMMEND",
            "title": "6. Gợi ý thông minh theo nhu cầu",
            "params": {
                "recommend_category": "DINING_AND_SPA",
                "ai_suggestion": True,
                "highlight_item": "Set Trà Chiều Hoàng Gia & Hồ Bơi Tầng 4"
            }
        },
        {
            "step_id": "step-7-create-request",
            "type": "CREATE_REQUEST",
            "title": "7. Chuyển phiếu yêu cầu về bộ phận khách sạn",
            "params": {
                "target_department": "Housekeeping",
                "ticket_priority": "Normal",
                "fallback_staff": True
            }
        },
        {
            "step_id": "step-8-feedback",
            "type": "FEEDBACK",
            "title": "8. Thu thập nhận xét 1 - 5 sao",
            "params": {
                "survey_type": "5_STAR_RATING",
                "question_text": "Quý khách có hài lòng với sự hỗ trợ của em không?",
                "thank_you_message": "Cảm ơn quý khách! Chúc quý khách kỳ nghỉ tuyệt vời!"
            }
        }
    ]
}


async def ensure_default_workflow(db: AsyncSession):
    """Seed the default 8-step workflow if database is empty."""
    res = await db.execute(select(RobotWorkflow).limit(1))
    if res.scalar_one_or_none() is None:
        default_wf = RobotWorkflow(
            id=DEFAULT_CONCIERGE_WORKFLOW["id"],
            name=DEFAULT_CONCIERGE_WORKFLOW["name"],
            description=DEFAULT_CONCIERGE_WORKFLOW["description"],
            trigger_type=DEFAULT_CONCIERGE_WORKFLOW["trigger_type"],
            is_active=DEFAULT_CONCIERGE_WORKFLOW["is_active"],
            steps=DEFAULT_CONCIERGE_WORKFLOW["steps"],
        )
        db.add(default_wf)
        await db.commit()


@router.get("", response_model=List[WorkflowResponse], summary="Lấy danh sách các Step Workflows của Robot")
async def get_all_workflows(db: AsyncSession = Depends(get_db)):
    await ensure_default_workflow(db)
    res = await db.execute(select(RobotWorkflow).order_by(desc(RobotWorkflow.created_at)))
    return res.scalars().all()


@router.get("/{workflow_id}", response_model=WorkflowResponse, summary="Lấy chi tiết kịch bản Workflow")
async def get_workflow_by_id(workflow_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RobotWorkflow).where(RobotWorkflow.id == workflow_id))
    wf = res.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Workflow")
    return wf


@router.post("", response_model=WorkflowResponse, summary="Tạo mới hoặc cập nhật kịch bản Workflow")
async def create_or_save_workflow(payload: WorkflowCreate, db: AsyncSession = Depends(get_db)):
    wf_id = payload.id or f"wf-{uuid.uuid4().hex[:8]}"

    res = await db.execute(select(RobotWorkflow).where(RobotWorkflow.id == wf_id))
    existing = res.scalar_one_or_none()

    # Convert steps models to plain dicts for JSON column
    steps_data = [s.model_dump() if hasattr(s, "model_dump") else s for s in payload.steps]

    if existing:
        existing.name = payload.name
        existing.description = payload.description
        existing.trigger_type = payload.trigger_type
        existing.is_active = payload.is_active
        existing.steps = steps_data
        existing.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        new_wf = RobotWorkflow(
            id=wf_id,
            name=payload.name,
            description=payload.description,
            trigger_type=payload.trigger_type,
            is_active=payload.is_active,
            steps=steps_data,
        )
        db.add(new_wf)
        await db.commit()
        await db.refresh(new_wf)
        return new_wf


@router.put("/{workflow_id}", response_model=WorkflowResponse, summary="Cập nhật Workflow")
async def update_workflow(workflow_id: str, payload: WorkflowUpdate, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RobotWorkflow).where(RobotWorkflow.id == workflow_id))
    existing = res.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Workflow")

    if payload.name is not None:
        existing.name = payload.name
    if payload.description is not None:
        existing.description = payload.description
    if payload.trigger_type is not None:
        existing.trigger_type = payload.trigger_type
    if payload.is_active is not None:
        existing.is_active = payload.is_active
    if payload.steps is not None:
        existing.steps = [s.model_dump() if hasattr(s, "model_dump") else s for s in payload.steps]

    existing.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(existing)
    return existing


@router.delete("/{workflow_id}", summary="Xóa Workflow")
async def delete_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RobotWorkflow).where(RobotWorkflow.id == workflow_id))
    existing = res.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Workflow")

    await db.delete(existing)
    await db.commit()
    return {"status": "SUCCESS", "message": f"Đã xóa thành công Workflow {workflow_id}"}


@router.post("/{workflow_id}/execute", response_model=WorkflowExecuteResponse, summary="Chạy thử kịch bản Workflow trên Robot")
async def execute_workflow(workflow_id: str, payload: WorkflowExecuteRequest = WorkflowExecuteRequest(), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RobotWorkflow).where(RobotWorkflow.id == workflow_id))
    wf = res.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Workflow")

    logs = []
    robot_code = payload.robot_id or "RC-001"
    logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] Kích hoạt kịch bản '{wf.name}' trên {robot_code}")

    steps = wf.steps or []
    for idx, step in enumerate(steps, start=1):
        step_type = step.get("type", "UNKNOWN")
        step_title = step.get("title", f"Step {idx}")
        params = step.get("params", {})
        
        if step_type == "MOVE":
            wp = params.get("waypoint_name", params.get("target_waypoint_id", "Tọa độ"))
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [MOVE] Robot đang di chuyển đến điểm mốc '{wp}' (X:{params.get('target_x', 0)}, Y:{params.get('target_y', 0)})")
        elif step_type == "GREET":
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [GREET] Phát lời chào: \"{params.get('greeting_text', 'Xin chào')}\" - Biểu cảm: {params.get('face_expression', 'SMILE')}")
        elif step_type == "SPEAK":
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [SPEAK] Đọc TTS ra loa: \"{params.get('speech_text', '')[:40]}...\"")
        elif step_type == "SHOW":
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [SHOW] Hiển thị màn hình: {params.get('screen_mode', 'SERVICES')} - Banner: {params.get('display_banner', 'Thông tin')}")
        elif step_type == "LISTEN":
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [LISTEN] Chờ khách chọn hoặc phát biểu (Timeout: {params.get('timeout_sec', 15)}s)")
        elif step_type == "RECOMMEND":
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [RECOMMEND] AI gợi ý món ăn/tiện ích: {params.get('highlight_item', 'Menu nhà hàng')}")
        elif step_type == "CREATE_REQUEST":
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [CREATE_REQUEST] Đã đóng gói phiếu dịch vụ gửi tới bộ phận {params.get('target_department', 'Housekeeping')}")
        elif step_type == "FEEDBACK":
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [FEEDBACK] Mở màn hình khảo sát 1-5 sao. Ghi nhận đánh giá thành công!")
        else:
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [{step_type}] Thực thi {step_title}")

    logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] Hoàn thành toàn bộ {len(steps)} bước kịch bản thành công!")

    return WorkflowExecuteResponse(
        status="SUCCESS",
        message=f"Đã hoàn thành chạy thử kịch bản '{wf.name}'",
        workflow_id=workflow_id,
        executed_steps=len(steps),
        logs=logs
    )
