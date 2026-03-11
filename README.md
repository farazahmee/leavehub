# WorkForceHub - HR Management System

A comprehensive HR management platform designed for SMEs and remote teams. Built with FastAPI backend and React frontend.

## Features

- **Employee Management** - Complete employee lifecycle management
- **Team Management** - Organize employees into teams with team leads
- **Attendance Tracking** - Check-in/out system with overtime tracking
- **Leave Management** - Leave applications with approval workflow
- **Document Center** - Company policies and employee documents
- **Letter Generation** - AI-assisted HR letter generation
- **Payroll Summary** - Salary slip management
- **Dashboard** - Real-time analytics and insights
- **Role-Based Access** - Super Admin, Team Lead, and Employee roles

## Tech Stack

### Backend
- FastAPI
- SQLAlchemy (async)
- PostgreSQL
- JWT Authentication
- Pydantic for validation

### Frontend
- React 18
- Vite
- React Router
- TanStack Query
- Zustand
- Tailwind CSS

## Project Structure

```
HR-man/
├── backend/          # FastAPI backend
│   ├── api/         # API routes
│   ├── core/       # Core utilities
│   ├── models/     # Database models
│   ├── schemas/    # Pydantic schemas
│   └── main.py     # Application entry
├── frontend/        # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── store/
│   └── package.json
└── README.md
```

## Quick Start

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

5. Update `.env` with your database credentials and settings.

6. Create PostgreSQL database:
```sql
CREATE DATABASE workforcehub;
```

7. Run the server (must use port 8080 for frontend proxy):
```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

Backend API will be available at `http://localhost:8080`
API Documentation: `http://localhost:8080/docs`

> **Important:** The frontend proxies `/api` to `http://localhost:8080`. Start the backend before the frontend, or you will see `ECONNREFUSED` proxy errors.

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

Frontend will be available at `http://localhost:5174`

### Run both (Windows)

From the project root, double-click `dev.bat` or run:
```bash
dev.bat
```
This starts the backend and frontend in separate terminal windows.

### Run both (manual)

1. **Terminal 1** – Backend:
   ```bash
   cd backend
   venv\Scripts\activate   # Windows
   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8080
   ```

2. **Terminal 2** – Frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## Development

### Backend Development

- API routes are organized by feature in `api/v1/`
- Database models are in `models/`
- Pydantic schemas for validation in `schemas/`
- Core utilities in `core/`

### Frontend Development

- Pages are in `src/pages/`
- Reusable components in `src/components/`
- API service in `src/services/api.js`
- State management in `src/store/`

## API Endpoints

See `backend/README.md` for complete API documentation.

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT License
