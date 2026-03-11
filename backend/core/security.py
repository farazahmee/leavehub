"""
Security utilities for authentication and authorization
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
import re

from core.config import settings
from core.database import get_db
from models.user import User, UserType

# Bcrypt has a 72-byte password limit
BCRYPT_MAX_PASSWORD_BYTES = 72

# Password validation
def validate_password_strength(password: str) -> tuple[bool, str]:
    """Validate password strength"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit"
    return True, ""

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def _truncate_password(password: str) -> bytes:
    """Truncate password to bcrypt's 72-byte limit"""
    pwd_bytes = password.encode("utf-8")
    if len(pwd_bytes) > BCRYPT_MAX_PASSWORD_BYTES:
        pwd_bytes = pwd_bytes[:BCRYPT_MAX_PASSWORD_BYTES]
    return pwd_bytes


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    if not hashed_password or hashed_password == "google_oauth_no_password":
        return False
    pwd_bytes = _truncate_password(plain_password)
    hashed = hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password
    return bcrypt.checkpw(pwd_bytes, hashed)


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt (avoids passlib/bcrypt 4.1+ compatibility issues)"""
    pwd_bytes = _truncate_password(password)
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")


def build_token_data(user: User) -> dict:
    """Build the standard JWT payload dict from a User instance.
    Includes tenant_id and user_type so downstream middleware can resolve
    the tenant context without extra DB lookups."""
    return {
        "sub": str(user.id),
        "tenant_id": user.tenant_id,
        "user_type": user.user_type.value if user.user_type else UserType.TENANT_USER.value,
    }


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None, remember_me: bool = False) -> str:
    """Create JWT access token. Use remember_me for longer session."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    elif remember_me:
        expire = now + timedelta(days=getattr(settings, "JWT_REMEMBER_ME_EXPIRE_DAYS", 14))
    else:
        expire = now + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
    # JWT expects exp and iat as integer timestamps (seconds since epoch)
    to_encode.update({"exp": int(expire.timestamp()), "type": "access", "iat": int(now.timestamp())})
    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create JWT refresh token"""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    # JWT expects exp and iat as integer timestamps (seconds since epoch)
    to_encode.update({"exp": int(expire.timestamp()), "type": "refresh", "iat": int(now.timestamp())})
    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        # Verify token type
        token_type = payload.get("type")
        if token_type != "access":
            raise credentials_exception
        
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        user_id = int(user_id) if isinstance(user_id, str) else user_id
    except (JWTError, ValueError, TypeError):
        raise credentials_exception

    user = await db.get(User, user_id)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
