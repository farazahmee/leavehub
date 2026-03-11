"""
Standardized API response structures
"""
from typing import Optional, Any, Dict
from pydantic import BaseModel


class SuccessResponse(BaseModel):
    """Standard success response"""
    success: bool = True
    message: str
    data: Optional[Any] = None


class ErrorResponse(BaseModel):
    """Standard error response"""
    success: bool = False
    message: str
    errors: Optional[Dict[str, Any]] = None
    error_code: Optional[str] = None


class PaginatedResponse(BaseModel):
    """Paginated response wrapper"""
    success: bool = True
    message: str = "Success"
    data: Any
    total: int
    page: int
    page_size: int
    total_pages: int
