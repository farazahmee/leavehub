"""
Attendance schemas
"""
from pydantic import BaseModel, model_validator
from typing import Optional, Tuple
from datetime import datetime, date


class AttendanceCheckIn(BaseModel):
    """Check-in schema"""
    is_late: Optional[bool] = False


class AttendanceCheckOut(BaseModel):
    """Check-out schema"""
    pass


def _format_duration(total_seconds: float) -> Tuple[float, str]:
    """Return (total_hours, display string e.g. '8h 30m')."""
    hours = total_seconds / 3600
    h = int(total_seconds // 3600)
    m = int((total_seconds % 3600) // 60)
    return (round(hours, 2), f"{h}h {m}m")


class AttendanceResponse(BaseModel):
    """Attendance response schema"""
    id: int
    employee_id: int
    date: date
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    is_late: bool
    is_absent: bool
    total_hours: Optional[float] = None
    total_time_display: Optional[str] = None

    @model_validator(mode="after")
    def compute_total_time(self) -> "AttendanceResponse":
        if self.check_in_time and self.check_out_time:
            delta = self.check_out_time - self.check_in_time
            total_seconds = max(0, delta.total_seconds())
            self.total_hours, self.total_time_display = _format_duration(total_seconds)
        return self

    class Config:
        from_attributes = True


class OvertimeCreate(BaseModel):
    """Overtime creation schema"""
    date: date
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None


class OvertimeResponse(BaseModel):
    """Overtime response schema"""
    id: int
    employee_id: int
    date: date
    start_time: datetime
    end_time: datetime
    hours: Optional[int] = None
    status: str
    
    class Config:
        from_attributes = True
