"""
Team schemas
"""
from pydantic import BaseModel
from typing import Optional


class TeamBase(BaseModel):
    """Base team schema"""
    name: str
    description: Optional[str] = None
    team_lead_id: Optional[int] = None


class TeamCreate(TeamBase):
    """Team creation schema"""
    pass


class TeamUpdate(BaseModel):
    """Team update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    team_lead_id: Optional[int] = None


class TeamResponse(TeamBase):
    """Team response schema"""
    id: int
    
    class Config:
        from_attributes = True
