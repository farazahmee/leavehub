# Quick Start Guide

## Prerequisites Check

**Windows Users:** See [WINDOWS_POSTGRESQL_SETUP.md](WINDOWS_POSTGRESQL_SETUP.md) for detailed PostgreSQL installation guide.

```bash
# Check Python version (need 3.10+)
python --version

# Check Node.js version (need 18+)
node --version

# Check PostgreSQL version (need 14+)
psql --version
# If command not found, PostgreSQL may not be in PATH
# Use: "C:\Program Files\PostgreSQL\16\bin\psql.exe" --version
```

## Quick Setup (5 Minutes)

### 1. Database Setup (1 minute)

**Windows Users:** You can use the automated script:
```cmd
cd backend
windows_setup.bat
```

**Or manually:**

```bash
# Connect to PostgreSQL
psql -U postgres
# Windows: "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres

# Create database
CREATE DATABASE workforcehub;
\q
```

**Note:** If you haven't installed PostgreSQL yet, see [WINDOWS_POSTGRESQL_SETUP.md](WINDOWS_POSTGRESQL_SETUP.md)

### 2. Backend Setup (2 minutes)

**Windows Users - Easy Way:**
```cmd
cd backend
windows_setup.bat
```

**Manual Setup:**

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
# Windows:
copy .env.example .env
# macOS/Linux:
cp .env.example .env

# Edit .env and update DATABASE_URL:
# DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/workforcehub

# Initialize database with admin user
python scripts\setup_database.py
# Or use: python scripts/init_db.py (if database already exists)

# Start backend server
uvicorn main:app --reload
```

Backend will run on: http://localhost:8000

### 3. Frontend Setup (2 minutes)

```bash
# Open new terminal
cd frontend

# Install dependencies
npm install

# Start frontend server
npm run dev
```

Frontend will run on: http://localhost:3000

### 4. Login

1. Open http://localhost:3000
2. Login with:
   - **Username:** admin
   - **Password:** Admin@123

## Default Credentials

- **Email:** admin@workforcehub.com
- **Username:** admin
- **Password:** Admin@123

⚠️ **Change password immediately after first login!**

## Troubleshooting

### Backend won't start
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Ensure virtual environment is activated

### Frontend won't start
- Delete `node_modules` and run `npm install` again
- Check if port 3000 is available

### Can't login
- Verify backend is running on port 8000
- Check browser console for errors
- Verify CORS_ORIGINS in backend/.env includes http://localhost:3000

## Next Steps

1. Change admin password
2. Create teams
3. Add employees
4. Configure leave policies

For detailed setup instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md)
