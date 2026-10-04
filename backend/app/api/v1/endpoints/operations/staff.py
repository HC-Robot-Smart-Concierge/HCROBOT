from datetime import datetime
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import hash_password
from app.models import Staff, Department, ServiceType
from app.schemas.operations import (
    StaffResponse,
    StaffCreate,
    StaffUpdate,
    DepartmentResponse,
    DepartmentDetailResponse,
    ServiceTypeResponse,
)
from .shared import TAG_OPS, TAG_STAFF

router = APIRouter()


# =====================================================================
# 1. DEPARTMENTS & SERVICE TYPES DIRECTORY (PHÒNG BAN & LOẠI HÌNH DỊCH VỤ)
# =====================================================================

@router.get(
    "/departments",
    response_model=List[DepartmentResponse],
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
        True,
        description="Lọc theo trạng thái hoạt động: `true` (chỉ lấy phòng ban đang mở), `false` (phòng ban ngưng), `null` (lấy tất cả)",
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn danh mục toàn bộ các bộ phận vận hành chuẩn của khách sạn (`Aurora Hotel & Resort`).

    ### Các bộ phận chuẩn trong hệ thống:
    - **DEP-HOUSEKEEPING**: Bộ phận Buồng phòng & Tiện ích vệ sinh phòng
    - **DEP-BELL**: Bộ phận Tiền sảnh, Chuông hành lý & Bellman
    - **DEP-TAXI**: Bộ phận Điều phối Taxi & Đưa đón di chuyển
    - **DEP-MAINTENANCE**: Bộ phận Kỹ thuật, Bảo trì điện nước & Điều hòa
    - **DEP-RECEPTION**: Bộ phận Lễ tân & Đặt phòng (Front Desk & Room Booking)
    - **DEP-CONCIERGE**: Bộ phận Trợ lý Concierge, Live Call & Tổng đài hỗ trợ
    - **DEP-ROOMSERVICE**: Bộ phận Phục vụ phòng (Room Service)
    - **DEP-KITCHEN**: Bộ phận Bếp & Ẩm thực (Kitchen Operations)

    ### Tham số đầu vào:
    - `is_active` (query, boolean, tùy chọn): Mặc định `true`.
    """
    query = select(Department)
    if is_active is not None:
        query = query.where(Department.is_active == is_active)
    query = query.order_by(Department.code)
    result = await db.execute(query)
    return result.scalars().all()


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
    db: AsyncSession = Depends(get_db),
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
    target = department_id.strip()
    query = (
        select(Department)
        .options(
            selectinload(Department.service_types),
            selectinload(Department.accounts),
        )
        .where(or_(Department.id == target, Department.code == target.upper()))
    )
    result = await db.execute(query)
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng ban với mã định danh '{department_id}'",
        )

    # Đếm số lượng nhân sự active
    staff_count = sum(1 for acc in dept.accounts if acc.is_active)
    
    # Map sang schema response
    return DepartmentDetailResponse(
        id=dept.id,
        code=dept.code,
        name=dept.name,
        description=dept.description,
        is_active=dept.is_active,
        created_at=dept.created_at,
        updated_at=dept.updated_at,
        service_types=dept.service_types,
        staff_count=staff_count,
    )


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
    db: AsyncSession = Depends(get_db),
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
    query = select(ServiceType).options(selectinload(ServiceType.department))
    if department_id:
        query = query.where(ServiceType.department_id == department_id.strip())
    if is_active is not None:
        query = query.where(ServiceType.is_active == is_active)
    query = query.order_by(ServiceType.code)
    result = await db.execute(query)
    return result.scalars().all()


# =====================================================================
# 2. STAFF & ACCOUNT DIRECTORY (QUẢN LÝ NHÂN SỰ & TÀI KHOẢN KHÁCH SẠN)
# =====================================================================

@router.get(
    "/staff",
    response_model=List[StaffResponse],
    tags=TAG_STAFF,
    summary="Danh sách nhân sự khách sạn (hỗ trợ lọc theo phòng ban & trạng thái)",
    responses={
        200: {
            "description": "Lấy danh sách nhân sự thành công.",
        }
    },
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
    status: Optional[str] = Query(
        None,
        description="Lọc theo trạng thái trực: `available` (sẵn sàng), `busy` (đang bận), `off_shift` (hết ca)",
        examples=["available", "busy"],
    ),
    role: Optional[str] = Query(
        None,
        description="Lọc theo chức danh / vai trò nhân viên",
        examples=["Housekeeping Lead", "Bell Captain"],
    ),
    include_inactive: bool = Query(
        False,
        description="Nếu chọn `true`, sẽ bao gồm cả các tài khoản nhân viên đã bị vô hiệu hóa hoặc xóa mềm",
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn danh bạ nhân sự toàn khách sạn, tích hợp liên kết trực tiếp với bảng `departments`.
    
    ### Tính năng bộ lọc:
    - **department_id**: Lọc chính xác theo khóa ngoại phòng ban.
    - **department**: Lọc tương thích ngược theo tên chuỗi phòng ban.
    - **status**: Lọc theo ca trực / tính sẵn sàng tiếp nhận công việc.
    - **role**: Lọc theo vị trí nghiệp vụ.
    - **include_inactive**: Lấy cả nhân viên đã xóa mềm để phục vụ đối soát kiểm toán (Audit).
    """
    query = select(Staff).options(selectinload(Staff.department_rel))
    
    if not include_inactive:
        query = query.where(
            Staff.is_active == True,
            Staff.status != "deleted",
            Staff.status != "inactive",
        )
    if department_id and department_id not in ("All", ""):
        query = query.where(Staff.department_id == department_id.strip())
    elif department and department not in ("All", ""):
        query = query.where(Staff.department == department.strip())
    if status and status not in ("All", ""):
        query = query.where(Staff.status == status.strip())
    if role and role not in ("All", ""):
        query = query.where(Staff.role == role.strip())

    query = query.order_by(Staff.department_id, Staff.department, Staff.full_name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get(
    "/staff/{staff_id}",
    response_model=StaffResponse,
    tags=TAG_STAFF,
    summary="Xem thông tin chi tiết một nhân viên theo ID",
    responses={
        200: {"description": "Thông tin chi tiết hồ sơ nhân sự."},
        404: {"description": "Không tìm thấy nhân viên với ID được cung cấp."},
    },
)
async def get_staff_detail(
    staff_id: str = Path(
        ...,
        description="Mã định danh duy nhất của nhân viên (vd: `STF-f9ab1b15`)",
        examples=["STF-f9ab1b15", "STF-cda7e68e"],
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Truy vấn hồ sơ chi tiết của một nhân viên bằng `id`.
    Trả về đầy đủ thông tin tài khoản, phòng ban, ca trực, phạm vi tầng phân công và cấu hình liên lạc.
    """
    query = (
        select(Staff)
        .options(selectinload(Staff.department_rel))
        .where(Staff.id == staff_id.strip())
    )
    result = await db.execute(query)
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy nhân viên với ID: {staff_id}",
        )
    return staff


@router.post(
    "/staff",
    response_model=StaffResponse,
    status_code=status.HTTP_201_CREATED,
    tags=TAG_STAFF,
    summary="Thêm mới nhân viên vào hệ thống",
    responses={
        201: {"description": "Tạo tài khoản nhân viên mới thành công."},
        400: {"description": "Tên đăng nhập đã tồn tại hoặc mã phòng ban không hợp lệ."},
    },
)
async def create_staff(
    staff_in: StaffCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Tạo mới một tài khoản nhân viên trong hệ thống và phân bổ vào đúng phòng ban vận hành.

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
       - `DEP-HOUSEKEEPING` -> `housekeeping`
       - `DEP-BELL` hoặc `DEP-TAXI` -> `bell_services`
       - `DEP-MAINTENANCE` -> `maintenance`
       - Role Quản trị viên (`ADMIN`) -> `admin_map`
    4. **Băm mật khẩu bảo mật**: Sử dụng thuật toán Bcrypt an toàn.
    5. **Tự động sinh mã viết tắt (Code)**: Nếu để trống, hệ thống tự động sinh từ chữ cái đầu của họ tên kèm chuỗi hex ngẫu nhiên.
    """
    username_clean = staff_in.username.strip().lower()
    existing = await db.execute(select(Staff).where(Staff.username == username_clean))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tên đăng nhập '{username_clean}' đã tồn tại trong hệ thống. Vui lòng chọn tên khác.",
        )

    # 1. Phân giải department_id và tên department
    resolved_dept_id: Optional[str] = staff_in.department_id
    resolved_dept_name: str = staff_in.department or "General"

    if resolved_dept_id:
        dept_res = await db.execute(select(Department).where(Department.id == resolved_dept_id.strip()))
        dept = dept_res.scalar_one_or_none()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mã phòng ban (department_id) '{resolved_dept_id}' không tồn tại. Vui lòng chọn trong: DEP-HOUSEKEEPING, DEP-BELL, DEP-TAXI, DEP-MAINTENANCE, DEP-RECEPTION, DEP-CONCIERGE, DEP-ROOMSERVICE, DEP-KITCHEN.",
            )
        resolved_dept_name = dept.name
    elif staff_in.department:
        # Tra cứu theo tên hoặc mã code tương ứng
        d_name = staff_in.department.strip().lower()
        dept_res = await db.execute(
            select(Department).where(
                or_(
                    func.lower(Department.name).like(f"%{d_name}%"),
                    func.lower(Department.code) == d_name,
                )
            )
        )
        dept = dept_res.scalar_one_or_none()
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
    }
    default_dashboard = dashboard_map.get(resolved_dept_id, "room_service")
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
        shift=staff_in.shift or "Morning Shift (06:00 - 14:00)",
        location=staff_in.location or "Main Hotel",
        status=staff_in.status or "available",
        avatar_url=staff_in.avatar_url,
        is_fallback_agent=staff_in.is_fallback_agent,
        assigned_floors=staff_in.assigned_floors or "Floor 1 - 5",
        notification_channels=staff_in.notification_channels or "Web Dashboard, Tablet Alert",
        is_active=True,
    )
    db.add(new_staff)
    try:
        await db.commit()
        await db.refresh(new_staff)
        # Load relationship để serialize đầy đủ
        await db.refresh(new_staff, attribute_names=["department_rel"])
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể tạo tài khoản nhân viên: {e}",
        )
    return new_staff


