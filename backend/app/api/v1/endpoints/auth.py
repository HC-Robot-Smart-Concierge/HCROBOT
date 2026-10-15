from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header

from app.core.security import verify_password, hash_password, create_access_token, decode_access_token
from app.models.staff import Staff
from app.repositories import StaffRepository, get_staff_repository
from app.services.logger_service import audit, log_event, LogLevelEnum, LogCategoryEnum, ActorTypeEnum
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserAuthProfile,
    ChangePasswordRequest,
    ProfileUpdateRequest,
    LogoutResponse,
)

router = APIRouter()


USERNAME_ALIASES = {
    "room_service": "roomservice",
    "room-service": "roomservice",
    "room service": "roomservice",
    "f&b": "roomservice",
    "fb": "roomservice",
    "bellservices": "bellman",
    "bell_services": "bellman",
    "bell-services": "bellman",
    "bell services": "bellman",
    "bellservice": "bellman",
    "bell": "bellman",
    "house_keeping": "housekeeping",
    "house-keeping": "housekeeping",
    "house keeping": "housekeeping",
    "buongphong": "housekeeping",
    "receptionist": "reception",
    "frontdesk": "reception",
    "front_desk": "reception",
    "maintain": "maintenance",
    "kythuat": "maintenance",
    "ky_thuat": "maintenance",
    "administrator": "admin",
    "nhahang": "restaurant",
    "nha_hang": "restaurant",
    "nha hang": "restaurant",
    "datxe": "taxi",
    "dat_xe": "taxi",
    "dat xe": "taxi",
    "transport": "taxi",
    "transportation": "taxi",
    "livecall": "concierge",
    "live_call": "concierge",
    "troly": "concierge",
    "bep": "kitchen",
    "nha_bep": "kitchen",
    "nhabep": "kitchen",
    "chef": "kitchen",
}


def resolve_dashboard_for_staff(staff: Staff) -> str:
    """Ensures staff account is strictly mapped to their operational department dashboard."""
    role_lower = (staff.role or "").lower()
    username_lower = (staff.username or "").lower()
    if role_lower == "admin" or username_lower == "admin":
        return "admin_portal"
    if "robot" in role_lower or username_lower.startswith("robot"):
        return "robot_display"

    dept_lower = (staff.department or "").lower()
    if "housekeeping" in dept_lower or "buồng" in dept_lower or "housekeeping" in username_lower:
        return "housekeeping"
    if "reception" in dept_lower or "lễ tân" in dept_lower or "front" in dept_lower or "reception" in username_lower:
        return "reception"
    if "bell" in dept_lower or "hành lý" in dept_lower or "bell" in username_lower:
        return "bell_services"
    if "maint" in dept_lower or "kỹ thuật" in dept_lower or "maintenance" in username_lower:
        return "maintenance"
    if "kitchen" in dept_lower or "bếp" in dept_lower or "chef" in dept_lower or "kitchen" in username_lower:
        return "kitchen"
    if "concierge" in dept_lower or "trợ lý" in dept_lower or "taxi" in dept_lower or "concierge" in username_lower or "taxi" in username_lower:
        return "concierge"
    if "room" in dept_lower or "phục vụ" in dept_lower or "f&b" in dept_lower or "roomservice" in username_lower:
        return "room_service"

    if staff.default_dashboard and staff.default_dashboard != "room_service":
        return staff.default_dashboard

    return "reception"


