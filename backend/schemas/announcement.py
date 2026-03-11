"""
Announcement schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AnnouncementCreate(BaseModel):
    title: str
    message: str


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    message: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
