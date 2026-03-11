"""
Team management routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from core.database import get_db
from core.security import get_current_active_user
from core.permissions import require_admin_or_team_lead
from core.responses import SuccessResponse
from models.user import User, UserRole
from models.team import Team
from models.employee import Employee
from schemas.team import TeamCreate, TeamUpdate, TeamResponse
from schemas.employee import EmployeeResponse

router = APIRouter()


@router.get("", response_model=SuccessResponse)
async def list_teams(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List teams. Employees see only their team; tenant admins see only their company's teams."""
    tenant_id = getattr(current_user, "tenant_id", None)
    is_employee = current_user.role == UserRole.EMPLOYEE
    if is_employee:
        emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        emp = emp_result.scalar_one_or_none()
        if not emp or not emp.team_id:
            return SuccessResponse(message="Teams retrieved", data=[])
        result = await db.execute(select(Team).where(Team.id == emp.team_id))
        teams = result.scalars().all()
    else:
        q = select(Team)
        if tenant_id is not None:
            q = q.where(Team.tenant_id == tenant_id)
        result = await db.execute(q)
        teams = result.scalars().all()

    return SuccessResponse(
        message="Teams retrieved",
        data=[TeamResponse.model_validate(team) for team in teams]
    )


@router.post("", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    team_data: TeamCreate,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Create a new team. Company admin creates team in their company."""
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is None and not getattr(current_user, "is_platform_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform admin can create teams without a company context",
        )
    name_check = select(Team).where(Team.name == team_data.name)
    if tenant_id is not None:
        name_check = name_check.where(Team.tenant_id == tenant_id)
    result = await db.execute(name_check)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team name already exists"
        )
    payload = team_data.dict()
    if tenant_id is not None:
        payload["tenant_id"] = tenant_id
    team = Team(**payload)
    db.add(team)
    await db.commit()
    await db.refresh(team)
    return SuccessResponse(
        message="Team created successfully",
        data=TeamResponse.model_validate(team)
    )


@router.get("/{team_id}/members", response_model=SuccessResponse)
async def get_team_members(
    team_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get team members (employees in this team). Tenant users may only view teams in their company."""
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and team.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    if current_user.role == UserRole.EMPLOYEE:
        emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        emp = emp_result.scalar_one_or_none()
        if not emp or emp.team_id != team_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view members of your own team",
            )
    result = await db.execute(
        select(Employee).where(
            Employee.team_id == team_id,
            Employee.is_active == True,
        )
    )
    members = result.scalars().all()
    return SuccessResponse(
        message="Team members retrieved",
        data=[EmployeeResponse.model_validate(m) for m in members],
    )


@router.get("/{team_id}", response_model=SuccessResponse)
async def get_team(
    team_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get team by ID. Tenant users may only access teams in their company."""
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and team.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    return SuccessResponse(
        message="Team retrieved",
        data=TeamResponse.model_validate(team)
    )


@router.put("/{team_id}", response_model=SuccessResponse)
async def update_team(
    team_id: int,
    team_data: TeamUpdate,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Update team. Company admin may update only teams in their company."""
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and team.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    update_data = team_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)
    await db.commit()
    await db.refresh(team)
    return SuccessResponse(
        message="Team updated successfully",
        data=TeamResponse.model_validate(team)
    )


@router.delete("/{team_id}", response_model=SuccessResponse)
async def delete_team(
    team_id: int,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Delete team. Company admin may delete only teams in their company."""
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and team.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    await db.delete(team)
    await db.commit()
    return SuccessResponse(message="Team deleted successfully")
