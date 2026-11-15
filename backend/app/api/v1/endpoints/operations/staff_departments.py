from datetime import datetime
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.models import Department
from app.repositories import StaffRepository, get_staff_repository
from app.schemas.operations import (
    DepartmentCreate,
    DepartmentDetailResponse,
    DepartmentUpdate,
    ServiceTypeResponse,
)
from .shared import TAG_STAFF

router = APIRouter()


def _to_department_detail(dept: Department, *, loaded: bool = True) -> DepartmentDetailResponse:
    """Chuyển bản ghi Department sang DepartmentDetailResponse kèm danh sách dịch vụ và nhân sự."""
    return DepartmentDetailResponse(
        id=dept.id,
        code=dept.code,
        name=dept.name,
        description=dept.description,
        is_active=dept.is_active,
        created_at=dept.created_at,
        updated_at=dept.updated_at,
        service_types=[ServiceTypeResponse.model_validate(s) for s in (dept.service_types or [])] if loaded else [],
        staff_count=sum(1 for acc in dept.accounts if acc.is_active) if loaded else 0,
    )


@router.get(
    "/departments",
    response_model=List[DepartmentDetailResponse],
    tags=TAG_STAFF,
    summary="Danh sách các phòng ban khách sạn",
    responses={
        200: {
            "description": "Lấy danh mục phòng ban thành công.",
        }
    },
)
async def list_departments(
    is_active: Optional[bool] = Query(
        None,
        description="Lọc theo trạng thái hoạt động: `true` (chỉ lấy phòng ban đang mở), `false` (phòng ban ngưng), `null` (lấy tất cả)",
    ),
    repo: StaffRepository = Depends(get_staff_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn danh mục toàn bộ các bộ phận vận hành chuẩn của khách sạn (`Aurora Hotel & Resort`).
    Bao gồm số lượng nhân sự active trực thuộc mỗi phòng ban.
    """
    depts = await repo.list_departments(is_active=is_active)
    return [_to_department_detail(d) for d in depts]


@router.post(
    "/departments",
    response_model=DepartmentDetailResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_STAFF,
    summary="Thêm mới phòng ban khách sạn",
    responses={
        201: {"description": "Tạo phòng ban thành công."},
        400: {"description": "Mã code hoặc tên phòng ban đã tồn tại."},
    },
)
async def create_department(
    dept_in: DepartmentCreate,
    repo: StaffRepository = Depends(get_staff_repository),
):
    name_clean = dept_in.name.strip()
    code_clean = (dept_in.code or "").strip().upper()
    if not code_clean:
        words = name_clean.split()
        if len(words) == 1:
            code_clean = words[0][:10].upper()
        else:
            code_clean = "".join(w[0].upper() for w in words[:4])
        code_clean = f"{code_clean}_{uuid.uuid4().hex[:3].upper()}"

    existing = await repo.find_department_by_code(code_clean)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mã code phòng ban '{code_clean}' đã tồn tại trong hệ thống.",
        )

    dept_id = f"DEP-{code_clean[:12]}"
    existing_id = await repo.get_department_by_id_or_code(dept_id)
    if existing_id:
        dept_id = f"DEP-{uuid.uuid4().hex[:8].upper()}"

    new_dept = Department(
        id=dept_id,
        code=code_clean,
        name=name_clean,
        description=dept_in.description,
        is_active=dept_in.is_active,
    )
    await repo.create(new_dept, autocommit=True)
    return _to_department_detail(new_dept, loaded=False)


@router.get(
    "/departments/{department_id}",
    response_model=DepartmentDetailResponse,
    tags=TAG_STAFF,
    summary="Chi tiết phòng ban kèm danh sách dịch vụ và nhân sự trực thuộc",
    responses={
        200: {"description": "Thông tin chi tiết phòng ban, danh sách loại dịch vụ và tổng số nhân sự."},
        404: {"description": "Không tìm thấy phòng ban với mã ID hoặc code được cung cấp."},
    },
)
async def get_department_detail(
    department_id: str = Path(
        ...,
        description="Mã định danh duy nhất (vd: `DEP-HOUSEKEEPING`, `DEP-TAXI`) hoặc code phòng ban (vd: `HOUSEKEEPING`, `TAXI`)",
        examples=["DEP-HOUSEKEEPING", "DEP-BELL", "DEP-TAXI"],
    ),
    repo: StaffRepository = Depends(get_staff_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Lấy thông tin chuyên sâu của một phòng ban bao gồm:
    - Hồ sơ phòng ban (mã code, tên hiển thị, mô tả nhiệm vụ).
    - Toàn bộ danh mục **loại dịch vụ (Service Types)** trực thuộc phòng ban đó.
    - **Số lượng nhân viên** đang biên chế và hoạt động trong phòng ban.

    ### Quy tắc tra cứu:
    Hệ thống hỗ trợ tra cứu linh hoạt bằng `id` (vd: `DEP-BELL`) hoặc `code` (vd: `BELL`).
    """
    dept = await repo.get_department_by_id_or_code(department_id)
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng ban với mã định danh '{department_id}'",
        )
    return _to_department_detail(dept)


@router.patch(
    "/departments/{department_id}",
    response_model=DepartmentDetailResponse,
    tags=TAG_STAFF,
    summary="Cập nhật thông tin phòng ban",
    responses={
        200: {"description": "Cập nhật thông tin phòng ban thành công."},
        404: {"description": "Không tìm thấy phòng ban."},
    },
)
async def update_department(
    dept_in: DepartmentUpdate,
    department_id: str = Path(..., description="ID hoặc mã code phòng ban"),
    repo: StaffRepository = Depends(get_staff_repository),
):
    dept = await repo.get_department_by_id_or_code(department_id)
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng ban với mã định danh '{department_id}'",
        )

    update_data = dept_in.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"]:
        new_code = update_data["code"].strip().upper()
        if new_code != dept.code:
            existing = await repo.find_department_by_code(new_code)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Mã code phòng ban '{new_code}' đã tồn tại trong hệ thống.",
                )
            dept.code = new_code
        del update_data["code"]

    for field, val in update_data.items():
        setattr(dept, field, val)

    dept.updated_at = datetime.utcnow()
    await repo.commit()
    await repo.refresh(dept)
    return _to_department_detail(dept)


