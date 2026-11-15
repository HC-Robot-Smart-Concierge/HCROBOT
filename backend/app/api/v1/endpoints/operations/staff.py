import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status

from app.core.security import hash_password
from app.models import Staff, Department
from app.repositories import StaffRepository, get_staff_repository
from app.schemas.operations import (
    StaffResponse,
    StaffCreate,
    StaffUpdate,
)
from app.core.time import utc_now_naive
from .shared import TAG_STAFF

router = APIRouter()


from .staff_departments import router as staff_departments_router

router.include_router(staff_departments_router)


# =====================================================================
# 2. ACCOUNTS & DIRECTORY (QUẢN LÝ TÀI KHOẢN & NHÂN SỰ KHÁCH SẠN)
# =====================================================================

@router.get(
    "/accounts",
    response_model=List[StaffResponse],
    tags=TAG_STAFF,
    summary="Xem tất cả tài khoản",
    responses={
        200: {
            "description": "Lấy danh sách tài khoản thành công.",
        }
    },
)
@router.get(
    "/staff",
    response_model=List[StaffResponse],
    include_in_schema=False,
)
async def list_staff(
    department_id: Optional[str] = Query(
        None,
        description="Lọc theo mã phòng ban chuẩn (vd: `DEP-HOUSEKEEPING`, `DEP-BELL`, `DEP-TAXI`, `DEP-MAINTENANCE`, `DEP-RECEPTION`, `DEP-ROOMSERVICE`, `DEP-KITCHEN`)",
        examples=["DEP-HOUSEKEEPING", "DEP-BELL"],
    ),
    department: Optional[str] = Query(
        None,
        description="Lọc theo tên phòng ban hiển thị (vd: `Housekeeping`, `Bell Services`, `F&B`, `Maintenance`, `Reception`)",
        examples=["Housekeeping", "Bell Services"],
    ),
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Lọc theo trạng thái trực: `available` (sẵn sàng), `busy` (đang bận), `off_shift` (hết ca)",
        examples=["available", "busy"],
    ),
    role: Optional[str] = Query(
        None,
        description="Lọc theo chức danh / vai trò tài khoản",
        examples=["Housekeeping Lead", "Bell Captain"],
    ),
    include_inactive: bool = Query(
        False,
        description="Nếu chọn `true`, sẽ bao gồm cả các tài khoản đã bị vô hiệu hóa hoặc xóa mềm",
    ),
    repo: StaffRepository = Depends(get_staff_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn danh bạ tài khoản nhân sự toàn khách sạn, tích hợp liên kết trực tiếp với bảng `departments`.

    ### Tính năng bộ lọc:
    - **department_id**: Lọc chính xác theo khóa ngoại phòng ban.
    - **department**: Lọc tương thích ngược theo tên chuỗi phòng ban.
    - **status**: Lọc theo ca trực / tính sẵn sàng tiếp nhận công việc.
    - **role**: Lọc theo vị trí nghiệp vụ.
    - **include_inactive**: Lấy cả tài khoản đã xóa mềm để phục vụ đối soát kiểm toán (Audit).
    """
    return await repo.list_staff(
        department_id=department_id,
        department=department,
        status=status_filter,
        role=role,
        include_inactive=include_inactive,
    )


@router.post(
    "/accounts",
    response_model=StaffResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_STAFF,
    summary="Thêm mới tài khoản vào hệ thống",
    responses={
        201: {"description": "Tạo tài khoản mới thành công."},
        400: {"description": "Tên đăng nhập đã tồn tại hoặc mã phòng ban không hợp lệ."},
    },
)
@router.post(
    "/staff",
    response_model=StaffResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def create_staff(
    staff_in: StaffCreate,
    repo: StaffRepository = Depends(get_staff_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Tạo mới một tài khoản nhân sự trong hệ thống và phân bổ vào đúng phòng ban vận hành.

    ### Quy tắc xử lý tự động:
    1. **Kiểm tra trùng Username**: `username` được chuẩn hóa viết thường, không được trùng với bất kỳ tài khoản nào khác.
    2. **Tự động ánh xạ Phòng ban (Department Resolution)**:
       - Nếu truyền `department_id` (vd: `DEP-HOUSEKEEPING`): Kiểm tra tính hợp lệ trong bảng `departments` và tự động gắn tên phòng ban chuẩn.
       - Nếu chỉ truyền `department` (vd: `Housekeeping`): Tự động tìm kiếm phòng ban tương ứng trong database để gán `department_id`.
    3. **Tự động gán Dashboard mặc định**:
       - `DEP-RECEPTION` -> `reception`
       - `DEP-CONCIERGE` -> `concierge`
       - `DEP-ROOMSERVICE` -> `room_service`
       - `DEP-KITCHEN` -> `restaurant`
       - `DEP-FB` -> `room_service`
       - `DEP-RESTAURANT` -> `restaurant`
       - `DEP-HOUSEKEEPING` -> `housekeeping`
       - `DEP-BELL` hoặc `DEP-TAXI` -> `bell_services`
       - `DEP-MAINTENANCE` -> `maintenance`
       - Role Quản trị viên (`ADMIN`) -> `admin_portal`
    4. **Băm mật khẩu bảo mật**: Sử dụng thuật toán Bcrypt an toàn.
    5. **Tự động sinh mã viết tắt (Code)**: Nếu để trống, hệ thống tự động sinh từ chữ cái đầu của họ tên kèm chuỗi hex ngẫu nhiên.
    """
    username_clean = staff_in.username.strip().lower()
    existing = await repo.get_by_username(username_clean)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tên đăng nhập '{username_clean}' đã tồn tại trong hệ thống. Vui lòng chọn tên khác.",
        )

    # 1. Phân giải department_id và tên department
    resolved_dept_id: Optional[str] = staff_in.department_id
    resolved_dept_name: str = staff_in.department or "General"

    if resolved_dept_id:
        dept = await repo.get_department_by_id_or_code(resolved_dept_id)
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mã phòng ban (department_id) '{resolved_dept_id}' không tồn tại. Vui lòng chọn trong: DEP-HOUSEKEEPING, DEP-BELL, DEP-TAXI, DEP-MAINTENANCE, DEP-RECEPTION, DEP-CONCIERGE, DEP-ROOMSERVICE, DEP-KITCHEN.",
            )
        resolved_dept_name = dept.name
    elif staff_in.department:
        dept = await repo.find_department_by_name_or_code(staff_in.department)
        if dept:
            resolved_dept_id = dept.id
            resolved_dept_name = dept.name

    # 2. Tự động sinh dashboard phù hợp
    dashboard_map = {
        "DEP-RECEPTION": "reception",
        "DEP-CONCIERGE": "concierge",
        "DEP-ROOMSERVICE": "room_service",
        "DEP-KITCHEN": "restaurant",
        "DEP-FB": "room_service",
        "DEP-RESTAURANT": "restaurant",
        "DEP-HOUSEKEEPING": "housekeeping",
        "DEP-BELL": "bell_services",
        "DEP-TAXI": "bell_services",
        "DEP-MAINTENANCE": "maintenance",
        "DEP-EXECUTIVE": "admin_portal",
    }
    default_dashboard = dashboard_map.get(resolved_dept_id or "", "room_service")
    if "admin" in (staff_in.role or "").lower():
        default_dashboard = "admin_portal"

    # 3. Tự động sinh mã nhân viên nếu chưa có
    code = staff_in.code
    if not code:
        parts = staff_in.full_name.strip().split()
        initials = "".join(p[0].upper() for p in parts[:2]) if parts else "ST"
        code = f"{initials}{uuid.uuid4().hex[:4].upper()}"

    new_staff = Staff(
        username=username_clean,
        password_hash=hash_password(staff_in.password),
        code=code,
        full_name=staff_in.full_name.strip(),
        role=staff_in.role.strip(),
        department_id=resolved_dept_id,
        department=resolved_dept_name,
        default_dashboard=default_dashboard,
        email=staff_in.email or f"{username_clean}@aurora.hotel",
        phone=staff_in.phone or "+84 90 123 4567",
        location=staff_in.location or "Main Hotel",
        status=staff_in.status or "available",
        avatar_url=staff_in.avatar_url,
        is_fallback_agent=staff_in.is_fallback_agent,
        is_active=True,
    )
    try:
        await repo.create(new_staff, autocommit=True)
        # Load relationship để serialize đầy đủ
        await repo.refresh(new_staff, attribute_names=["department_rel"])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể tạo tài khoản nhân viên: {e}",
        )
    return new_staff


