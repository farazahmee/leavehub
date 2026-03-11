"""
Letter generation routes
"""
import io
import logging
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from pydantic import BaseModel

from core.database import get_db

logger = logging.getLogger(__name__)
from core.security import get_current_active_user
from core.permissions import require_admin_or_team_lead, require_any_authenticated
from core.responses import SuccessResponse
from core.email import send_letter_email
from models.user import User
from models.employee import Employee
from models.letter import Letter, LetterType
from models.letter_request import LetterRequest
from schemas.letter import LetterCreate, LetterUpdate, LetterResponse

router = APIRouter()

# Basic = ~40% of Gross (typical structure). Gross = Basic / 0.4
BASIC_TO_GROSS_RATIO = 0.4


def _build_increment_content(
    content: str,
    increment_amount: float,
    current_basic: float,
) -> str:
    """Calculate new basic & gross and inject into content."""
    new_basic = round(current_basic + increment_amount, 2)
    new_gross = round(new_basic / BASIC_TO_GROSS_RATIO, 2)
    # Replace placeholders if present, else append salary block
    if "{{new_basic}}" in content or "{{new_gross}}" in content or "{{increment_amount}}" in content:
        content = (
            content.replace("{{increment_amount}}", f"{increment_amount:,.2f}")
            .replace("{{current_basic}}", f"{current_basic:,.2f}")
            .replace("{{new_basic}}", f"{new_basic:,.2f}")
            .replace("{{new_gross}}", f"{new_gross:,.2f}")
        )
    else:
        block = f"\n\nIncrement Amount: {increment_amount:,.2f}\nCurrent Basic Salary: {current_basic:,.2f}\nNew Basic Salary: {new_basic:,.2f}\nNew Gross Salary: {new_gross:,.2f}\n"
        content = content.rstrip() + block
    return content


def _detect_letter_type(content: str) -> str:
    """Auto-detect letter type from extracted PDF text based on keyword patterns."""
    if not content or not content.strip():
        return "experience"
    text = content.lower().strip()
    scores = {"experience": 0, "recommendation": 0, "appreciation": 0}
    # Experience letter signals
    exp_terms = ["experience letter", "employment letter", "employed", "employment", "tenure", "worked with", "worked as", "full-time", "part-time", "basis from", "employment period", "served as", "held the position"]
    for term in exp_terms:
        if term in text:
            scores["experience"] += 1
    # Recommendation letter signals
    rec_terms = ["recommend", "recommendation", "highly recommend", "strongly recommend", "professionalism", "expertise", "would recommend", "letter of recommendation"]
    for term in rec_terms:
        if term in text:
            scores["recommendation"] += 1
    # Appreciation letter signals
    appr_terms = ["appreciation", "appreciate", "outstanding", "exceptional", "thank you for", "dedication", "grateful", "commend", "excellent performance"]
    for term in appr_terms:
        if term in text:
            scores["appreciation"] += 1
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "experience"


def _normalize_pdf_extracted_text(raw: str) -> str:
    """Fix fragmented PDF text where each word ends up on its own line."""
    if not raw or not raw.strip():
        return ""
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    if not lines:
        return ""
    result = []
    current = []
    for line in lines:
        # Line is a fragment if short and doesn't end sentence
        is_fragment = len(line) < 60 and line and line[-1] not in ".!?:"
        if is_fragment:
            current.append(line)
        else:
            if current:
                result.append(" ".join(current))
                current = []
            result.append(line)
    if current:
        result.append(" ".join(current))
    # Join paragraphs: group consecutive lines, split on double-newline in original
    return "\n\n".join(result).strip()


