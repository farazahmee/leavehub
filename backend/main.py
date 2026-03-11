"""
WorkForceHub HR Management System - FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from contextlib import asynccontextmanager

from core.config import settings
from core.database import engine, Base
from core.middleware import SecurityHeadersMiddleware
from core.exceptions import (
    validation_exception_handler,
    integrity_error_handler,
    general_exception_handler
)
from core.tenant import TenantResolutionMiddleware
from api.v1 import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup: Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Normalize employee_id indexing: drop any legacy global uniqueness and
        # enforce uniqueness per tenant instead via (tenant_id, employee_id).
        try:
            await conn.execute(
                text(
                    "ALTER TABLE employees "
                    "DROP CONSTRAINT IF EXISTS employees_employee_id_key"
                )
            )
            await conn.execute(
                text(
                    "ALTER TABLE employees "
                    "DROP CONSTRAINT IF EXISTS ix_employees_employee_id"
                )
            )
            await conn.execute(text("DROP INDEX IF EXISTS ix_employees_employee_id"))
            await conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_tenant_employee_id "
                    "ON employees (COALESCE(tenant_id, -1), employee_id)"
                )
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                f"Failed to normalize employees.employee_id index: {e}"
            )
    # Seed platform permissions if missing
    try:
        from scripts.seed_permissions import seed
        await seed()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Seed permissions failed: {e}")
    # Ensure S3 bucket exists (for LocalStack / dev)
    try:
        from core.storage import ensure_bucket_exists
        ensure_bucket_exists()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"S3 bucket check failed: {e}")
    # Purge employees inactive for 30+ days
    try:
        from core.purge_inactive import purge_inactive_employees
        await purge_inactive_employees()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Purge inactive employees failed: {e}")
    yield
    # Shutdown: Cleanup if needed
    pass


app = FastAPI(
    title="WorkForceHub API",
    description="HR Management System API",
    version="1.0.0",
    lifespan=lifespan,
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Tenant resolution (X-Tenant-Slug or subdomain); /api/v1/superadmin bypassed
app.add_middleware(TenantResolutionMiddleware)

# CORS middleware - allow *.localhost for subdomain-based tenant URLs in dev
_cors_origins = settings.cors_origins_list
_cors_regex = None
if settings.ENVIRONMENT != "production":
    _cors_regex = r"^https?://[a-z0-9-]+\.localhost(:\d+)?$"
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Tenant-Slug"],
    expose_headers=["Content-Type"],
)

# Trusted host middleware
if settings.ENVIRONMENT == "production":
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.allowed_hosts_list,
    )

# Exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(IntegrityError, integrity_error_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "WorkForceHub API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
