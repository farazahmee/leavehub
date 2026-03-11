"""
Letter request model - employee requests letter, admin fulfills
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class LetterRequest(Base):
    """Letter request from employee - pending until admin generates"""
    __tablename__ = "letter_requests"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    letter_type = Column(String(50), nullable=False)  # experience, recommendation, resignation
    content = Column(Text, nullable=True)  # For resignation: employee writes and submits
    status = Column(String(20), default="pending")  # pending, completed
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", backref="letter_requests")
