"""
Document schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date


class DocumentCreate(BaseModel):
    """Document creation schema"""
    name: str
    category_id: Optional[int] = None
    is_company_policy: bool = False
    description: Optional[str] = None


class DocumentResponse(BaseModel):
    """Document response schema"""
    id: int
    employee_id: Optional[int] = None
    category_id: Optional[int] = None
    name: str
    file_path: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    is_company_policy: bool
    description: Optional[str] = None
    expiry_date: Optional[date] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
