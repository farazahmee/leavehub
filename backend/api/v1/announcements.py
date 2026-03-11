"""
Announcement routes - admin creates, all employees see
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.security import get_current_active_user
from core.permissions import require_admin_or_team_lead
from core.responses import SuccessResponse
from models.user import User
from models.employee import Employee
from models.announcement import Announcement
from schemas.announcement import AnnouncementCreate, AnnouncementResponse

router = APIRouter()


@router.get("", response_model=SuccessResponse)
async def list_announcements(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List active announcements. Tenant users see only their company's announcements."""
    q = (
        select(Announcement)
        .where(Announcement.is_active == True)
        .order_by(Announcement.created_at.desc())
        .limit(20)
    )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None:
        q = q.where(Announcement.tenant_id == tenant_id)
    result = await db.execute(q)
    announcements = result.scalars().all()
    return SuccessResponse(
        message="Announcements retrieved",
        data=[AnnouncementResponse.model_validate(a) for a in announcements]
    )


@router.post("", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    data: AnnouncementCreate,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Create announcement (admin only). Scoped to current user's company."""
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()
    tenant_id = getattr(current_user, "tenant_id", None)

    announcement = Announcement(
        title=data.title.strip(),
        message=data.message.strip(),
        is_active=True,
        created_by_id=employee.id if employee else None,
        tenant_id=tenant_id,
    )
    db.add(announcement)
    await db.commit()
    await db.refresh(announcement)
    return SuccessResponse(
        message="Announcement created",
        data=AnnouncementResponse.model_validate(announcement)
    )


@router.put("/{announcement_id}/deactivate", response_model=SuccessResponse)
async def deactivate_announcement(
    announcement_id: int,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Deactivate announcement (admin only). Tenant users may only deactivate own company's."""
    announcement = await db.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and announcement.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Announcement not found")
    announcement.is_active = False
    await db.commit()
    return SuccessResponse(message="Announcement deactivated", data=None)
