"""
Application configuration settings
"""
try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings
from typing import List, Union
from pathlib import Path


def parse_cors_origins(v: Union[str, List[str]]) -> List[str]:
    """Parse CORS_ORIGINS from env - accepts comma-separated string or list"""
    if isinstance(v, list):
        return v
    if isinstance(v, str):
        return [origin.strip() for origin in v.split(",") if origin.strip()]
    return ["http://localhost:3000", "http://localhost:5173"]


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "WorkForceHub"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8080
    SECRET_KEY: str = "your-secret-key-change-in-production"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/workforcehub"
    
    # CORS - use str in env, parsed to list
    CORS_ORIGINS: str = "http://localhost:5174,http://localhost:5173,http://localhost:5175,http://localhost:5176,http://127.0.0.1:5174,http://127.0.0.1:5173,http://127.0.0.1:5175,http://127.0.0.1:5176"
    ALLOWED_HOSTS: str = "localhost,127.0.0.1"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """CORS origins as list for middleware"""
        return parse_cors_origins(self.CORS_ORIGINS)
    
    @property
    def allowed_hosts_list(self) -> List[str]:
        """Allowed hosts as list for middleware"""
        return [h.strip() for h in self.ALLOWED_HOSTS.split(",") if h.strip()]
    
    # JWT
    JWT_SECRET_KEY: str = "your-jwt-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # Session timeout when Remember me is off
    JWT_REMEMBER_ME_EXPIRE_DAYS: int = 14     # Session duration when Remember me is on
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # AWS S3 (for file storage)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_S3_BUCKET_NAME: str = ""
    AWS_S3_ENDPOINT_URL: str = ""
    
    # OpenAI (for letter generation)
    OPENAI_API_KEY: str = ""
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://127.0.0.1:8080/api/v1/auth/google/callback"
    GOOGLE_CALENDAR_ID: str = ""  # For employee portal calendar embed (e.g. company shared calendar)
    
    # File Upload
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIR: Path = Path("uploads")
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # Email (SMTP) - one.com: send.one.com, port 465 (SSL)
    SMTP_HOST: str = "send.one.com"
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = False  # Port 465 uses implicit SSL, not STARTTLS
    SMTP_USE_SSL: bool = True   # Use SSL for port 465
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "WorkForceHub"
    FRONTEND_URL: str = "http://localhost:5174"
    EMPLOYEE_PORTAL_URL: str = "http://localhost:5174/employee"
    # Dedicated company admin portal (per-tenant admin UI)
    COMPANY_ADMIN_URL: str = "http://localhost:5176"
    USER_EMAIL_DOMAIN: str = ""  # e.g. "orbi-thinx.info" - restrict new users to this domain
    BASE_DOMAIN: str = "workforcehub.com"  # For production: slug.BASE_DOMAIN
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# Create upload directory if it doesn't exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
