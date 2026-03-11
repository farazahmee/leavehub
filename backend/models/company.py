"""
Company (Tenant) model for multi-tenant SaaS
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class Company(Base):
    """Company model - represents a tenant in the multi-tenant system"""
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    domain = Column(String(255), unique=True, nullable=True)
    admin_contact_email = Column(String(255), nullable=True)
    admin_contact_name = Column(String(255), nullable=True)
    admin_contact_phone = Column(String(50), nullable=True)
    subscription_plan = Column(String(50), default="free")
    logo_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    onboarding_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    roles = relationship("Role", back_populates="company", cascade="all, delete-orphan")
    users = relationship("User", back_populates="company")
