"""
Payroll routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import io
from pathlib import Path

from core.database import get_db
from core.security import get_current_active_user
from core.permissions import require_super_admin, require_any_authenticated, require_admin_or_team_lead
from core.config import settings
from core.responses import SuccessResponse
from core.validators import validate_file_extension, validate_file_size, sanitize_string
from core.currencies import VALID_CURRENCY_CODES
from core.storage import save_file, generate_unique_key, read_file, resolve_file_source, file_exists
from core.validators import is_path_safe
from models.user import User
from models.employee import Employee
from models.payroll import Payroll
from schemas.payroll import PayrollCreate, PayrollResponse

router = APIRouter()


@router.post("", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def create_payroll(
    payroll_data: PayrollCreate,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Create salary slip (no file). Net = basic + allowances - deductions. Tenant-scoped."""
    employee = await db.get(Employee, payroll_data.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and getattr(employee, "tenant_id", None) != tenant_id:
        raise HTTPException(status_code=404, detail="Employee not found")
    result = await db.execute(
        select(Payroll).where(
            Payroll.employee_id == payroll_data.employee_id,
            Payroll.month == payroll_data.month,
            Payroll.year == payroll_data.year,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Payroll for this month already exists")
    basic = float(payroll_data.basic_salary or 0)
    allowances = float(payroll_data.allowances or 0)
    deductions = float(payroll_data.deductions or 0)
    net = basic + allowances - deductions
    result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    uploader = result.scalar_one_or_none()
    payroll = Payroll(
        employee_id=payroll_data.employee_id,
        month=payroll_data.month,
        year=payroll_data.year,
        basic_salary=basic,
        allowances=allowances,
        deductions=deductions,
        net_salary=net,
        uploaded_by_id=uploader.id if uploader else None,
        tenant_id=tenant_id or getattr(employee, "tenant_id", None),
    )
    db.add(payroll)
    await db.commit()
    await db.refresh(payroll)
    return SuccessResponse(
        message="Salary slip created successfully",
        data=PayrollResponse.model_validate(payroll)
    )


@router.post("/upload", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def upload_payroll(
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
    employee_id: str = Form(..., description="Employee ID"),
    month: str = Form(..., description="Month (1-12)"),
    year: str = Form(..., description="Year"),
    currency: str = Form(..., description="ISO 4217 currency code (e.g. USD, EUR, PKR)"),
    file: UploadFile = File(...),
):
    """Upload payroll/salary slip. Currency is required."""
    try:
        employee_id = int(employee_id)
        month = int(month)
        year = int(year)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="employee_id, month and year must be numbers",
        )
    if not (1 <= month <= 12):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="month must be between 1 and 12",
        )
    currency_code = (currency or "").strip().upper()
    if not currency_code or currency_code not in VALID_CURRENCY_CODES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select a valid currency (ISO 4217 code, e.g. USD, EUR, PKR)"
        )
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and getattr(employee, "tenant_id", None) != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    # Check if payroll already exists
    result = await db.execute(
        select(Payroll).where(
            Payroll.employee_id == employee_id,
            Payroll.month == month,
            Payroll.year == year
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payroll for this month already exists"
        )
    
    # Validate file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required"
        )
    
    # Validate file extension (only PDF for payroll)
    if not validate_file_extension(file.filename, ['pdf']):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed for payroll"
        )
    
    # Read and validate file
    file_content = await file.read()
    if not validate_file_size(len(file_content), settings.MAX_UPLOAD_SIZE):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE / (1024*1024)}MB"
        )
    
    relative_key = generate_unique_key("payroll", "pdf")
    stored_path = save_file(relative_key, file_content)
    
    # Get uploader employee
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    uploader = result.scalar_one_or_none()
    
    payroll = Payroll(
        employee_id=employee_id,
        month=month,
        year=year,
        basic_salary=0,
        allowances=0,
        deductions=0,
        net_salary=0,
        currency=currency_code,
        file_path=stored_path,
        uploaded_by_id=uploader.id if uploader else None,
        tenant_id=tenant_id or getattr(employee, "tenant_id", None),
    )
    db.add(payroll)
    await db.commit()
    await db.refresh(payroll)
    return SuccessResponse(
        message="Payroll uploaded successfully",
        data=PayrollResponse.model_validate(payroll)
    )


