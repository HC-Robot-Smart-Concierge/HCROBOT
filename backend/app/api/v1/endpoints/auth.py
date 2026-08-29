from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import verify_password, hash_password, create_access_token, decode_access_token
from app.models.staff import Staff
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserAuthProfile,
    ChangePasswordRequest,
    ProfileUpdateRequest,
)

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(login_in: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticates staff member with username & password, returns JWT token with assigned role & dashboard."""
    username_clean = login_in.username.strip().lower()
    
    # 1. Query staff by username
    res = await db.execute(select(Staff).where(Staff.username == username_clean))
    staff = res.scalar_one_or_none()

    # 2. Check credentials
    if not staff or not verify_password(login_in.password, staff.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Create JWT Token
    token_payload = {
        "sub": staff.id,
        "username": staff.username,
        "role": staff.role,
        "department": staff.department,
        "default_dashboard": staff.default_dashboard,
    }
    token = create_access_token(data=token_payload)

    user_profile = UserAuthProfile(
        id=staff.id,
        username=staff.username,
        code=staff.code,
        full_name=staff.full_name,
        role=staff.role,
        department=staff.department,
        default_dashboard=staff.default_dashboard,
        location=staff.location,
        status=staff.status,
        avatar_url=staff.avatar_url,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=user_profile,
        target_dashboard=staff.default_dashboard,
    )


@router.get("/me", response_model=UserAuthProfile)
async def get_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
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
    res = await db.execute(select(Staff).where(Staff.id == user_id))
    staff = res.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="User not found")

    return UserAuthProfile.model_validate(staff)


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Changes staff user password and updates password_hash in database."""
    staff = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            res = await db.execute(select(Staff).where(Staff.id == payload["sub"]))
            staff = res.scalar_one_or_none()

    if not staff and req.username:
        res = await db.execute(select(Staff).where(Staff.username == req.username.strip().lower()))
        staff = res.scalar_one_or_none()

    if not staff:
        raise HTTPException(status_code=404, detail="Staff account not found")

    if not verify_password(req.current_password, staff.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không chính xác")

    staff.password_hash = hash_password(req.new_password)
    await db.commit()
    return {"message": "Mật khẩu đã được cập nhật thành công trong cơ sở dữ liệu!"}


@router.patch("/profile", response_model=UserAuthProfile)
async def update_profile(
    req: ProfileUpdateRequest,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Updates staff profile details in database."""
    staff = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            res = await db.execute(select(Staff).where(Staff.id == payload["sub"]))
            staff = res.scalar_one_or_none()

    if not staff and req.username:
        res = await db.execute(select(Staff).where(Staff.username == req.username.strip().lower()))
        staff = res.scalar_one_or_none()

    if not staff:
        # If still not found, try searching by code
        if req.code:
            res = await db.execute(select(Staff).where(Staff.code == req.code))
            staff = res.scalar_one_or_none()

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

    await db.commit()
    await db.refresh(staff)
    return UserAuthProfile.model_validate(staff)
