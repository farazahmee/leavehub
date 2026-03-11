"""
Letter models
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from core.database import Base


class LetterType(str, enum.Enum):
    """Letter type enumeration"""
    APPRECIATION = "appreciation"
    INCREMENT = "increment"
    RECOMMENDATION = "recommendation"
    EXPERIENCE = "experience"
    APPOINTMENT = "appointment"
    TERMINATION = "termination"
    RESIGNATION = "resignation"
    OTHER = "other"


class Letter(Base):
    """Letter model"""
    __tablename__ = "letters"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    letter_type = Column(String(50), nullable=False)  # Store as string to avoid PG enum mismatch
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    file_path = Column(String)  # Generated PDF path
    generated_by_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    is_ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id], back_populates="letters")
    generated_by = relationship("Employee", foreign_keys=[generated_by_id])
