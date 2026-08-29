from typing import Optional
from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    username: str
    password: str


class UserAuthProfile(BaseModel):
    id: str
    username: str
    code: str
    full_name: str
    role: str
    department: str
    default_dashboard: str
    location: Optional[str] = "Main Hotel"
    status: Optional[str] = "available"
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserAuthProfile
    target_dashboard: str


class ChangePasswordRequest(BaseModel):
    username: Optional[str] = None
    current_password: str
    new_password: str


class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    code: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
