# Database Setup Guide

## What's Already Set Up

✅ **Database Models** - All tables are defined (User, Employee, Team, Attendance, Leave, Document, Letter, Payroll)  
✅ **Database Configuration** - Connection settings configured  
✅ **Auto Table Creation** - Tables are created automatically when you start the backend  
✅ **Initialization Scripts** - Scripts to create admin user  

## What You Need to Do

### Option 1: Automated Setup (Recommended)

The `setup_database.py` script will:
1. Create the PostgreSQL database (if it doesn't exist)
2. Create all tables
3. Create the super admin user

**Steps:**

1. **Ensure PostgreSQL is running**
   ```bash
   # Check PostgreSQL status
   # Windows: Check Services
   # macOS: brew services list
   # Linux: sudo systemctl status postgresql
   ```

2. **Update `.env` file** in `backend/` directory:
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/workforcehub
   ```
   Replace `YOUR_PASSWORD` with your PostgreSQL password.

3. **Run the setup script:**
   ```bash
   cd backend
   python scripts/setup_database.py
   ```

   The script will:
   - Create the database if it doesn't exist
   - Create all tables
   - Create the admin user

### Option 2: Manual Setup

If you prefer to set up manually:

1. **Create PostgreSQL database:**
   ```bash
   psql -U postgres
   ```
   ```sql
   CREATE DATABASE workforcehub;
   \q
   ```

2. **Update `.env` file** with your database credentials

3. **Start the backend server** (tables will be created automatically):
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

4. **Create admin user** (in a new terminal):
   ```bash
   cd backend
   source venv/bin/activate  # Windows: venv\Scripts\activate
   python scripts/init_db.py
   ```

## Database Structure

The following tables are automatically created:

- **users** - User accounts and authentication
- **employees** - Employee profiles
- **teams** - Team/organizational structure
- **attendances** - Attendance records
- **overtimes** - Overtime requests
- **leaves** - Leave applications
- **leave_balances** - Leave balance tracking
- **documents** - Document storage
- **document_categories** - Document categories
- **letters** - HR letters
- **payrolls** - Payroll records

## Default Admin Credentials

After running the setup script:

- **Email:** admin@workforcehub.com
- **Username:** admin
- **Password:** Admin@123

⚠️ **Change this password immediately after first login!**

## Troubleshooting

### Error: "database does not exist"

**Solution:** Run `setup_database.py` or create database manually:
```sql
CREATE DATABASE workforcehub;
```

### Error: "connection refused"

**Solution:** 
1. Check PostgreSQL is running
2. Verify DATABASE_URL in `.env` file
3. Check PostgreSQL port (default: 5432)

### Error: "password authentication failed"

**Solution:**
1. Verify PostgreSQL password in `.env`
2. Check if PostgreSQL user has permissions

### Error: "relation does not exist"

**Solution:** Tables are created automatically on first startup. Make sure:
1. Backend server has started at least once
2. Database connection is correct
3. User has CREATE TABLE permissions

## Verification

After setup, verify everything works:

1. **Check database exists:**
   ```bash
   psql -U postgres -l | grep workforcehub
   ```

2. **Check tables exist:**
   ```bash
   psql -U postgres -d workforcehub -c "\dt"
   ```

3. **Check admin user exists:**
   ```bash
   psql -U postgres -d workforcehub -c "SELECT username, email FROM users WHERE role = 'super_admin';"
   ```

4. **Test API:**
   - Start backend: `uvicorn main:app --reload`
   - Visit: http://localhost:8000/docs
   - Try the `/health` endpoint

## Next Steps

After database setup:

1. ✅ Start backend server
2. ✅ Start frontend server  
3. ✅ Login with admin credentials
4. ✅ Change admin password
5. ✅ Create teams
6. ✅ Add employees

For complete setup instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md)