@router.get("/staff/departments", tags=TAG_STAFF, summary="Danh sách các phòng ban khách sạn")
async def list_staff_departments(db: AsyncSession = Depends(get_db)):
    """Lấy danh sách các phòng ban trực thuộc khách sạn."""
    from app.models.department import Department
    res = await db.execute(select(Department).where(Department.is_active == True))
    deps = res.scalars().all()
    return [{"id": d.id, "code": d.code, "name": d.name, "description": d.description} for d in deps]




@router.patch(
    "/staff/{staff_id}",
    response_model=StaffResponse,
    tags=TAG_STAFF,
    summary="Cập nhật thông tin hồ sơ nhân viên",
    responses={
        200: {"description": "Cập nhật thông tin nhân viên thành công."},
        400: {"description": "Mã phòng ban mới không hợp lệ."},
        404: {"description": "Không tìm thấy nhân viên với ID được cung cấp."},
    },
)

async def update_staff(
    staff_id: str = Path(
        ...,
        description="Mã định danh duy nhất của nhân viên cần cập nhật",
        examples=["STF-f9ab1b15"],
    ),
    update_in: StaffUpdate = ...,
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Cập nhật một phần hoặc toàn bộ thông tin hồ sơ của nhân viên (PATCH partial update).

    ### Các trường hỗ trợ cập nhật:
    - `full_name`: Họ tên hiển thị
    - `role`: Chức vụ chuyên môn
    - `department_id`: Chuyển phòng ban (vd: `DEP-BELL` sang `DEP-TAXI`). Hệ thống tự động xác thực và đồng bộ tên phòng ban.
    - `status`: Cập nhật trạng thái trực (`available`, `busy`, `off_shift`, `inactive`)
    - `phone`, `email`, `shift`, `location`: Thông tin ca trực và liên lạc
    - `avatar_url`: Ảnh đại diện
    - `is_fallback_agent`: Cấu hình tiếp nhận cuộc gọi khẩn chuyển tiếp từ Concierge Robot
    - `assigned_floors`, `notification_channels`: Phạm vi tầng phụ trách và kênh nhận tin
    """
    query = (
        select(Staff)
        .options(selectinload(Staff.department_rel))
        .where(Staff.id == staff_id.strip())
    )
    result = await db.execute(query)
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy nhân viên với ID: {staff_id}",
        )

    update_data = update_in.model_dump(exclude_unset=True)

    # Xử lý cập nhật phòng ban
    if "department_id" in update_data:
        new_dept_id = update_data["department_id"]
        if new_dept_id:
            dept_res = await db.execute(select(Department).where(Department.id == new_dept_id.strip()))
            dept = dept_res.scalar_one_or_none()
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
        # Nếu chỉ cập nhật tên phòng ban, cố gắng suy ra department_id
        d_name = (update_data.pop("department") or "").strip().lower()
        if d_name:
            dept_res = await db.execute(
                select(Department).where(
                    or_(
                        func.lower(Department.name).like(f"%{d_name}%"),
                        func.lower(Department.code) == d_name,
                    )
                )
            )
            dept = dept_res.scalar_one_or_none()
            if dept:
                staff.department_id = dept.id
                staff.department = dept.name
            else:
                staff.department = d_name

    # Cập nhật các trường còn lại
    for field, value in update_data.items():
        setattr(staff, field, value)

    staff.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(staff)
    await db.refresh(staff, attribute_names=["department_rel"])
    return staff


@router.delete(
    "/staff/{staff_id}",
    tags=TAG_STAFF,
    summary="Vô hiệu hóa tài khoản nhân viên (Soft Delete)",
    responses={
        200: {"description": "Đã vô hiệu hóa tài khoản nhân viên thành công."},
        404: {"description": "Không tìm thấy nhân viên với ID được cung cấp."},
    },
)
async def delete_staff(
    staff_id: str = Path(
        ...,
        description="Mã định danh duy nhất của nhân viên cần vô hiệu hóa",
        examples=["STF-f9ab1b15"],
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    ### Mô tả nghiệp vụ:
    Thực hiện **xóa mềm (Soft Delete)** tài khoản nhân viên trong hệ thống:
    - Đặt cờ `is_active = False`
    - Cập nhật trạng thái `status = 'inactive'`
    - Không xóa vĩnh viễn dòng dữ liệu trong cơ sở dữ liệu để bảo toàn toàn vẹn khóa ngoại các đơn hàng (`RoomServiceOrder`) và yêu cầu trợ giúp (`SupportRequest`) mà nhân viên này đã xử lý trước đó.
    """
    result = await db.execute(select(Staff).where(Staff.id == staff_id.strip()))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy nhân viên với ID: {staff_id}",
        )

    staff.is_active = False
    staff.status = "inactive"
    staff.updated_at = datetime.utcnow()
    await db.commit()
    return {
        "success": True,
        "id": staff_id,
        "full_name": staff.full_name,
        "is_active": staff.is_active,
        "status": staff.status,
        "message": f"Đã vô hiệu hóa thành công tài khoản nhân viên {staff.full_name}",
    }


# =====================================================================
# 3. ROBOT FLEET STATUS (ĐỘI ROBOT HỆ THỐNG)
# =====================================================================

@router.get(
    "/fleet",
    response_model=List[dict],
    tags=TAG_OPS,
    summary="Danh sách trạng thái đội Robot HCRobot",
)
async def get_robot_fleet():
    """
    Trả về danh sách trạng thái thời gian thực của các Robot tự hành HCRobot đang trực tuyến.
    """
    return []
