"""API v1 routes"""
from fastapi import APIRouter
from api.v1 import (
    auth,
    google_auth,
    tenant,
    admin,
    employees,
    teams,
    attendance,
    leave,
    documents,
    letters,
    payroll,
    dashboard,
    reports,
    announcements,
    superadmin,
    roles,
)

api_router = APIRouter()

api_router.include_router(superadmin.router, prefix="/superadmin", tags=["Super Admin"])

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(tenant.router, prefix="/tenant", tags=["Tenant"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(google_auth.router, prefix="/auth", tags=["Google Auth"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(employees.router, prefix="/employees", tags=["Employees"])
api_router.include_router(teams.router, prefix="/teams", tags=["Teams"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["Attendance"])
api_router.include_router(leave.router, prefix="/leave", tags=["Leave Management"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(letters.router, prefix="/letters", tags=["Letters"])
api_router.include_router(payroll.router, prefix="/payroll", tags=["Payroll"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(announcements.router, prefix="/announcements", tags=["Announcements"])
api_router.include_router(roles.router, prefix="/roles", tags=["Roles"])
