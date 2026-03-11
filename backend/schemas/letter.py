"""
Letter schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal

from models.letter import LetterType


class LetterUpdate(BaseModel):
    """Letter update schema"""
    employee_id: Optional[int] = None
    title: Optional[str] = None
    content: Optional[str] = None


class LetterCreate(BaseModel):
    """Letter creation schema"""
    employee_id: int
    letter_type: LetterType
    title: str
    content: str
    is_ai_generated: Optional[bool] = False
    # Increment letter: user provides amount + current_basic OR current_gross; backend calculates new basic & gross
    increment_amount: Optional[float] = None
    current_basic: Optional[float] = None
    current_gross: Optional[float] = None  # If provided, current_basic = current_gross * 0.4


class LetterResponse(BaseModel):
    """Letter response schema"""
    id: int
    employee_id: int
    letter_type: str  # Accept DB values (may be uppercase from old enum)
    title: str
    content: str
    file_path: Optional[str] = None
    is_ai_generated: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
