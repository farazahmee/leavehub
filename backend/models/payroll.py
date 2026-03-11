"""
Payroll model
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Numeric, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class Payroll(Base):
    """Payroll model"""
    __tablename__ = "payrolls"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    month = Column(Integer, nullable=False)  # 1-12
    year = Column(Integer, nullable=False)
    basic_salary = Column(Numeric(10, 2))
    allowances = Column(Numeric(10, 2), default=0)
    deductions = Column(Numeric(10, 2), default=0)
    net_salary = Column(Numeric(10, 2))
    currency = Column(String(3), nullable=True)  # ISO 4217 code (e.g. USD, EUR, PKR); required when uploading slip
    file_path = Column(String)  # Salary slip PDF path
    uploaded_by_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id], back_populates="payrolls")
    uploaded_by = relationship("Employee", foreign_keys=[uploaded_by_id])
    
    __table_args__ = (
        {"comment": "Employee payroll records"}
    )