@router.post("/login", response_model=TokenResponse)
async def login(
    login_in: LoginRequest,
    repo: StaffRepository = Depends(get_staff_repository),
):
    """Authenticates staff member with username & password, returns JWT token with assigned role & dashboard."""
    username_clean = login_in.username.strip().lower()
    username_clean = USERNAME_ALIASES.get(username_clean, username_clean)

    # 1. Query staff by username via repository
    staff = await repo.get_by_username(username_clean)

    # 2. Check credentials against DB
    if not staff or not verify_password(login_in.password, staff.password_hash):
        log_event(
            level=LogLevelEnum.WARNING,
            category=LogCategoryEnum.AUDIT,
            event_type="LOGIN_FAILED",
            module="app.api.v1.auth",
            message=f"Failed login attempt for username '{username_clean}'",
            actor_type=ActorTypeEnum.SYSTEM,
            actor_id=username_clean,
            metadata={"username": username_clean, "reason": "Invalid credentials"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2.1 Check if staff account is active
    if staff.is_active is False or (staff.status and staff.status.lower() in ["inactive", "deleted"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản này đã bị vô hiệu hóa (xóa mềm). Vui lòng liên hệ Quản trị viên.",
        )

    # Record successful login audit
    audit(
        action="LOGIN",
        resource_type="SESSION",
        resource_id=f"user_{staff.id}",
        actor_type=ActorTypeEnum.ADMIN if staff.role == "Admin" else ActorTypeEnum.STAFF,
        actor_id=staff.username,
        actor_name=staff.full_name,
        after_state={"role": staff.role, "department": staff.department},
    )

    # 3. Create JWT Token
    resolved_dashboard = resolve_dashboard_for_staff(staff)
    token_payload = {
        "sub": staff.id,
        "username": staff.username,
        "role": staff.role,
        "department": staff.department,
        "default_dashboard": resolved_dashboard,
    }
    token = create_access_token(data=token_payload)

    user_profile = UserAuthProfile(
        id=staff.id,
        username=staff.username,
        code=staff.code,
        full_name=staff.full_name,
        role=staff.role,
        department=staff.department,
        default_dashboard=resolved_dashboard,
        location=staff.location,
        status=staff.status,
        avatar_url=staff.avatar_url,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=user_profile,
        target_dashboard=resolved_dashboard,
    )


@router.get("/me", response_model=UserAuthProfile)
async def get_current_user(
    authorization: str = Header(None),
    repo: StaffRepository = Depends(get_staff_repository),
):
    """Returns current user details decoded from Bearer JWT token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Bearer token",
        )

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload["sub"]
    staff = await repo.get_by_id(user_id)
    if not staff:
        raise HTTPException(status_code=404, detail="User not found")

    user_profile = UserAuthProfile.model_validate(staff)
    user_profile.default_dashboard = resolve_dashboard_for_staff(staff)
    return user_profile


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    authorization: str = Header(None),
    repo: StaffRepository = Depends(get_staff_repository),
):
    """Changes staff user password and updates password_hash in database."""
    staff = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            staff = await repo.get_by_id(payload["sub"])

    if not staff and req.username:
        staff = await repo.get_by_username(req.username.strip().lower())

    if not staff:
        raise HTTPException(status_code=404, detail="Staff account not found")

    if not verify_password(req.current_password, staff.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không chính xác")

    staff.password_hash = hash_password(req.new_password)
    await repo.commit()
    return {"message": "Mật khẩu đã được cập nhật thành công trong cơ sở dữ liệu!"}


@router.patch("/profile", response_model=UserAuthProfile)
async def update_profile(
    req: ProfileUpdateRequest,
    authorization: str = Header(None),
    repo: StaffRepository = Depends(get_staff_repository),
):
    """Updates staff profile details in database."""
    staff = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            staff = await repo.get_by_id(payload["sub"])

    if not staff and req.username:
        staff = await repo.get_by_username(req.username.strip().lower())

    if not staff:
        if req.code:
            staff = await repo.get_by_code(req.code)

    if not staff:
        raise HTTPException(status_code=404, detail="Staff account not found")

    if req.full_name is not None:
        staff.full_name = req.full_name
    if req.role is not None:
        staff.role = req.role
    if req.code is not None:
        staff.code = req.code
    if req.department is not None:
        staff.department = req.department
    if req.avatar_url is not None:
        staff.avatar_url = req.avatar_url
    if req.status is not None:
        staff.status = req.status
    if req.location is not None:
        staff.location = req.location

    await repo.commit()
    await repo.refresh(staff)
    return UserAuthProfile.model_validate(staff)


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    authorization: Optional[str] = Header(None),
    repo: StaffRepository = Depends(get_staff_repository),
):
    """
    Logs out the current staff user.
    Records audit trail and session termination event in database.
    Always succeeds gracefully so the client can clear its local session cleanly.
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            user_id = payload["sub"]
            staff = await repo.get_by_id(user_id)
            if staff:
                # 1. Ghi log audit hệ thống
                audit(
                    action="LOGOUT",
                    resource_type="SESSION",
                    resource_id=f"user_{staff.id}",
                    actor_type=ActorTypeEnum.ADMIN if staff.role == "Admin" else ActorTypeEnum.STAFF,
                    actor_id=staff.username,
                    actor_name=staff.full_name,
                    after_state={"status": "logged_out"},
                )
                return LogoutResponse(
                    message=f"Đăng xuất tài khoản {staff.username} thành công.",
                    success=True,
                )

    return LogoutResponse(message="Đăng xuất phiên làm việc thành công.", success=True)
