from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class InvoiceResponse(BaseModel):
    id: int
    tenant_id: int
    company_name: str
    company_slug: str
    amount: Optional[Decimal] = None
    due_date: date
    paid_date: Optional[date] = None
    status: str
    company_is_active: bool

    class Config:
        from_attributes = True

