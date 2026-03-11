"""
Public tenant info for login pages and branding.
No authentication required.
"""
from fastapi import APIRouter, Request
from sqlalchemy import select
from core.database import AsyncSessionLocal
from models.company import Company
from core.responses import SuccessResponse

router = APIRouter()


@router.get("/info", response_model=SuccessResponse)
async def tenant_info(request: Request):
    """
    Return tenant name for branding (login pages, headers).
    Requires X-Tenant-Slug header or subdomain. No auth required.
    """
    tenant_slug = getattr(request.state, "tenant_slug", None)
    if not tenant_slug:
        return SuccessResponse(
            message="No tenant context",
            data={"name": None, "slug": None},
        )

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Company.name, Company.slug).where(
                Company.slug == tenant_slug,
                Company.is_active == True,
            )
        )
        row = result.first(        )
    if row:
        return SuccessResponse(message="OK", data={"name": row[0], "slug": row[1]})
    return SuccessResponse(message="Tenant not found", data={"name": None, "slug": tenant_slug})