@router.get("", response_model=SuccessResponse)
async def list_payrolls(
    employee_id: Optional[int] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """List payrolls. Tenant users see only their company's payrolls; employees see own."""
    query = select(Payroll)
    tenant_id = getattr(current_user, "tenant_id", None)
    role_val = getattr(current_user.role, "value", str(current_user.role))
    if tenant_id is not None:
        query = query.where(Payroll.tenant_id == tenant_id)
    elif role_val not in ("super_admin", "team_lead"):
        result = await db.execute(
            select(Employee).where(Employee.user_id == current_user.id)
        )
        employee = result.scalar_one_or_none()
        if employee:
            query = query.where(Payroll.employee_id == employee.id)

    if employee_id:
        query = query.where(Payroll.employee_id == employee_id)
    if year:
        query = query.where(Payroll.year == year)
    if month:
        query = query.where(Payroll.month == month)
    
    query = query.order_by(Payroll.year.desc(), Payroll.month.desc())
    result = await db.execute(query)
    payrolls = result.scalars().all()
    if payrolls:
        emp_ids = list({p.employee_id for p in payrolls})
        emp_res = await db.execute(select(Employee).where(Employee.id.in_(emp_ids)))
        emps = {e.id: e for e in emp_res.scalars().all()}
        data = []
        for p in payrolls:
            d = PayrollResponse.model_validate(p).model_dump()
            e = emps.get(p.employee_id)
            d["employee_name"] = f"{e.first_name} {e.last_name}" if e else None
            data.append(d)
    else:
        data = []
    return SuccessResponse(message="Payrolls retrieved", data=data)


@router.get("/{payroll_id}", response_model=SuccessResponse)
async def get_payroll(
    payroll_id: int,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """Get payroll by ID. Tenant users may access payrolls in their company."""
    payroll = await db.get(Payroll, payroll_id)
    if not payroll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll not found"
        )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None:
        if getattr(payroll, "tenant_id", None) != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payroll not found"
            )
    else:
        role_val = getattr(current_user.role, "value", str(current_user.role))
        if role_val != "super_admin":
            result = await db.execute(
                select(Employee).where(Employee.user_id == current_user.id)
            )
            employee = result.scalar_one_or_none()
            if employee and payroll.employee_id != employee.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
    
    return SuccessResponse(
        message="Payroll retrieved",
        data=PayrollResponse.model_validate(payroll)
    )


@router.get("/{payroll_id}/download")
async def download_payroll(
    payroll_id: int,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """Download payroll PDF file. Tenant users may download payrolls in their company."""
    payroll = await db.get(Payroll, payroll_id)
    if not payroll or not payroll.file_path:
        raise HTTPException(status_code=404, detail="Payroll file not found")
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None:
        if getattr(payroll, "tenant_id", None) != tenant_id:
            raise HTTPException(status_code=404, detail="Payroll not found")
    else:
        role_val = getattr(current_user.role, "value", str(current_user.role))
        if role_val not in ("super_admin", "team_lead"):
            result = await db.execute(
                select(Employee).where(Employee.user_id == current_user.id)
            )
            emp = result.scalar_one_or_none()
            if not emp or payroll.employee_id != emp.id:
                raise HTTPException(status_code=403, detail="Access denied")
    if not file_exists(payroll.file_path):
        raise HTTPException(status_code=404, detail="File not found")
    source_type, path_or_key = resolve_file_source(payroll.file_path)
    filename = f"salary_slip_{payroll.month}_{payroll.year}.pdf"
    if source_type == "local":
        path = Path(path_or_key)
        if not is_path_safe(path, settings.UPLOAD_DIR):
            raise HTTPException(status_code=403, detail="Access denied")
        return FileResponse(path, filename=filename)
    content = read_file(payroll.file_path)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