@router.post("/extract-pdf", response_model=SuccessResponse)
async def extract_pdf_text(
    file: UploadFile = File(...),
    current_user=Depends(require_admin_or_team_lead),
):
    """Extract text from uploaded PDF for use as letter template. Admin can edit and send."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file")
    try:
        from pypdf import PdfReader
        contents = await file.read()
        reader = PdfReader(io.BytesIO(contents))
        text_parts = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
        raw = "\n".join(text_parts).strip() if text_parts else ""
        content = _normalize_pdf_extracted_text(raw)
        letter_type = _detect_letter_type(content)
        title = f"{letter_type.replace('_', ' ').title()} Letter"
        return SuccessResponse(
            message="Text extracted from PDF",
            data={"content": content, "letter_type": letter_type, "title": title},
        )
    except Exception as e:
        logger.warning(f"PDF extraction failed: {e}")
        raise HTTPException(status_code=400, detail="Could not extract text from PDF. Try a different file.")


@router.post("/generate", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def generate_letter(
    letter_data: LetterCreate,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Generate HR letter and send to employee's email."""
    from core.config import settings

    try:
        return await _generate_letter_impl(letter_data, current_user, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Letter generation failed: {e}")
        detail = str(e) if getattr(settings, "DEBUG", False) else "Letter generation failed. Check server logs."
        raise HTTPException(status_code=500, detail=detail)


async def _generate_letter_impl(letter_data: LetterCreate, current_user: User, db: AsyncSession):
    """Implementation of letter generation."""
    employee = await db.get(Employee, letter_data.employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )

    content = letter_data.content
    # Replace {{employee_name}} placeholder
    employee_name = f"{employee.first_name} {employee.last_name}"
    content = content.replace("{{employee_name}}", employee_name)

    if letter_data.letter_type == LetterType.INCREMENT and letter_data.increment_amount is not None:
        current_basic = letter_data.current_basic
        if current_basic is None and letter_data.current_gross is not None:
            current_basic = float(letter_data.current_gross) * BASIC_TO_GROSS_RATIO
        if current_basic is not None:
            content = _build_increment_content(
                content,
                float(letter_data.increment_amount),
                float(current_basic),
            )

    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    generator = result.scalar_one_or_none()

    letter = Letter(
        employee_id=letter_data.employee_id,
        letter_type=letter_data.letter_type.value,
        title=letter_data.title,
        content=content,
        generated_by_id=generator.id if generator else None,
        is_ai_generated=letter_data.is_ai_generated or False,
        tenant_id=getattr(employee, "tenant_id", None) or getattr(current_user, "tenant_id", None),
    )
    db.add(letter)
    await db.commit()
    await db.refresh(letter)

    # Send letter to employee's email
    email_sent = False
    try:
        user_result = await db.execute(select(User).where(User.id == employee.user_id))
        user = user_result.scalar_one_or_none()
        if user and user.email:
            email_sent = send_letter_email(
                to_email=user.email,
                employee_name=employee_name,
                letter_type=letter_data.letter_type.value,
                title=letter_data.title,
                content=content,
            )
    except Exception as e:
        logger.warning(f"Letter email send failed for {employee_name}: {e}")

    try:
        letter_dict = LetterResponse.model_validate(letter).model_dump(mode="json")
    except Exception as e:
        logger.warning(f"Letter response serialize: {e}")
        letter_dict = {
            "id": letter.id,
            "employee_id": letter.employee_id,
            "letter_type": letter_data.letter_type.value,
            "title": letter.title,
            "content": letter.content,
            "file_path": letter.file_path,
            "is_ai_generated": getattr(letter, "is_ai_generated", False),
            "created_at": letter.created_at.isoformat() if letter.created_at else None,
        }
    letter_dict["email_sent"] = email_sent

    return SuccessResponse(
        message="Letter generated successfully. " + (
            "Sent to employee email." if email_sent else "Email not sent (SMTP not configured or no email)."
        ),
        data=letter_dict
    )


@router.post("/request", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def request_letter(
    letter_type: str,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db),
):
    """Employee requests a letter (experience, recommendation, resignation)."""
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )
    lt = (letter_type or "").strip().lower()
    if lt not in ("experience", "recommendation"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="letter_type must be experience or recommendation",
        )
    req = LetterRequest(
        employee_id=employee.id,
        letter_type=lt,
        status="pending",
        tenant_id=getattr(employee, "tenant_id", None),
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return SuccessResponse(
        message=f"Letter request submitted. Admin will process your {lt} letter.",
        data={"id": req.id, "letter_type": lt, "status": "pending"},
    )


class ResignationSubmit(BaseModel):
    content: str


@router.post("/submit-resignation", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def submit_resignation_letter(
    body: ResignationSubmit,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db),
):
    """Employee creates and submits resignation letter to admin."""
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resignation letter content is required",
        )
    req = LetterRequest(
        employee_id=employee.id,
        letter_type="resignation",
        content=content,
        status="pending",
        tenant_id=getattr(employee, "tenant_id", None),
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return SuccessResponse(
        message="Resignation letter submitted. Admin will review it.",
        data={"id": req.id, "letter_type": "resignation", "status": "pending"},
    )


@router.get("/my-requests", response_model=SuccessResponse)
async def list_my_letter_requests(
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db),
):
    """List current user's letter requests (employee sees own requests with status)."""
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        return SuccessResponse(message="Letter requests retrieved", data=[])
    query = (
        select(LetterRequest)
        .where(LetterRequest.employee_id == employee.id)
        .order_by(LetterRequest.created_at.desc())
    )
    req_result = await db.execute(query)
    requests = req_result.scalars().all()
    data = [
        {
            "id": r.id,
            "letter_type": r.letter_type,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in requests
    ]
    return SuccessResponse(message="Letter requests retrieved", data=data)


@router.get("/requests", response_model=SuccessResponse)
async def list_letter_requests(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
    """List letter requests (admin only). Tenant users see only their company's requests."""
    query = select(LetterRequest).options(selectinload(LetterRequest.employee))
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None:
        query = query.where(LetterRequest.tenant_id == tenant_id)
    if status_filter:
        query = query.where(LetterRequest.status == status_filter)
    query = query.order_by(LetterRequest.created_at.desc())
    result = await db.execute(query)
    requests = result.scalars().all()
    data = [
        {
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": f"{r.employee.first_name} {r.employee.last_name}" if r.employee else "",
            "letter_type": r.letter_type,
            "status": r.status,
            "content": getattr(r, "content", None),
            "created_at": r.created_at,
        }
        for r in requests
    ]
    return SuccessResponse(message="Letter requests retrieved", data=data)


@router.put("/requests/{request_id}/complete", response_model=SuccessResponse)
async def complete_letter_request(
    request_id: int,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
    """Mark letter request as completed. Tenant users only for same company."""
    req = await db.get(LetterRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Letter request not found")
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and getattr(req, "tenant_id", None) != tenant_id:
        raise HTTPException(status_code=404, detail="Letter request not found")
    req.status = "completed"
    await db.commit()
    return SuccessResponse(message="Request marked as completed")


@router.put("/requests/{request_id}/reject", response_model=SuccessResponse)
async def reject_letter_request(
    request_id: int,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
    """Reject a letter request (for resignation letters). Tenant users only for same company."""
    req = await db.get(LetterRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Letter request not found")
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and getattr(req, "tenant_id", None) != tenant_id:
        raise HTTPException(status_code=404, detail="Letter request not found")
    if req.letter_type != "resignation":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reject is only for resignation requests",
        )
    req.status = "rejected"
    await db.commit()
    return SuccessResponse(message="Resignation letter rejected")


@router.put("/requests/{request_id}/accept", response_model=SuccessResponse)
async def accept_resignation_request(
    request_id: int,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db),
):
    """Accept resignation letter. Tenant users only for same company."""
    req = await db.get(LetterRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Letter request not found")
    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is not None and getattr(req, "tenant_id", None) != tenant_id:
        raise HTTPException(status_code=404, detail="Letter request not found")
    if req.letter_type != "resignation":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Accept is only for resignation requests",
        )
    employee = await db.get(Employee, req.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee_name = f"{employee.first_name} {employee.last_name}"
    content = (getattr(req, "content", None) or "").strip()
    if not content:
        content = (
            f"To Whom It May Concern,\n\n"
            f"This is to confirm that {employee_name} has tendered their resignation. "
            "Their last working day will be as per the notice period agreed upon.\n\n"
            "Best regards,\nHR Department"
        )
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    generator = result.scalar_one_or_none()
    letter = Letter(
        employee_id=req.employee_id,
        letter_type="resignation",
        title="Resignation Letter",
        content=content,
        generated_by_id=generator.id if generator else None,
        is_ai_generated=False,
        tenant_id=getattr(req, "tenant_id", None) or getattr(employee, "tenant_id", None),
    )
    db.add(letter)
    req.status = "completed"
    await db.commit()
    await db.refresh(letter)
    email_sent = False
    try:
        user_result = await db.execute(select(User).where(User.id == employee.user_id))
        user = user_result.scalar_one_or_none()
        if user and user.email:
            email_sent = send_letter_email(
                to_email=user.email,
                employee_name=employee_name,
                letter_type="resignation",
                title="Resignation Letter",
                content=content,
            )
    except Exception as e:
        logger.warning(f"Resignation letter email send failed: {e}")
    return SuccessResponse(
        message="Resignation accepted. Letter created and " + (
            "sent to employee email." if email_sent else "email not sent."
        ),
        data={"id": letter.id, "email_sent": email_sent},
    )


@router.get("", response_model=SuccessResponse)
async def list_letters(
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """List letters. Tenant users see their company's letters; employees see own only."""
    query = select(Letter)
    tenant_id = getattr(current_user, "tenant_id", None)
    role_val = getattr(current_user.role, "value", str(current_user.role))
    if tenant_id is not None:
        # Tenant-scoped users see only their own company's letters
        query = query.where(Letter.tenant_id == tenant_id)
    elif role_val not in ("super_admin", "team_lead"):
        result = await db.execute(
            select(Employee).where(Employee.user_id == current_user.id)
        )
        employee = result.scalar_one_or_none()
        if employee:
            query = query.where(Letter.employee_id == employee.id)
    query = query.order_by(Letter.created_at.desc()).options(
        selectinload(Letter.employee).selectinload(Employee.team)
    )
    result = await db.execute(query)
    letters = result.unique().scalars().all()
    # Normalize letter_type (DB may have uppercase from old enum)
    data = []
    for letter in letters:
        lt = (getattr(letter, "letter_type", "") or "").lower()
        emp = getattr(letter, "employee", None)
        employee_name = f"{emp.first_name} {emp.last_name}" if emp else ""
        employee_code = getattr(emp, "employee_id", None) if emp else None
        designation = (getattr(emp, "designation", None) or "") if emp else ""
        team_name = (getattr(emp.team, "name", None) or "") if emp and getattr(emp, "team", None) else ""
        data.append({
            "id": letter.id,
            "employee_id": letter.employee_id,
            "employee_name": employee_name,
            "employee_code": employee_code,
            "designation": designation,
            "team_name": team_name,
            "letter_type": lt,
            "title": letter.title,
            "content": letter.content,
            "file_path": letter.file_path,
            "is_ai_generated": getattr(letter, "is_ai_generated", False),
            "created_at": letter.created_at,
        })
    return SuccessResponse(message="Letters retrieved", data=data)


@router.get("/{letter_id}", response_model=SuccessResponse)
async def get_letter(
    letter_id: int,
    current_user: User = Depends(require_any_authenticated),
    db: AsyncSession = Depends(get_db)
):
    """Get letter by ID"""
    letter = await db.get(Letter, letter_id)
    if not letter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Letter not found"
        )
    
    # Check access: admin/team_lead see all; employees only their own
    role_val = getattr(current_user.role, "value", str(current_user.role))
    if role_val not in ("super_admin", "team_lead"):
        result = await db.execute(
            select(Employee).where(Employee.user_id == current_user.id)
        )
        employee = result.scalar_one_or_none()
        if not employee or letter.employee_id != employee.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    emp_result = await db.execute(
        select(Employee).options(selectinload(Employee.team)).where(Employee.id == letter.employee_id)
    )
    emp = emp_result.scalar_one_or_none()
    employee_name = f"{emp.first_name} {emp.last_name}" if emp else ""
    employee_code = getattr(emp, "employee_id", None) if emp else None
    designation = (getattr(emp, "designation", None) or "") if emp else ""
    team_name = (getattr(emp.team, "name", None) or "") if emp and getattr(emp, "team", None) else ""
    lt = (getattr(letter, "letter_type", "") or "").lower()
    return SuccessResponse(
        message="Letter retrieved",
        data={
            "id": letter.id,
            "employee_id": letter.employee_id,
            "employee_name": employee_name,
            "employee_code": employee_code,
            "designation": designation,
            "team_name": team_name,
            "letter_type": lt,
            "title": letter.title,
            "content": letter.content,
            "file_path": letter.file_path,
            "is_ai_generated": getattr(letter, "is_ai_generated", False),
            "created_at": letter.created_at,
        }
    )


@router.put("/{letter_id}", response_model=SuccessResponse)
async def update_letter(
    letter_id: int,
    update_data: LetterUpdate,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Update letter and resend to employee's email (admin/team_lead only)"""
    letter = await db.get(Letter, letter_id)
    if not letter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Letter not found")

    if update_data.employee_id is not None and update_data.employee_id != letter.employee_id:
        new_employee = await db.get(Employee, update_data.employee_id)
        if not new_employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        old_employee = await db.get(Employee, letter.employee_id)
        old_name = f"{old_employee.first_name} {old_employee.last_name}" if old_employee else ""
        new_name = f"{new_employee.first_name} {new_employee.last_name}"
        letter.employee_id = update_data.employee_id
        # Replace old employee name or {{employee_name}} placeholder in content
        letter.content = letter.content.replace("{{employee_name}}", new_name)
        if old_name:
            letter.content = letter.content.replace(old_name, new_name)
    if update_data.title is not None:
        letter.title = update_data.title
    if update_data.content is not None:
        letter.content = update_data.content
    await db.commit()
    await db.refresh(letter)

    employee = await db.get(Employee, letter.employee_id)
    employee_name = f"{employee.first_name} {employee.last_name}" if employee else ""
    lt = (getattr(letter, "letter_type", "") or "").lower()

    # Resend letter to employee's email
    email_sent = False
    if employee:
        try:
            user_result = await db.execute(select(User).where(User.id == employee.user_id))
            user = user_result.scalar_one_or_none()
            if user and user.email:
                email_sent = send_letter_email(
                    to_email=user.email,
                    employee_name=employee_name,
                    letter_type=lt,
                    title=letter.title,
                    content=letter.content,
                )
        except Exception as e:
            logger.warning(f"Letter email send failed for {employee_name}: {e}")

    msg = "Letter updated. " + ("Sent to employee email." if email_sent else "Email not sent (SMTP not configured or no email).")
    return SuccessResponse(
        message=msg,
        data={
            "id": letter.id,
            "employee_id": letter.employee_id,
            "employee_name": employee_name,
            "letter_type": lt,
            "title": letter.title,
            "content": letter.content,
            "file_path": letter.file_path,
            "is_ai_generated": getattr(letter, "is_ai_generated", False),
            "created_at": letter.created_at,
            "email_sent": email_sent,
        }
    )


@router.delete("/{letter_id}", response_model=SuccessResponse)
async def delete_letter(
    letter_id: int,
    current_user: User = Depends(require_admin_or_team_lead),
    db: AsyncSession = Depends(get_db)
):
    """Delete letter (admin/team_lead only)"""
    letter = await db.get(Letter, letter_id)
    if not letter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Letter not found")
    await db.delete(letter)
    await db.commit()
    return SuccessResponse(message="Letter deleted")
