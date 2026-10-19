from datetime import datetime
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status

from app.core.security import hash_password
from app.models import Staff, Department, ServiceType
from app.repositories import StaffRepository, get_staff_repository
from app.schemas.operations import (
    StaffResponse,
    StaffCreate,
    StaffUpdate,
    DepartmentResponse,
    DepartmentDetailResponse,
    DepartmentCreate,
    DepartmentUpdate,
    ServiceTypeResponse,
)
from .shared import TAG_STAFF

router = APIRouter()


# =====================================================================
# 1. DEPARTMENTS & SERVICE TYPES DIRECTORY (PHÒNG BAN & LOẠI HÌNH DỊCH VỤ)
# =====================================================================

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
    return [
        DepartmentDetailResponse(
            id=d.id,
            code=d.code,
            name=d.name,
            description=d.description,
            is_active=d.is_active,
            created_at=d.created_at,
            updated_at=d.updated_at,
            service_types=d.service_types or [],
            staff_count=sum(1 for acc in d.accounts if acc.is_active),
        )
        for d in depts
    ]


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
    return DepartmentDetailResponse(
        id=new_dept.id,
        code=new_dept.code,
        name=new_dept.name,
        description=new_dept.description,
        is_active=new_dept.is_active,
        created_at=new_dept.created_at,
        updated_at=new_dept.updated_at,
        service_types=[],
        staff_count=0,
    )


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
    department_id: str = Path(..., description="ID hoặc mã code phòng ban"),
    dept_in: DepartmentUpdate = ...,
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
    return DepartmentDetailResponse(
        id=dept.id,
        code=dept.code,
        name=dept.name,
        description=dept.description,
        is_active=dept.is_active,
        created_at=dept.created_at,
        updated_at=dept.updated_at,
        service_types=dept.service_types or [],
        staff_count=sum(1 for acc in dept.accounts if acc.is_active),
    )


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
    account_id: str = Path(
        ...,
        description="Mã định danh duy nhất của tài khoản cần cập nhật",
        examples=["ACC-f9ab1b15", "STF-f9ab1b15"],
    ),
    update_in: StaffUpdate = ...,
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

    staff.updated_at = datetime.utcnow()
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