@router.get(
    "/accounts/{account_id}",
    response_model=StaffResponse,
    tags=TAG_STAFF,
    summary="Xem thông tin chi tiết một tài khoản theo ID",
    responses={
        200: {"description": "Thông tin chi tiết hồ sơ tài khoản."},
        404: {"description": "Không tìm thấy tài khoản với ID được cung cấp."},
    },
)
@router.get(
    "/staff/{account_id}",
    response_model=StaffResponse,
    include_in_schema=False,
)
async def get_staff_detail(
    account_id: str = Path(
        ...,
        description="Mã định danh duy nhất của tài khoản (vd: `ACC-f9ab1b15`)",
        examples=["ACC-f9ab1b15", "STF-f9ab1b15"],
    ),
    repo: StaffRepository = Depends(get_staff_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn hồ sơ chi tiết của một tài khoản bằng `id`.
    Trả về đầy đủ thông tin tài khoản, phòng ban, ca trực, phạm vi tầng phân công và cấu hình liên lạc.
    """
    staff = await repo.get_by_id(account_id, load_department=True)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài khoản với ID: {account_id}",
        )
    return staff


@router.patch(
    "/accounts/{account_id}",
    response_model=StaffResponse,
    tags=TAG_STAFF,
    summary="Cập nhật thông tin hồ sơ tài khoản",
    responses={
        200: {"description": "Cập nhật thông tin tài khoản thành công."},
        400: {"description": "Mã phòng ban mới không hợp lệ."},
        404: {"description": "Không tìm thấy tài khoản với ID được cung cấp."},
    },
)
@router.patch(
    "/staff/{account_id}",
    response_model=StaffResponse,
    include_in_schema=False,
)
async def update_staff(
    update_in: StaffUpdate,
    account_id: str = Path(
        ...,
        description="Mã định danh duy nhất của tài khoản cần cập nhật",
        examples=["ACC-f9ab1b15", "STF-f9ab1b15"],
    ),
    repo: StaffRepository = Depends(get_staff_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Cập nhật một phần hoặc toàn bộ thông tin hồ sơ của tài khoản (PATCH partial update).

    ### Các trường hỗ trợ cập nhật:
    - `full_name`: Họ tên hiển thị
    - `role`: Chức vụ chuyên môn
    - `department_id`: Chuyển phòng ban (vd: `DEP-BELL` sang `DEP-TAXI`). Hệ thống tự động xác thực và đồng bộ tên phòng ban.
    - `status`: Cập nhật trạng thái trực (`available`, `busy`, `off_shift`, `inactive`)
    - `phone`, `email`, `location`: Thông tin liên lạc và vị trí làm việc
    - `avatar_url`: Ảnh đại diện
    - `is_fallback_agent`: Cấu hình tiếp nhận cuộc gọi khẩn chuyển tiếp từ Concierge Robot
    """
    staff = await repo.get_by_id(account_id, load_department=True)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài khoản với ID: {account_id}",
        )

    update_data = update_in.model_dump(exclude_unset=True)

    # Xử lý cập nhật phòng ban
    if "department_id" in update_data:
        new_dept_id = update_data["department_id"]
        if new_dept_id:
            dept = await repo.get_department_by_id_or_code(new_dept_id)
            if not dept:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Mã phòng ban '{new_dept_id}' không tồn tại trong hệ thống.",
                )
            staff.department_id = dept.id
            if "department" not in update_data:
                staff.department = dept.name
        else:
            staff.department_id = None
        del update_data["department_id"]
        if "department" in update_data:
            staff.department = update_data.pop("department")

    elif "department" in update_data:
        d_name = (update_data.pop("department") or "").strip()
        if d_name:
            dept = await repo.find_department_by_name_or_code(d_name)
            if dept:
                staff.department_id = dept.id
                staff.department = dept.name
            else:
                staff.department = d_name

    # Cập nhật các trường còn lại
    for field, value in update_data.items():
        setattr(staff, field, value)

    staff.updated_at = utc_now_naive()
    await repo.commit()
    await repo.refresh(staff)
    await repo.refresh(staff, attribute_names=["department_rel"])
    return staff


