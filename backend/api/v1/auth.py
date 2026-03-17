"""
Authentication routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Form, Request
import secrets
from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import re

from core.database import get_db
from core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    get_current_active_user,
    validate_password_strength,
    build_token_data,
)
from core.validators import validate_email, sanitize_string
from core.permissions import require_super_admin
from core.responses import SuccessResponse, ErrorResponse
from models.user import User, UserRole
from schemas.auth import TokenResponse, UserCreate, UserResponse, SignUpCreate, SetPasswordRequest
from models.employee import Employee
from models.company import Company
from core.config import settings
from datetime import date, datetime, timezone

router = APIRouter()


@router.post("/test-email")
async def test_email(to_email: str, current_user: User = Depends(require_super_admin)):
    """Send a test email - for debugging SMTP. Admin only."""
    """Send a test email - for debugging SMTP. Requires auth."""
    from core.email import send_email
    success = send_email(
        to_email=to_email,
        subject="LeaveHub Test Email",
        body_html="<p>If you receive this, SMTP is working.</p>",
        body_text="If you receive this, SMTP is working.",
    )
    if success:
        return {"success": True, "message": "Test email sent"}
    return {"success": False, "message": "Failed to send (check backend logs)"}


@router.post("/signup", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def signup(signup_data: SignUpCreate, db: AsyncSession = Depends(get_db)):
    """Create account - First name, Last name, Company name, Company email, Password"""
    # Validate email format
    if not validate_email(signup_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
    
    # Validate password strength
    is_valid, error_msg = validate_password_strength(signup_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    email = sanitize_string(signup_data.email.lower())
    
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create username from email (before @)
    base_username = sanitize_string(email.split("@")[0].replace(".", "_")[:30])
    username = base_username
    counter = 1
    while True:
        result = await db.execute(select(User).where(User.username == username))
        if not result.scalar_one_or_none():
            break
        username = f"{base_username}{counter}"
        counter += 1
    
    # Create user
    user = User(
        email=email,
        username=username,
        hashed_password=get_password_hash(signup_data.password),
        role=UserRole.EMPLOYEE,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Create employee profile
    employee = Employee(
        user_id=user.id,
        employee_id=f"EMP{user.id:04d}",
        first_name=sanitize_string(signup_data.first_name),
        last_name=sanitize_string(signup_data.last_name),
        company_name=sanitize_string(signup_data.company_name),
        date_of_joining=date.today(),
        department=sanitize_string(signup_data.company_name),
        is_active=True,
    )
    db.add(employee)
    await db.commit()
    
    return SuccessResponse(
        message="Account created successfully. You can now sign in.",
        data=UserResponse.model_validate(user)
    )


@router.post("/register", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user"""
    # Validate email format
    if not validate_email(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
    
    # Validate password strength
    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Sanitize inputs
    email = sanitize_string(user_data.email.lower())
    username = sanitize_string(user_data.username)
    
    # Validate username (alphanumeric and underscore only)
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username can only contain letters, numbers, and underscores"
        )
    
    # Check if user exists
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    result = await db.execute(select(User).where(User.username == username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create user
    user = User(
        email=email,
        username=username,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role or UserRole.EMPLOYEE,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return SuccessResponse(
        message="User registered successfully",
        data=UserResponse.model_validate(user)
    )


@router.post("/login", response_model=SuccessResponse)
async def login(
    username: str = Form(...),
    password: str = Form(...),
    remember_me: bool = Form(False),
    db: AsyncSession = Depends(get_db)
):
    """Login and get access token. Use remember_me for longer session (14 days vs 30 min)."""
    # Find user by username or email
    result = await db.execute(
        select(User).where(
            (User.username == username) | (User.email == username)
        )
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.password_reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please set your password first using the link sent to your email",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Create tokens (longer expiry when remember_me)
    access_token = create_access_token(data=build_token_data(user), remember_me=remember_me)
    refresh_token = create_refresh_token(data=build_token_data(user))
    
    return SuccessResponse(
        message="Login successful",
        data=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
    )


@router.post("/set-password", response_model=SuccessResponse)
async def set_password(
    body: SetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Set password using token from email. Used when admin creates a new user.
    """
    token = (body.token or "").strip()
    if not token or not (body.new_password or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token and new password are required",
        )

    is_valid, error_msg = validate_password_strength(body.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )

    # Find user by token only first (so we can distinguish "not found" vs "expired")
    result = await db.execute(
        select(User).where(User.password_reset_token == token)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired link. Please request a new one from your admin.",
        )
    if not user.password_reset_expires or user.password_reset_expires <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This link has expired. Please request a new one from your admin.",
        )

    user.hashed_password = get_password_hash(body.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    await db.commit()
    await db.refresh(user)

    # Reload user with company and tenant_roles so UserResponse.from_user works
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.company),
            selectinload(User.tenant_roles),
        )
        .where(User.id == user.id)
    )
    user = result.scalar_one_or_none() or user

    access_token = create_access_token(data=build_token_data(user))
    refresh_token = create_refresh_token(data=build_token_data(user))

    return SuccessResponse(
        message="Password set successfully. You are now logged in.",
        data={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": UserResponse.from_user(user),
        },
    )


@router.get("/me", response_model=SuccessResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user information (includes tenant RBAC roles).

    We re-load the user with related company and tenant_roles eagerly loaded
    to avoid async lazy-load (MissingGreenlet) issues.
    """
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.company),
            selectinload(User.tenant_roles),
        )
        .where(User.id == current_user.id)
    )
    user = result.scalar_one_or_none() or current_user

    return SuccessResponse(
        message="User information retrieved",
        data=UserResponse.from_user(user),
    )

@router.post("/forgot-password", response_model=SuccessResponse)
async def forgot_password(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    from pydantic import BaseModel
    body = await request.json()
    email = body.get("email", "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Always return success to prevent email enumeration
    if not user:
        return SuccessResponse(message="If this email exists, a reset link has been sent.")

    token = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(hours=2)
    user.password_reset_token = token
    user.password_reset_expires = expires
    await db.commit()

    # Build reset URL based on user type and role
    base = getattr(settings, "BASE_DOMAIN", "leavehub.io")
    user_type = getattr(user, "user_type", None)
    user_role = str(getattr(user, "role", "")).upper()
    company = await db.get(Company, user.tenant_id) if user.tenant_id else None
    slug = company.slug if company else None
    if user_type == "platform_admin":
        reset_url = f"https://{base}/set-password?token={token}"
    elif user_role in ("SUPER_ADMIN", "TEAM_LEAD"):
        reset_url = f"https://{base}/admin/set-password?token={token}"
    else:
        if slug:
            reset_url = f"https://{slug}.{base}/set-password?token={token}"
        else:
            reset_url = f"https://{base}/set-password?token={token}"

    from core.email import send_new_user_set_password
    send_new_user_set_password(
        to_email=user.email,
        username=user.username or user.email,
        first_name=user.email.split("@")[0],
        set_password_url=reset_url,
    )

    return SuccessResponse(message="If this email exists, a reset link has been sent.")
