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

from app.api.v1.endpoints.default_workflows import CORE_WORKFLOWS


async def ensure_default_workflow(db: AsyncSession):
    """Seed all 7 standard Core Workflows from Stepflow.md if database is empty or missing."""
    for wf_data in CORE_WORKFLOWS:
        res = await db.execute(select(RobotWorkflow).where(RobotWorkflow.id == wf_data["id"]))
        if res.scalar_one_or_none() is None:
            new_wf = RobotWorkflow(
                id=wf_data["id"],
                name=wf_data["name"],
                description=wf_data["description"],
                trigger_type=wf_data["trigger_type"],
                is_active=wf_data["is_active"],
                steps=wf_data["steps"],
            )
            db.add(new_wf)
    await db.commit()


@router.get("", response_model=List[WorkflowResponse], summary="Lấy danh sách các Step Workflows của Robot")
async def get_all_workflows(db: AsyncSession = Depends(get_db)):
    await ensure_default_workflow(db)
    res = await db.execute(select(RobotWorkflow).order_by(RobotWorkflow.id.asc()))
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


from app.services.notification_manager import notification_manager


@router.post("/{workflow_id}/execute", response_model=WorkflowExecuteResponse, summary="Chạy thử kịch bản Workflow trên Robot")
async def execute_workflow(workflow_id: str, payload: WorkflowExecuteRequest = WorkflowExecuteRequest(), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RobotWorkflow).where(RobotWorkflow.id == workflow_id))
    wf = res.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Workflow")

    logs = []
    robot_code = payload.robot_id or "RC-001"
    logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] Kích hoạt kịch bản '{wf.name}' trên {robot_code}")

    # Broadcast to Robot screens connected via WebSocket
    try:
        await notification_manager.broadcast_to_department(
            None,
            {
                "type": "WORKFLOW_DISPATCH",
                "workflow": {
                    "id": wf.id,
                    "name": wf.name,
                    "steps": wf.steps,
                },
                "robot_id": robot_code,
            }
        )
    except Exception as e:
        logger.warning(f"Could not broadcast workflow dispatch: {e}")

    steps = wf.steps or []
    for idx, step in enumerate(steps, start=1):
        step_type = step.get("type", "UNKNOWN")
        step_title = step.get("title", f"Step {idx}")
        params = step.get("params", {})
        
        if step_type == "MOVE":
            wp = params.get("waypoint_name", params.get("target_waypoint_id", params.get("target_value", "Tọa độ")))
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [MOVE] Robot đang di chuyển đến điểm mốc '{wp}' (X:{params.get('target_x', 0)}, Y:{params.get('target_y', 0)}, Vận tốc:{params.get('speed', 0.4)}m/s)")
        elif step_type == "GREET":
            greeting = params.get("greeting_text") or params.get("text", "Xin chào")
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [GREET] Phát lời chào: \"{greeting}\" - Biểu cảm: {params.get('face_expression', params.get('expression', 'SMILE'))}")
        elif step_type == "SPEAK":
            speech = params.get("speech_text") or params.get("text", "")
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [SPEAK] Đọc TTS ra loa: \"{speech[:50]}...\"")
        elif step_type == "SHOW":
            mode = params.get("screen_mode") or params.get("content_id") or params.get("screen_type", "SERVICES")
            banner = params.get("display_banner") or params.get("content_id", "Giao diện khách sạn")
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [SHOW] Hiển thị màn hình: {mode} (Banner: {banner})")
        elif step_type == "LISTEN":
            timeout = params.get("timeout") or params.get("timeout_sec", 15)
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [LISTEN] Chờ khách chọn hoặc phát biểu (Timeout: {timeout}s)")
        elif step_type == "RECOMMEND":
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [RECOMMEND] AI gợi ý món ăn/tiện ích: {params.get('highlight_item', 'Menu nhà hàng')}")
        elif step_type == "CREATE_REQUEST":
            dept = params.get("target_department") or ("Reception" if params.get("service_type") == "CALL_STAFF" else "Housekeeping")
            room = params.get("room_number", "LOBBY")
            note = params.get("note", "")
            urgency = params.get("urgency") or params.get("ticket_priority", "NORMAL")
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [CREATE_REQUEST] Đóng gói phiếu dịch vụ [{urgency}] gửi {dept} (Phòng: {room}, Ghi chú: {note})")
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
