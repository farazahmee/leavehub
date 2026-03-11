# WorkForceHub Backend API

FastAPI backend for WorkForceHub HR Management System.

## Features

- Employee Management
- Team Management
- Attendance & Overtime Tracking
- Leave Management
- Document Management
- Letter Generation
- Payroll Management
- Dashboard Analytics
- Role-based Access Control (Super Admin, Team Lead, Employee)
- JWT Authentication

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
   - Database URL
   - JWT secret keys
   - AWS S3 credentials (optional)
   - OpenAI API key (optional)

4. Create PostgreSQL database:
```sql
CREATE DATABASE workforcehub;
```

5. Run migrations (tables are auto-created on startup):
```bash
python main.py
```

6. Start the development server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

## Project Structure

```
backend/
├── api/
│   └── v1/
│       ├── auth.py          # Authentication routes
│       ├── dashboard.py     # Dashboard routes
│       ├── employees.py     # Employee management
│       ├── teams.py         # Team management
│       ├── attendance.py    # Attendance & overtime
│       ├── leave.py         # Leave management
│       ├── documents.py     # Document management
│       ├── letters.py       # Letter generation
│       └── payroll.py       # Payroll management
├── core/
│   ├── config.py            # Application settings
│   ├── database.py          # Database configuration
│   ├── security.py          # Authentication utilities
│   ├── permissions.py       # Permission classes
│   ├── responses.py         # Standardized responses
│   └── pagination.py        # Pagination utilities
├── models/
│   ├── user.py              # User model
│   ├── employee.py          # Employee model
│   ├── team.py              # Team model
│   ├── attendance.py        # Attendance models
│   ├── leave.py             # Leave models
│   ├── document.py          # Document models
│   ├── letter.py            # Letter model
│   └── payroll.py           # Payroll model
├── schemas/
│   ├── auth.py              # Auth schemas
│   ├── employee.py          # Employee schemas
│   ├── team.py              # Team schemas
│   ├── attendance.py        # Attendance schemas
│   ├── leave.py             # Leave schemas
│   ├── document.py          # Document schemas
│   ├── letter.py            # Letter schemas
│   └── payroll.py           # Payroll schemas
├── main.py                  # Application entry point
└── requirements.txt         # Python dependencies
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

### Dashboard
- `GET /api/v1/dashboard/summary` - Get dashboard statistics

### Employees
- `GET /api/v1/employees` - List employees
- `POST /api/v1/employees` - Create employee
- `GET /api/v1/employees/{id}` - Get employee
- `PUT /api/v1/employees/{id}` - Update employee

### Teams
- `GET /api/v1/teams` - List teams
- `POST /api/v1/teams` - Create team
- `GET /api/v1/teams/{id}` - Get team
- `PUT /api/v1/teams/{id}` - Update team
- `DELETE /api/v1/teams/{id}` - Delete team

### Attendance
- `POST /api/v1/attendance/check-in` - Check in
- `POST /api/v1/attendance/check-out` - Check out
- `GET /api/v1/attendance/history` - Get attendance history
- `POST /api/v1/attendance/overtime` - Submit overtime

### Leave
- `POST /api/v1/leave/apply` - Apply for leave
- `GET /api/v1/leave/balance` - Get leave balance
- `GET /api/v1/leave/requests` - List leave requests (admin/team lead)
- `PUT /api/v1/leave/{id}/approve` - Approve leave
- `PUT /api/v1/leave/{id}/reject` - Reject leave

### Documents
- `POST /api/v1/documents/upload` - Upload document
- `GET /api/v1/documents` - List documents
- `GET /api/v1/documents/{id}` - Get document

### Letters
- `POST /api/v1/letters/generate` - Generate letter
- `GET /api/v1/letters` - List letters
- `GET /api/v1/letters/{id}` - Get letter

### Payroll
- `POST /api/v1/payroll/upload` - Upload payroll
- `GET /api/v1/payroll` - List payrolls
- `GET /api/v1/payroll/{id}` - Get payroll

## Testing

Run tests:
```bash
pytest
```
