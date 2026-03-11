# WorkForceHub - Complete Setup Guide

This guide will walk you through setting up the WorkForceHub HR Management System step by step.

## Prerequisites

Before starting, ensure you have the following installed:

- **Python 3.10+** (Check with `python --version`)
- **Node.js 18+** and npm (Check with `node --version` and `npm --version`)
- **PostgreSQL 14+** (Check with `psql --version`)
- **Git** (for cloning the repository)

## Step 1: Database Setup

### 1.1 Install PostgreSQL

**Windows 10:**
- **📘 See detailed guide:** [WINDOWS_POSTGRESQL_SETUP.md](WINDOWS_POSTGRESQL_SETUP.md)
- Quick steps:
  1. Download from https://www.postgresql.org/download/windows/
  2. Run installer, set password for `postgres` user
  3. Keep default port (5432)
  4. Install pgAdmin 4 (optional but recommended)

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 1.2 Create Database

Open PostgreSQL command line or pgAdmin:

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE workforcehub;

-- Create user (optional, you can use postgres user)
CREATE USER workforcehub_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE workforcehub TO workforcehub_user;

-- Exit psql
\q
```

## Step 2: Backend Setup

### 2.1 Navigate to Backend Directory

```bash
cd backend
```

### 2.2 Create Virtual Environment

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

### 2.3 Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 2.4 Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
# Copy example file
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Application
ENVIRONMENT=development
DEBUG=True
SECRET_KEY=your-secret-key-change-in-production-use-random-string-here
JWT_SECRET_KEY=your-jwt-secret-key-change-in-production-use-random-string-here

# Database - Update with your PostgreSQL credentials
DATABASE_URL=postgresql+asyncpg://postgres:your_password@localhost:5432/workforcehub

# CORS Origins
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# JWT Settings
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# AWS S3 (Optional - leave empty if not using)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=
AWS_S3_ENDPOINT_URL=

# OpenAI (Optional - for AI letter generation)
OPENAI_API_KEY=
```

**Important:** Generate secure random strings for `SECRET_KEY` and `JWT_SECRET_KEY`. You can use:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2.5 Initialize Database

The database tables will be created automatically when you start the server. However, to create the initial super admin user:

```bash
python scripts/init_db.py
```

This creates:
- **Email:** admin@workforcehub.com
- **Username:** admin
- **Password:** Admin@123

**⚠️ IMPORTANT:** Change this password immediately after first login!

### 2.6 Start Backend Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at:
- **API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs
- **Alternative Docs:** http://localhost:8000/redoc

You should see output like:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

## Step 3: Frontend Setup

### 3.1 Navigate to Frontend Directory

Open a **new terminal window** (keep backend running) and:

```bash
cd frontend
```

### 3.2 Install Dependencies

```bash
npm install
```

This may take a few minutes. You should see:
```
added XXX packages, and audited XXX packages in XXs
```

### 3.3 Start Development Server

```bash
npm run dev
```

The frontend will be available at:
- **Frontend:** http://localhost:3000

You should see:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

## Step 4: Verify Installation

### 4.1 Test Backend

1. Open http://localhost:8000/docs in your browser
2. You should see the Swagger API documentation
3. Try the `/health` endpoint to verify the server is running

### 4.2 Test Frontend

1. Open http://localhost:3000 in your browser
2. You should see the login page
3. Login with:
   - **Username:** admin
   - **Password:** Admin@123

### 4.3 Test Database Connection

If you see any database connection errors:

1. Verify PostgreSQL is running:
   ```bash
   # Windows
   services.msc (look for PostgreSQL)
   
   # macOS/Linux
   sudo systemctl status postgresql
   ```

2. Verify database exists:
   ```bash
   psql -U postgres -l
   ```

3. Check DATABASE_URL in `.env` file

## Step 5: Common Issues and Solutions

### Issue: Port Already in Use

**Backend (port 8000):**
```bash
# Find process using port 8000
# Windows
netstat -ano | findstr :8000

# macOS/Linux
lsof -i :8000

# Kill the process or use a different port
uvicorn main:app --reload --port 8001
```

**Frontend (port 3000):**
```bash
# Use a different port
npm run dev -- --port 3001
```

### Issue: Database Connection Error

1. Verify PostgreSQL is running
2. Check DATABASE_URL format: `postgresql+asyncpg://user:password@host:port/database`
3. Ensure database exists: `CREATE DATABASE workforcehub;`
4. Check firewall settings

### Issue: Module Not Found (Python)

```bash
# Ensure virtual environment is activated
# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### Issue: npm Install Fails

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: CORS Errors

Ensure `CORS_ORIGINS` in `.env` includes your frontend URL:
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Step 6: Production Deployment (Optional)

### Backend Production

1. Set `ENVIRONMENT=production` in `.env`
2. Set `DEBUG=False`
3. Use a production WSGI server:
   ```bash
   pip install gunicorn
   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
   ```

### Frontend Production

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Serve with a web server (nginx, Apache, etc.) or use:
   ```bash
   npm run preview
   ```

## Step 7: Next Steps

1. **Change Default Password:** Login and change the admin password
2. **Create Teams:** Set up your organizational structure
3. **Add Employees:** Start adding employees to the system
4. **Configure Settings:** Set up leave policies, document categories, etc.

## Project Structure

```
HR-man/
├── backend/              # FastAPI backend
│   ├── api/             # API routes
│   ├── core/            # Core utilities
│   ├── models/          # Database models
│   ├── schemas/         # Pydantic schemas
│   ├── scripts/         # Utility scripts
│   ├── main.py          # Application entry
│   └── requirements.txt # Python dependencies
├── frontend/            # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API services
│   │   └── store/       # State management
│   └── package.json     # Node dependencies
└── SETUP_GUIDE.md       # This file
```

## Support

If you encounter issues:

1. Check the error logs in the terminal
2. Verify all prerequisites are installed
3. Ensure all environment variables are set correctly
4. Check database connectivity
5. Review the API documentation at http://localhost:8000/docs

## Security Notes

- **Never commit `.env` files** to version control
- **Change default passwords** immediately
- **Use strong SECRET_KEY and JWT_SECRET_KEY** in production
- **Enable HTTPS** in production
- **Regularly update dependencies** for security patches

---

**Congratulations!** Your WorkForceHub HR Management System is now set up and ready to use! 🎉