@router.delete(
    "/accounts/{account_id}",
    tags=TAG_STAFF,
    summary="Vô hiệu hóa tài khoản (Soft Delete)",
    responses={
        200: {"description": "Đã vô hiệu hóa tài khoản thành công."},
        404: {"description": "Không tìm thấy tài khoản với ID được cung cấp."},
    },
)
@router.delete(
    "/staff/{account_id}",
    include_in_schema=False,
)
async def delete_staff(
    account_id: str = Path(
        ...,
        description="Mã định danh duy nhất của tài khoản cần vô hiệu hóa",
        examples=["ACC-f9ab1b15", "STF-f9ab1b15"],
    ),
    repo: StaffRepository = Depends(get_staff_repository),
):
    """
    ### Mô tả nghiệp vụ:
    Thực hiện **xóa mềm (Soft Delete)** tài khoản trong hệ thống:
    - Đặt cờ `is_active = False`
    - Cập nhật trạng thái `status = 'inactive'`
    - Không xóa vĩnh viễn dòng dữ liệu trong cơ sở dữ liệu để bảo toàn toàn vẹn khóa ngoại các đơn hàng (`RoomServiceOrder`) và yêu cầu trợ giúp (`SupportRequest`) mà tài khoản này đã xử lý trước đó.
    """
    staff = await repo.soft_delete_staff(account_id)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài khoản với ID: {account_id}",
        )

    return {
        "success": True,
        "id": account_id,
        "full_name": staff.full_name,
        "is_active": staff.is_active,
        "status": staff.status,
        "message": f"Đã vô hiệu hóa thành công tài khoản {staff.full_name}",
    }
