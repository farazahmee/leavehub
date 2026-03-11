"""
Document models
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class DocumentCategory(Base):
    """Document category model"""
    __tablename__ = "document_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    documents = relationship("Document", back_populates="category")


class Document(Base):
    """Document model"""
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)  # Null for company policies
    category_id = Column(Integer, ForeignKey("document_categories.id"), nullable=True)
    name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)  # S3 path or local path
    file_type = Column(String)  # pdf, docx, etc.
    file_size = Column(Integer)  # Size in bytes
    is_company_policy = Column(Boolean, default=False)  # True for company-wide documents
    description = Column(Text)
    expiry_date = Column(Date, nullable=True)  # For passport, visa, contract, certifications
    uploaded_by_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id], back_populates="documents")
    category = relationship("DocumentCategory", back_populates="documents")
    uploaded_by = relationship("Employee", foreign_keys=[uploaded_by_id])
