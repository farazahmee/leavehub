"""
Document management routes.

Uses S3StorageService (via core.storage) for file persistence.  Files are keyed
with the tenant slug prefix so each company's documents live under their own
namespace: ``{tenant_slug}/documents/{uuid}.{ext}``.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from pathlib import Path
import io

from core.database import get_db
from core.security import get_current_active_user
from core.permissions import require_any_authenticated, require_admin_or_team_lead, _load_user_role_names
from core.config import settings
from core.responses import SuccessResponse
from core.validators import validate_file_extension, validate_file_size, sanitize_string, is_path_safe
from core.storage import save_file, generate_unique_key, read_file, resolve_file_source, file_exists
from core.tenant import TenantFilter, tenant_filter
from models.user import User
from models.employee import Employee
from models.company import Company
from models.document import Document, DocumentCategory
from schemas.document import DocumentCreate, DocumentResponse

router = APIRouter()


async def _get_tenant_slug(db: AsyncSession, tenant_id: Optional[int]) -> str:
    """Resolve tenant slug from tenant_id via async query (avoids lazy-loading User.company)."""
    if tenant_id is None:
        return "default"
    company = await db.get(Company, tenant_id)
    return getattr(company, "slug", None) or "default"


@router.post("/upload", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    category_id: Optional[int] = Form(None),
    is_company_policy: bool = Form(False),
    description: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    current_user: User = Depends(require_any_authenticated),
    tf: TenantFilter = Depends(tenant_filter),
    db: AsyncSession = Depends(get_db),
):
    """Upload document. Employees upload own; company policy (public for all) requires admin or Company Admin/HR Manager."""
    role_val = getattr(current_user.role, "value", str(current_user.role))
    if is_company_policy:
        allowed = role_val in ("super_admin", "team_lead")
        if not allowed and getattr(current_user, "tenant_id", None):
            rbac_roles = await _load_user_role_names(current_user.id, current_user.tenant_id, db)
            allowed = bool(rbac_roles & {"Company Admin", "HR Manager"})
        if not allowed:
            raise HTTPException(status_code=403, detail="Only admins can upload company policy documents")

    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()

    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Filename is required")

    allowed_extensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'jpg', 'jpeg', 'png']
    if not validate_file_extension(file.filename, allowed_extensions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}",
        )

    file_content = await file.read()

    if not validate_file_size(len(file_content), settings.MAX_UPLOAD_SIZE):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE / (1024*1024)}MB",
        )

    safe_filename = sanitize_string(file.filename)
    file_extension = safe_filename.rsplit('.', 1)[-1] if '.' in safe_filename else ''

    # Tenant-scoped S3 key: {tenant_slug}/documents/{uuid}.{ext} (async slug lookup to avoid lazy load)
    slug = await _get_tenant_slug(db, getattr(current_user, "tenant_id", None))
    relative_key = generate_unique_key(f"{slug}/documents", file_extension)
    stored_path = save_file(relative_key, file_content)

    from datetime import datetime as dt
    exp_date = None
    if expiry_date and expiry_date.strip():
        try:
            exp_date = dt.strptime(expiry_date.strip()[:10], "%Y-%m-%d").date()
        except ValueError:
            pass

    document = Document(
        tenant_id=current_user.tenant_id,
        employee_id=employee.id if employee and not is_company_policy else None,
        category_id=category_id,
        name=sanitize_string(safe_filename),
        file_path=stored_path,
        file_type=file.content_type or 'application/octet-stream',
        file_size=len(file_content),
        is_company_policy=is_company_policy,
        description=sanitize_string(description) if description else None,
        expiry_date=exp_date,
        uploaded_by_id=employee.id if employee else None,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    return SuccessResponse(
        message="Document uploaded successfully",
        data=DocumentResponse.model_validate(document),
    )


@router.get("", response_model=SuccessResponse)
async def list_documents(
    is_company_policy: Optional[bool] = None,
    current_user: User = Depends(require_any_authenticated),
    tf: TenantFilter = Depends(tenant_filter),
    db: AsyncSession = Depends(get_db),
):
    """List documents (scoped to current tenant)."""
    query = tf.scope(Document)

    if is_company_policy is not None:
        query = query.where(Document.is_company_policy == is_company_policy)
    else:
        result = await db.execute(
            select(Employee).where(Employee.user_id == current_user.id)
        )
        employee = result.scalar_one_or_none()
        role_val = getattr(current_user.role, "value", str(current_user.role))
        if employee and role_val not in ("super_admin", "team_lead"):
            query = query.where(
                (Document.is_company_policy == True) | (Document.employee_id == employee.id)
            )

    result = await db.execute(query.order_by(Document.created_at.desc()))
    documents = result.scalars().all()

    return SuccessResponse(
        message="Documents retrieved",
        data=[DocumentResponse.model_validate(doc) for doc in documents],
    )


@router.get("/expiring-soon", response_model=SuccessResponse)
async def list_expiring_documents(
    days: int = 90,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """List documents expiring within the next N days (default 90). Tenant-scoped when applicable."""
    from datetime import date, timedelta
    today = date.today()
    future = today + timedelta(days=max(1, min(days, 365)))
    query = select(Document).where(
        and_(
            Document.expiry_date.isnot(None),
            Document.expiry_date >= today,
            Document.expiry_date <= future,
        )
    )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None:
        query = query.where(Document.tenant_id == tenant_id)
    result = await db.execute(
        query.order_by(Document.expiry_date.asc())
    )
    docs = result.scalars().all()
    role_val = getattr(current_user.role, "value", str(current_user.role))
    emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    employee = emp_result.scalar_one_or_none()
    if role_val not in ("super_admin", "team_lead") and employee:
        docs = [d for d in docs if d.is_company_policy or d.employee_id == employee.id]
    elif role_val not in ("super_admin", "team_lead"):
        docs = [d for d in docs if d.is_company_policy]
    out = []
    for d in docs:
        row = DocumentResponse.model_validate(d).model_dump()
        row["employee_name"] = None
        if d.employee_id:
            emp = await db.get(Employee, d.employee_id)
            if emp:
                row["employee_name"] = f"{emp.first_name} {emp.last_name}"
        out.append(row)
    return SuccessResponse(message="Expiring documents retrieved", data=out)


@router.get("/{document_id}", response_model=SuccessResponse)
async def get_document(
    document_id: int,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """Get document by ID. Tenant users may only access documents in their company."""
    document = await db.get(Document, document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and getattr(document, "tenant_id", None) != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return SuccessResponse(
        message="Document retrieved",
        data=DocumentResponse.model_validate(document)
    )


@router.post("/upload-for-employee", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def upload_document_for_employee(
    employee_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = None,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
    """Admin uploads document for a specific employee. Tenant admin only for same company."""
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and getattr(employee, "tenant_id", None) != tenant_id:
        raise HTTPException(status_code=404, detail="Employee not found")
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    allowed = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'jpg', 'jpeg', 'png']
    if not validate_file_extension(file.filename, allowed):
        raise HTTPException(status_code=400, detail=f"Allowed types: {', '.join(allowed)}")
    file_content = await file.read()
    if not validate_file_size(len(file_content), settings.MAX_UPLOAD_SIZE):
        raise HTTPException(status_code=400, detail="File too large")
    safe_filename = sanitize_string(file.filename)
    ext = safe_filename.rsplit('.', 1)[-1] if '.' in safe_filename else ''

    slug = await _get_tenant_slug(db, getattr(current_user, "tenant_id", None))
    relative_key = generate_unique_key(f"{slug}/documents", ext)
    stored_path = save_file(relative_key, file_content)

    result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    uploader = result.scalar_one_or_none()
    document = Document(
        tenant_id=current_user.tenant_id,
        employee_id=employee_id,
        name=sanitize_string(safe_filename),
        file_path=stored_path,
        file_type=file.content_type or 'application/octet-stream',
        file_size=len(file_content),
        description=sanitize_string(description) if description else None,
        uploaded_by_id=uploader.id if uploader else None,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return SuccessResponse(
        message="Document uploaded successfully",
        data=DocumentResponse.model_validate(document),
    )


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """Download document file. Tenant users may download company policy or own documents in their company."""
    document = await db.get(Document, document_id)
    if not document or not document.file_path:
        raise HTTPException(status_code=404, detail="Document not found")
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and getattr(document, "tenant_id", None) != tenant_id:
        raise HTTPException(status_code=404, detail="Document not found")
    role_val = getattr(current_user.role, "value", str(current_user.role))
    if role_val not in ("super_admin", "team_lead"):
        result = await db.execute(
            select(Employee).where(Employee.user_id == current_user.id)
        )
        emp = result.scalar_one_or_none()
        if not emp:
            raise HTTPException(status_code=403, detail="Access denied")
        if not document.is_company_policy and document.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied")
    if not file_exists(document.file_path):
        raise HTTPException(status_code=404, detail="File not found")
    source_type, path_or_key = resolve_file_source(document.file_path)
    if source_type == "local":
        path = Path(path_or_key)
        if not is_path_safe(path, settings.UPLOAD_DIR):
            raise HTTPException(status_code=403, detail="Access denied")
        return FileResponse(path, filename=document.name)
    # S3: stream bytes
    content = read_file(document.file_path)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{document.name}"'},
    )
