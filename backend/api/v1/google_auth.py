"""
Google OAuth authentication
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
from urllib.parse import urlencode
import secrets

from core.database import get_db
from core.config import settings
from core.security import create_access_token, create_refresh_token, build_token_data
from core.responses import SuccessResponse
from models.user import User, UserRole
from schemas.auth import TokenResponse, UserResponse

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


def get_google_auth_url() -> str:
    """Build Google OAuth authorization URL"""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
        "state": secrets.token_urlsafe(32),
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def get_google_user_info(code: str) -> dict:
    """Exchange code for tokens and get user info from Google"""
    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get tokens from Google")
        
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        
        if not access_token:
            raise HTTPException(status_code=400, detail="No access token from Google")
        
        # Get user info
        user_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        
        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info from Google")
        
        return user_response.json()


def create_username_from_email(email: str) -> str:
    """Create username from email (before @)"""
    return email.split("@")[0].replace(".", "_").lower()[:50]


@router.get("/google/status")
async def google_auth_status():
    """Check if Google OAuth is configured"""
    return {"enabled": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)}


@router.get("/google")
async def google_login():
    """Redirect to Google OAuth consent screen"""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=400,
            detail="Google OAuth not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env"
        )
    
    auth_url = get_google_auth_url()
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_callback(
    code: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Handle Google OAuth callback - create/find user and redirect with token"""
    if error:
        # Redirect to frontend login with error
        frontend_url = "http://localhost:3000"
        return RedirectResponse(url=f"{frontend_url}/login?error={error}")
    
    if not code:
        raise HTTPException(status_code=400, detail="No code received from Google")
    
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    try:
        google_user = await get_google_user_info(code)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google auth failed: {str(e)}")
    
    email = google_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email from Google")
    
    name = google_user.get("name", "").split()
    first_name = name[0] if name else email.split("@")[0]
    last_name = " ".join(name[1:]) if len(name) > 1 else ""
    
    # Find or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        # Create new user - use placeholder for password (Google users don't use it)
        base_username = create_username_from_email(email)
        username = base_username
        counter = 1
        while True:
            check = await db.execute(select(User).where(User.username == username))
            if not check.scalar_one_or_none():
                break
            username = f"{base_username}{counter}"
            counter += 1
        
        from models.employee import Employee
        from datetime import date
        
        user = User(
            email=email,
            username=username,
            hashed_password="google_oauth_no_password",  # Placeholder - never used for login
            role=UserRole.EMPLOYEE,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        # Create employee profile for new user
        employee = Employee(
            user_id=user.id,
            employee_id=f"EMP{user.id:04d}",
            first_name=first_name,
            last_name=last_name or first_name,
            date_of_joining=date.today(),
            is_active=True,
        )
        db.add(employee)
        await db.commit()
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")
    
    # Create JWT tokens (for redirect flow)
    access_token = create_access_token(data=build_token_data(user))
    refresh_token = create_refresh_token(data=build_token_data(user))
    
    # Redirect to frontend with tokens
    frontend_url = "http://localhost:3000"
    redirect_url = f"{frontend_url}/auth/callback?access_token={access_token}&refresh_token={refresh_token}"
    return RedirectResponse(url=redirect_url)


@router.post("/google/token", response_model=SuccessResponse)
async def google_token_exchange(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Alternative: Exchange Google code for JWT (for SPA - POST with code)"""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    try:
        google_user = await get_google_user_info(code)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google auth failed: {str(e)}")
    
    email = google_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email from Google")
    
    name = google_user.get("name", "").split()
    first_name = name[0] if name else email.split("@")[0]
    last_name = " ".join(name[1:]) if len(name) > 1 else ""
    
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        base_username = create_username_from_email(email)
        username = base_username
        counter = 1
        while True:
            check = await db.execute(select(User).where(User.username == username))
            if not check.scalar_one_or_none():
                break
            username = f"{base_username}{counter}"
            counter += 1
        
        user = User(
            email=email,
            username=username,
            hashed_password="google_oauth_no_password",
            role=UserRole.EMPLOYEE,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        from models.employee import Employee
        from datetime import date
        
        employee = Employee(
            user_id=user.id,
            employee_id=f"EMP{user.id:04d}",
            first_name=first_name,
            last_name=last_name or first_name,
            date_of_joining=date.today(),
            is_active=True,
        )
        db.add(employee)
        await db.commit()
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")
    
    access_token = create_access_token(data=build_token_data(user))
    refresh_token = create_refresh_token(data=build_token_data(user))
    
    return SuccessResponse(
        message="Login successful",
        data=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
        ),
    )
