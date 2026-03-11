"""
Purge employees inactive for 30+ days (permanent delete).
Runs on app startup.
"""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, and_, or_, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import AsyncSessionLocal
from models.employee import Employee
from models.user import User
from models.leave import Leave, LeaveBalance
from models.document import Document
from models.letter import Letter
from models.payroll import Payroll
from models.attendance import Attendance, Overtime
from models.team import Team

logger = logging.getLogger(__name__)

INACTIVE_PURGE_DAYS = 30


async def purge_inactive_employees():
    """
    Permanently delete employees and their users when inactive for 30+ days.
    Handles FK dependencies in correct order.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=INACTIVE_PURGE_DAYS)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Employee).where(
                and_(
                    Employee.is_active == False,
                    or_(
                        and_(Employee.deactivated_at != None, Employee.deactivated_at <= cutoff),
                        and_(
                            Employee.deactivated_at == None,
                            Employee.updated_at != None,
                            Employee.updated_at <= cutoff,
                        ),
                    ),
                )
            )
        )
        to_purge = result.scalars().all()

    if not to_purge:
        return

    for emp in to_purge:
        async with AsyncSessionLocal() as db:
            try:
                # Reload with locks if needed; delete in dependency order
                emp_ref = await db.get(Employee, emp.id)
                if not emp_ref:
                    continue
                user_id = emp_ref.user_id

                eid = emp_ref.id

                # Nullify optional FKs
                await db.execute(update(Leave).where(Leave.approved_by_id == eid).values(approved_by_id=None))
                await db.execute(update(Document).where(Document.uploaded_by_id == eid).values(uploaded_by_id=None))
                await db.execute(update(Document).where(Document.employee_id == eid).values(employee_id=None))
                await db.execute(update(Letter).where(Letter.generated_by_id == eid).values(generated_by_id=None))
                await db.execute(update(Payroll).where(Payroll.uploaded_by_id == eid).values(uploaded_by_id=None))
                await db.execute(update(Overtime).where(Overtime.approved_by_id == eid).values(approved_by_id=None))
                await db.execute(update(Team).where(Team.team_lead_id == eid).values(team_lead_id=None))

                # Delete records that require employee_id
                await db.execute(delete(LeaveBalance).where(LeaveBalance.employee_id == eid))
                await db.execute(delete(Leave).where(Leave.employee_id == eid))
                await db.execute(delete(Letter).where(Letter.employee_id == eid))
                await db.execute(delete(Payroll).where(Payroll.employee_id == eid))
                await db.execute(delete(Attendance).where(Attendance.employee_id == eid))
                await db.execute(delete(Overtime).where(Overtime.employee_id == eid))

                await db.delete(emp_ref)
                user = await db.get(User, user_id)
                if user:
                    await db.delete(user)

                await db.commit()
                logger.info(f"Purged inactive employee id={emp.id} user_id={user_id}")
            except Exception as e:
                await db.rollback()
                logger.warning(f"Failed to purge employee id={emp.id}: {e}")
