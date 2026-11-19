import logging
import uuid
from typing import List, Literal
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from app.models.workflow import RobotWorkflow
from app.repositories import WorkflowRepository, get_workflow_repository
from app.schemas.workflow import (
    WorkflowResponse,
    WorkflowCreate,
    WorkflowUpdate,
    WorkflowExecuteRequest,
    WorkflowExecuteResponse,
    WorkflowSchedulePreviewRequest,
    WorkflowExecutionConfig,
    WorkflowRouteBindingRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()

from app.api.v1.endpoints.default_workflows import CORE_WORKFLOWS, upgrade_legacy_move_step, upgrade_guest_service_steps

_workflows_seeded = False


async def validated_route_steps(steps, repo):
    from app.services.workflow_routes import resolve_route_steps
    try:
        return await resolve_route_steps(steps, repo)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


async def validate_physical_settings(steps, config, repo):
    if config.execution_mode != 'ROBOT':
        return
    from types import SimpleNamespace
    from app.services.workflow_plan import physical_plan
    try:
        await physical_plan(SimpleNamespace(is_active=True, steps=steps, execution_config=config.model_dump()), repo)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


async def validate_saved_steps(steps, config, is_active, repo):
    from app.services.workflow_routes import unconfigured_route_steps
    pending = unconfigured_route_steps(steps)
    if pending and is_active:
        raise HTTPException(status_code=422, detail="Workflow còn bước Đi theo tuyến chưa cấu hình. Lưu bản nháp tạm tắt rồi gán tuyến ở Physical Map.")
    # Templates can be saved before map parameters exist, but cannot be activated.
    await validated_route_steps([s for s in steps if s not in pending], repo)
    if not pending and (steps or is_active):
        await validate_physical_settings(steps, config, repo)


@router.post("/schedule-preview", summary="Xem lịch dự kiến, không phát lệnh robot")
async def preview_workflow_schedule(payload: WorkflowSchedulePreviewRequest):
    from app.services.workflow_schedule import preview_schedule
    return {"occurrences": preview_schedule(payload.execution_config),
            "dispatch_enabled": payload.execution_config.execution_mode == 'ROBOT'}


async def ensure_default_workflow(repo: WorkflowRepository):
    """Seed all standard Core Workflows from Stepflow.md if database is empty or missing."""
    global _workflows_seeded
    if _workflows_seeded:
        return

    await repo.seed_defaults(CORE_WORKFLOWS)
    upgraded = await repo.upgrade_steps(upgrade_legacy_move_step, upgrade_guest_service_steps)
    if upgraded:
        logger.info("Updated legacy lobby workflow steps in: %s", ", ".join(upgraded))
    _workflows_seeded = True


@router.get("", response_model=List[WorkflowResponse], summary="Lấy danh sách các Step Workflows của Robot")
async def get_all_workflows(repo: WorkflowRepository = Depends(get_workflow_repository)):
    await ensure_default_workflow(repo)
    return await repo.list_workflows()


@router.get("/{workflow_id}", response_model=WorkflowResponse, summary="Lấy chi tiết kịch bản Workflow")
async def get_workflow_by_id(
    workflow_id: str,
    repo: WorkflowRepository = Depends(get_workflow_repository),
):
    wf = await repo.get_by_id(workflow_id)
    if not wf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Workflow")
    return wf


@router.post("", response_model=WorkflowResponse, summary="Tạo mới hoặc cập nhật kịch bản Workflow")
async def create_or_save_workflow(
    payload: WorkflowCreate,
    repo: WorkflowRepository = Depends(get_workflow_repository),
):
    wf_id = payload.id or f"wf-{uuid.uuid4().hex[:8]}"
    existing = await repo.get_by_id(wf_id)

    # Convert steps models to plain dicts for JSON column
    steps_data = [s.model_dump() if hasattr(s, "model_dump") else s for s in payload.steps]
    await validate_saved_steps(steps_data, payload.execution_config, payload.is_active, repo)

    if existing:
        existing.name = payload.name
        existing.description = payload.description
        existing.trigger_type = payload.trigger_type
        existing.is_active = payload.is_active
        existing.steps = steps_data
        existing.execution_config = payload.execution_config.model_dump()
        existing.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await repo.commit()
        await repo.refresh(existing)
        return existing
    else:
        new_wf = RobotWorkflow(
            id=wf_id,
            name=payload.name,
            description=payload.description,
            trigger_type=payload.trigger_type,
            is_active=payload.is_active,
            steps=steps_data,
            execution_config=payload.execution_config.model_dump(),
        )
        await repo.create(new_wf, autocommit=True)
        return new_wf


@router.put("/{workflow_id}", response_model=WorkflowResponse, summary="Cập nhật Workflow")
async def update_workflow(
    workflow_id: str,
    payload: WorkflowUpdate,
    repo: WorkflowRepository = Depends(get_workflow_repository),
):
    existing = await repo.get_by_id(workflow_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Workflow")

    effective_trigger = payload.trigger_type if payload.trigger_type is not None else existing.trigger_type
    effective_config = payload.execution_config or WorkflowExecutionConfig.model_validate(existing.execution_config or {})
    effective_active = payload.is_active if payload.is_active is not None else existing.is_active
    if effective_active and effective_trigger == "SCHEDULE" and not any(s.enabled for s in effective_config.schedules):
        raise HTTPException(status_code=422, detail="Workflow theo lịch cần ít nhất một lịch đang bật")
    await validate_saved_steps(
        [s.model_dump() for s in payload.steps] if payload.steps is not None else existing.steps or [],
        effective_config, effective_active, repo,
    )

    if payload.name is not None:
        existing.name = payload.name
    if payload.description is not None:
        existing.description = payload.description
    if payload.trigger_type is not None:
        existing.trigger_type = payload.trigger_type
    if payload.is_active is not None:
        existing.is_active = payload.is_active
    if payload.execution_config is not None:
        existing.execution_config = payload.execution_config.model_dump()
    if payload.steps is not None:
        existing.steps = [s.model_dump() if hasattr(s, "model_dump") else s for s in payload.steps]

    existing.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await repo.commit()
    await repo.refresh(existing)
    return existing


@router.put("/{workflow_id}/steps/{step_id}/route", response_model=WorkflowResponse,
            summary="Gán tuyến trên map cho một bước workflow")
async def bind_step_route(workflow_id: str, step_id: str, payload: WorkflowRouteBindingRequest,
                          repo: WorkflowRepository = Depends(get_workflow_repository)):
    from copy import deepcopy
    from app.schemas.workflow import WorkflowRoute
    # Lock the target workflow and update only this parameter, preserving other steps/settings.
    workflow = await repo.get_for_update(workflow_id)
    if not workflow or (workflow.execution_config or {}).get('route'):
        raise HTTPException(status_code=404, detail="Không tìm thấy workflow cần gán tuyến")
    steps = deepcopy(workflow.steps or [])
    matches = [s for s in steps if s.get('step_id') == step_id]
    if len(matches) != 1 or matches[0].get('type') != 'FOLLOW_ROUTE':
        raise HTTPException(status_code=422, detail="Chọn đúng bước Đi theo tuyến của workflow")
    step = matches[0]
    previous = (step.get('params') or {}).get('route_id') or None
    if 'expected_route_id' in payload.model_fields_set and previous != (payload.expected_route_id or None):
        raise HTTPException(status_code=409, detail="Tuyến của bước đã được thay đổi. Tải lại workflow trước khi gán.")
    template = await repo.get_by_id(payload.route_id)
    if not template or not template.is_active or not (template.execution_config or {}).get('route'):
        raise HTTPException(status_code=422, detail="Tuyến không còn khả dụng")
    route = WorkflowRoute.model_validate(template.execution_config['route'])
    if route.map_id != payload.map_id:
        raise HTTPException(status_code=422, detail="Tuyến không thuộc map đang cấu hình")
    step['params'] = {**(step.get('params') or {}), 'route_id': template.id, 'map_id': route.map_id}
    config = WorkflowExecutionConfig.model_validate(workflow.execution_config or {})
    await validate_saved_steps(steps, config, workflow.is_active, repo)
    workflow.steps = steps
    workflow.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await repo.commit()
    await repo.refresh(workflow)
    return workflow


@router.delete("/{workflow_id}", summary="Xóa Workflow")
async def delete_workflow(
    workflow_id: str,
    repo: WorkflowRepository = Depends(get_workflow_repository),
):
    existing = await repo.get_by_id(workflow_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy Workflow")

    for workflow in await repo.list_workflows():
        if workflow.id == workflow_id:
            continue
        if any(step.get("type") == "FOLLOW_ROUTE" and (step.get("params") or {}).get("route_id") == workflow_id for step in workflow.steps or []):
            raise HTTPException(status_code=409, detail=f"Tuyến đang được workflow '{workflow.name}' sử dụng. Đổi tuyến trong workflow trước khi xóa.")

    await repo.delete(existing, autocommit=True)
    return {"status": "SUCCESS", "message": f"Đã xóa thành công Workflow {workflow_id}"}


from app.services.notification_manager import notification_manager


@router.get("/runs/recent", summary="Lịch sử lượt chạy xe thật")
async def recent_workflow_runs(workflow_id: str = None):
    from app.services.workflow_runtime import workflow_runtime
    return await workflow_runtime.list_runs(workflow_id)


class GuestReport(BaseModel):
    robot_id: str = "RC-001"
    state: Literal["ENGAGED", "DONE"]
    idle_ms: int = Field(default=0, ge=0, le=600000)


@router.post("/runs/guest", summary="Màn hình robot báo đang có khách / khách xong (dừng xe thật để trò chuyện)")
async def report_run_guest(payload: GuestReport):
    from app.services.workflow_runtime import workflow_runtime
    return workflow_runtime.report_guest(payload.robot_id, payload.state, payload.idle_ms)


@router.post("/runs/{run_id}/cancel", summary="Dừng lượt chạy xe thật")
async def cancel_workflow_run(run_id: str):
    from app.services.workflow_runtime import workflow_runtime
    run = await workflow_runtime.cancel(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt chạy")
    return run


@router.post("/{workflow_id}/execute", response_model=WorkflowExecuteResponse, summary="Gửi workflow hoặc tạo lượt chạy xe thật")
async def execute_workflow(
    workflow_id: str,
    payload: WorkflowExecuteRequest = WorkflowExecuteRequest(),
    repo: WorkflowRepository = Depends(get_workflow_repository),
):
    wf = await repo.get_by_id(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Không tìm thấy Workflow")
    if not wf.is_active:
        raise HTTPException(status_code=409, detail="Workflow đang tắt")
    config = WorkflowExecutionConfig.model_validate(wf.execution_config or {})
    if config.execution_mode == "ROBOT":
        if payload.speed_factor != 1.0:
            raise HTTPException(status_code=422, detail="Xe thật sử dụng vận tốc cấu hình trong Nav2 và vùng giảm tốc.")
        from app.services.workflow_runtime import workflow_runtime
        try:
            run = await workflow_runtime.enqueue(wf, repo, payload.robot_id or config.robot_id)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return WorkflowExecuteResponse(status=run["status"], message="Đã tạo lượt chạy; chờ kiểm tra Nav2 và định vị.",
                                       workflow_id=wf.id, executed_steps=0, logs=[], run_id=run["id"])
    steps = await validated_route_steps(wf.steps or [], repo)
    if not steps:
        raise HTTPException(status_code=422, detail="Workflow chưa có bước")
    await notification_manager.broadcast_to_department(None, {
        "type": "WORKFLOW_DISPATCH", "robot_id": payload.robot_id or "RC-001",
        "workflow": {"id": wf.id, "name": wf.name, "steps": steps},
    })
    # A broadcast is not a completion acknowledgment from the kiosk or vehicle.
    return WorkflowExecuteResponse(status="DISPATCHED", message="Đã gửi tới màn hình Robot; chưa xác nhận hoàn thành.",
                                   workflow_id=wf.id, executed_steps=0,
                                   logs=["Đã phát workflow tới màn hình; bước MOVE ở chế độ màn hình không điều khiển xe."])
