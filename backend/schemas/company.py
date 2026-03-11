"""
Pydantic schemas for Company (Tenant) CRUD
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date


class CompanyCreate(BaseModel):
    """Create a new company / tenant"""
    name: str
    domain: Optional[str] = None  # e.g. "timesquarellc.com" - auto-derived from admin_contact_email if not provided
    admin_contact_email: Optional[str] = None
    admin_contact_name: Optional[str] = None
    admin_contact_phone: Optional[str] = None
    subscription_plan: Optional[str] = "free"
    onboarding_date: Optional[date] = None


class CompanyUpdate(BaseModel):
    """Update an existing company"""
    name: Optional[str] = None
    domain: Optional[str] = None
    admin_contact_email: Optional[str] = None
    admin_contact_name: Optional[str] = None
    admin_contact_phone: Optional[str] = None
    subscription_plan: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None
    onboarding_date: Optional[date] = None


class CompanyResponse(BaseModel):
    """Company response"""
    id: int
    name: str
    slug: str
    domain: Optional[str] = None
    admin_contact_email: Optional[str] = None
    admin_contact_name: Optional[str] = None
    admin_contact_phone: Optional[str] = None
    subscription_plan: str
    logo_url: Optional[str] = None
    is_active: bool
    onboarding_date: Optional[date] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
