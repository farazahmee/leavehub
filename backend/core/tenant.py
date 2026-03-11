"""
Tenant resolution for multi-tenant SaaS.

Middleware sets request.state.tenant_id from X-Tenant-Slug header or subdomain.
Super Admin routes bypass tenant resolution.

The ``tenant_filter`` dependency provides automatic query scoping by tenant_id,
so tenant-scoped endpoints don't need to manually filter every query.
"""
import re
from typing import Optional, TypeVar, Type

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from fastapi import Depends, HTTPException, status
from sqlalchemy import select, Select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import AsyncSessionLocal, get_db
from models.company import Company


SUPERADMIN_PREFIX = "/api/v1/superadmin"

# Paths that don't require tenant context (auth, health, docs, etc.)
TENANT_EXEMPT_PREFIXES = (
    SUPERADMIN_PREFIX,
    "/api/v1/auth",
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
)

T = TypeVar("T")


def _slug_from_host(host: str) -> Optional[str]:
    """Extract subdomain as tenant slug, e.g. acme.workforcehub.com -> acme."""
    if not host:
        return None
    parts = host.split(".")
    if len(parts) >= 2 and parts[0] != "www":
        return parts[0].lower()
    return None


class TenantResolutionMiddleware(BaseHTTPMiddleware):
    """
    Resolves tenant from X-Tenant-Slug header or Host subdomain.
    Sets request.state.tenant_id and request.state.tenant_slug.
    Super Admin routes are skipped.
    """

    async def dispatch(self, request: Request, call_next):
        request.state.tenant_id = None
        request.state.tenant_slug = None

        path = request.scope.get("path") or ""
        if any(path.startswith(p) for p in TENANT_EXEMPT_PREFIXES):
            return await call_next(request)

        slug = None
        slug_header = request.headers.get("X-Tenant-Slug", "").strip()
        if slug_header:
            slug = slug_header.lower()
        if not slug:
            host = request.headers.get("host") or request.headers.get("Host") or ""
            slug = _slug_from_host(host.split(":")[0])

        if not slug:
            return await call_next(request)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Company.id, Company.slug).where(
                    Company.slug == slug, Company.is_active == True
                )
            )
            row = result.first()
            if row:
                request.state.tenant_id = row[0]
                request.state.tenant_slug = row[1]

        return await call_next(request)


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

def get_tenant_id(request: Request) -> Optional[int]:
    """Dependency: return resolved tenant_id for the current request (None if not tenant context)."""
    return getattr(request.state, "tenant_id", None)


def get_tenant_slug(request: Request) -> Optional[str]:
    """Dependency: return resolved tenant_slug for the current request."""
    return getattr(request.state, "tenant_slug", None)


def require_tenant(request: Request) -> int:
    """Dependency that *requires* a tenant context. Returns tenant_id or 403."""
    tid = getattr(request.state, "tenant_id", None)
    if tid is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant context required (set X-Tenant-Slug header or use subdomain)",
        )
    return tid


# ---------------------------------------------------------------------------
# Auto-filtering helper
# ---------------------------------------------------------------------------

class TenantFilter:
    """
    Callable dependency that auto-appends ``.where(Model.tenant_id == tenant_id)``
    to SQLAlchemy select statements.

    Usage in an endpoint::

        @router.get("/items")
        async def list_items(
            tf: TenantFilter = Depends(tenant_filter),
            db: AsyncSession = Depends(get_db),
        ):
            q = tf.apply(select(Item))
            result = await db.execute(q)
            ...

    Platform admins (tenant_id=None) bypass filtering so they see all data.
    """

    def __init__(self, tenant_id: Optional[int]):
        self.tenant_id = tenant_id

    def apply(self, stmt: Select, model: Optional[Type] = None) -> Select:
        """
        Apply tenant filter to a select statement.
        If ``model`` is given explicitly, uses ``model.tenant_id``.
        Otherwise expects the primary entity of the statement to have ``tenant_id``.
        """
        if self.tenant_id is None:
            return stmt
        if model is not None:
            return stmt.where(model.tenant_id == self.tenant_id)
        entity = stmt.columns_clause_froms[0] if hasattr(stmt, "columns_clause_froms") else None
        if entity is not None and hasattr(entity, "c") and hasattr(entity.c, "tenant_id"):
            return stmt.where(entity.c.tenant_id == self.tenant_id)
        return stmt

    def scope(self, model_class: Type[T]) -> Select:
        """Shorthand: ``select(Model).where(Model.tenant_id == tid)``."""
        q = select(model_class)
        if self.tenant_id is not None and hasattr(model_class, "tenant_id"):
            q = q.where(model_class.tenant_id == self.tenant_id)
        return q


def tenant_filter(request: Request) -> TenantFilter:
    """FastAPI dependency returning a TenantFilter bound to the current request's tenant."""
    return TenantFilter(getattr(request.state, "tenant_id", None))
