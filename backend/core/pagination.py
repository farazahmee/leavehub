"""
Pagination utilities
"""
from typing import Optional
from pydantic import BaseModel, Field
from math import ceil
from core.config import settings


class PaginationParams(BaseModel):
    """Pagination parameters"""
    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(
        default=settings.DEFAULT_PAGE_SIZE,
        ge=1,
        le=settings.MAX_PAGE_SIZE,
        description="Items per page"
    )
    
    @property
    def skip(self) -> int:
        """Calculate skip value for database queries"""
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        """Get limit value"""
        return self.page_size


def paginate_response(
    items: list,
    total: int,
    page: int,
    page_size: int,
    message: str = "Success"
) -> dict:
    """Create paginated response"""
    total_pages = ceil(total / page_size) if page_size > 0 else 0
    return {
        "success": True,
        "message": message,
        "data": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }
