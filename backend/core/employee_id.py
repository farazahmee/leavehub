"""
Tenant-scoped employee ID generation.
Employee IDs start at 1 per tenant and increment: 1, 2, 3, ...
Format: EMP0001, EMP0002, ...
"""
import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.employee import Employee


# Match EMP followed by digits (e.g. EMP0001, EMP0024)
EMP_ID_PATTERN = re.compile(r"^EMP(\d+)$", re.IGNORECASE)


async def get_next_employee_id_for_tenant(db: AsyncSession, tenant_id: int) -> str:
    """
    Return the next employee ID for the given tenant (e.g. EMP0001, EMP0002).
    If tenant_id is None, uses a global fallback (e.g. from user id) - caller should handle.
    """
    if tenant_id is None:
        raise ValueError("tenant_id is required for tenant-scoped employee ID")

    result = await db.execute(
        select(Employee.employee_id).where(Employee.tenant_id == tenant_id)
    )
    rows = result.scalars().all()
    max_num = 0
    for eid in rows:
        if not eid:
            continue
        m = EMP_ID_PATTERN.match(eid.strip())
        if m:
            max_num = max(max_num, int(m.group(1)))
    next_num = max_num + 1
    return f"EMP{next_num:04d}"
