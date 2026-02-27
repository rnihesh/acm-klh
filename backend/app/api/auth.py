import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

from app.core.auth import (
    authenticate_user,
    create_access_token,
    create_user,
    get_current_user,
)

router = APIRouter()

GSTIN_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


class RegisterRequest(BaseModel):
    username: str
    password: str
    gstin: str
    company_name: str

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, v: str) -> str:
        if not GSTIN_PATTERN.match(v):
            raise ValueError("Invalid GSTIN format")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/register")
def register(req: RegisterRequest):
    user = create_user(req.username, req.password, req.gstin, req.company_name)
    token = create_access_token({"sub": user["username"]})
    return {"token": token, "user": user}


@router.post("/login")
def login(req: LoginRequest):
    user = authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_access_token({"sub": user["username"]})
    return {"token": token, "user": user}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user