@router.delete(
    "/departments/{department_id}",
    tags=TAG_STAFF,
    summary="Vô hiệu hóa phòng ban (Soft Delete)",
    responses={
        200: {"description": "Đã vô hiệu hóa phòng ban thành công."},
        404: {"description": "Không tìm thấy phòng ban."},
    },
)
async def delete_department(
    department_id: str = Path(..., description="ID hoặc mã code phòng ban"),
    repo: StaffRepository = Depends(get_staff_repository),
):
    dept = await repo.soft_delete_department(department_id)
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng ban với mã định danh '{department_id}'",
        )

    return {
        "success": True,
        "id": dept.id,
        "code": dept.code,
        "name": dept.name,
        "is_active": dept.is_active,
        "message": f"Đã vô hiệu hóa phòng ban {dept.name}",
    }


@router.get(
    "/service-types",
    response_model=List[ServiceTypeResponse],
    tags=TAG_STAFF,
    summary="Danh mục các loại hình dịch vụ khách sạn (Service Types)",
    responses={
        200: {
            "description": "Lấy danh mục các loại hình dịch vụ khách sạn thành công.",
        }
    },
)
async def list_service_types(
    department_id: Optional[str] = Query(
        None,
        description="Lọc loại dịch vụ theo ID phòng ban (vd: `DEP-TAXI`, `DEP-HOUSEKEEPING`)",
        examples=["DEP-TAXI", "DEP-BELL"],
    ),
    is_active: Optional[bool] = Query(
        True,
        description="Lọc theo trạng thái hoạt động: `true` (đang cung cấp), `false` (tạm ngưng), `null` (tất cả)",
    ),
    repo: StaffRepository = Depends(get_staff_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn danh mục các loại dịch vụ (`ServiceType`) hỗ trợ khách hàng.
    Mỗi yêu cầu trợ giúp (`SupportRequest`) từ khách gửi qua Concierge Robot hoặc Web App sẽ gắn với 1 `ServiceType`.

    ### Các mã dịch vụ tiêu chuẩn:
    - **ST-TAXI** (`TAXI`): Dịch vụ Đặt xe & Taxi di chuyển -> Thuộc `DEP-TAXI`
    - **ST-HOUSEKEEPING** (`HOUSEKEEPING`): Dịch vụ Buồng phòng & Đồ dùng -> Thuộc `DEP-HOUSEKEEPING`
    - **ST-BELL** (`BELL_SERVICE`): Dịch vụ Bellman & Vận chuyển hành lý -> Thuộc `DEP-BELL`
    - **ST-MAINTENANCE** (`MAINTENANCE`): Dịch vụ Kỹ thuật, Điện nước & Điều hòa -> Thuộc `DEP-MAINTENANCE`
    - **ST-RECEPTION** (`RECEPTION`): Dịch vụ Lễ tân & Đặt phòng -> Thuộc `DEP-RECEPTION`
    - **ST-CONCIERGE** (`CONCIERGE`): Dịch vụ Concierge & Live Call Hỗ trợ -> Thuộc `DEP-CONCIERGE`
    - **ST-ROOM-SERVICE** (`ROOM_SERVICE`): Dịch vụ Ẩm thực & Phục vụ phòng -> Thuộc `DEP-ROOMSERVICE`
    """
    return await repo.list_service_types(department_id=department_id, is_active=is_active)
