"""
Team model
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base

# Import after Base to avoid circular import - Employee references Team via string
from models.employee import Employee


class Team(Base):
    """Team model"""
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(String)
    team_lead_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships - explicit foreign_keys to resolve Employee-Team ambiguity
    # (both team_id and team_lead_id create links between Employee and Team)
    members = relationship(
        "Employee",
        back_populates="team",
        foreign_keys=[Employee.team_id],
    )
    team_lead = relationship("Employee", foreign_keys=[team_lead_id])
