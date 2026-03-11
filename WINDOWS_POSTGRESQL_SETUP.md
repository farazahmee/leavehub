# PostgreSQL Installation & Setup Guide for Windows 10

This guide will walk you through installing PostgreSQL on Windows 10 and setting up the WorkForceHub database.

## Step 1: Download PostgreSQL

1. **Visit the PostgreSQL download page:**
   - Go to: https://www.postgresql.org/download/windows/
   - Or directly: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

2. **Download the installer:**
   - Click "Download the installer"
   - Select the latest version (PostgreSQL 15 or 16)
   - Choose the Windows x86-64 installer
   - File will be something like: `postgresql-16.x-windows-x64.exe`

## Step 2: Install PostgreSQL

1. **Run the installer:**
   - Double-click the downloaded `.exe` file
   - If you see a security warning, click "Run" or "Yes"

2. **Installation Wizard Steps:**

   **a. Welcome Screen:**
   - Click "Next"

   **b. Installation Directory:**
   - Default: `C:\Program Files\PostgreSQL\16` (or your version)
   - Keep default and click "Next"

   **c. Select Components:**
   - ✅ PostgreSQL Server (required)
   - ✅ pgAdmin 4 (GUI tool - recommended)
   - ✅ Stack Builder (optional - you can skip)
   - ✅ Command Line Tools (required)
   - Click "Next"

   **d. Data Directory:**
   - Default: `C:\Program Files\PostgreSQL\16\data`
   - Keep default and click "Next"

   **e. Password Setup (IMPORTANT!):**
   - **Enter a password for the `postgres` superuser**
   - ⚠️ **Remember this password!** You'll need it for database setup
   - Example: `postgres123` (use something secure)
   - Click "Next"

   **f. Port:**
   - Default: `5432`
   - Keep default and click "Next"

   **g. Advanced Options:**
   - Locale: `[Default locale]`
   - Click "Next"

   **h. Ready to Install:**
   - Review settings
   - Click "Next" to start installation

   **i. Installation Progress:**
   - Wait for installation to complete (may take a few minutes)
   - Click "Next" when done

   **j. Completing Installation:**
   - ✅ Uncheck "Launch Stack Builder" (optional)
   - Click "Finish"

## Step 3: Verify Installation

### Method 1: Using Command Prompt

1. **Open Command Prompt:**
   - Press `Windows Key + R`
   - Type `cmd` and press Enter

2. **Check PostgreSQL version:**
   ```cmd
   psql --version
   ```
   You should see something like: `psql (PostgreSQL) 16.x`

3. **If command not found:**
   - PostgreSQL might not be in your PATH
   - Navigate to: `C:\Program Files\PostgreSQL\16\bin`
   - Or add it to PATH (see below)

### Method 2: Using pgAdmin (GUI)

1. **Open pgAdmin 4:**
   - Search for "pgAdmin 4" in Start Menu
   - Click to open

2. **Set Master Password (first time only):**
   - Enter a password to protect saved passwords
   - Click "OK"

3. **Connect to Server:**
   - Left panel: Expand "Servers" → "PostgreSQL 16"
   - Enter password (the one you set during installation)
   - Check "Save password" if you want
   - Click "OK"

4. **Verify Connection:**
   - You should see the server connected
   - Expand to see "Databases" folder

## Step 4: Add PostgreSQL to PATH (Optional but Recommended)

This allows you to use `psql` from any directory:

1. **Open System Properties:**
   - Press `Windows Key + X`
   - Click "System"
   - Click "Advanced system settings"
   - Click "Environment Variables"

2. **Edit PATH:**
   - Under "System variables", find "Path"
   - Click "Edit"
   - Click "New"
   - Add: `C:\Program Files\PostgreSQL\16\bin`
   - Click "OK" on all windows

3. **Restart Command Prompt** for changes to take effect

## Step 5: Start PostgreSQL Service

PostgreSQL should start automatically, but verify:

1. **Check Service Status:**
   - Press `Windows Key + R`
   - Type `services.msc` and press Enter
   - Look for "postgresql-x64-16" (or your version)
   - Status should be "Running"

2. **If Not Running:**
   - Right-click the service
   - Click "Start"
   - Right-click again → "Properties"
   - Set "Startup type" to "Automatic"
   - Click "OK"

## Step 6: Create WorkForceHub Database

### Option A: Using Command Prompt (Recommended)

1. **Open Command Prompt as Administrator:**
   - Press `Windows Key`
   - Type "cmd"
   - Right-click "Command Prompt"
   - Click "Run as administrator"

2. **Connect to PostgreSQL:**
   ```cmd
   psql -U postgres
   ```
   - Enter the password you set during installation

3. **Create Database:**
   ```sql
   CREATE DATABASE workforcehub;
   ```

4. **Verify Database Created:**
   ```sql
   \l
   ```
   You should see `workforcehub` in the list

5. **Exit psql:**
   ```sql
   \q
   ```

### Option B: Using pgAdmin (GUI)

1. **Open pgAdmin 4**

2. **Connect to Server:**
   - Expand "Servers" → "PostgreSQL 16"
   - Enter password if prompted

3. **Create Database:**
   - Right-click "Databases"
   - Click "Create" → "Database..."

4. **Database Properties:**
   - **Name:** `workforcehub`
   - **Owner:** `postgres` (default)
   - Click "Save"

5. **Verify:**
   - You should see `workforcehub` under "Databases"

## Step 7: Configure WorkForceHub Backend

1. **Navigate to backend folder:**
   ```cmd
   cd path\to\HR-man\backend
   ```

2. **Create `.env` file** (if not exists):
   ```cmd
   copy .env.example .env
   ```

3. **Edit `.env` file:**
   - Open `.env` in Notepad or any text editor
   - Update `DATABASE_URL`:
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/workforcehub
   ```
   Replace `YOUR_PASSWORD` with the password you set during PostgreSQL installation

   Example:
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:postgres123@localhost:5432/workforcehub
   ```

4. **Save the file**

## Step 8: Run Database Setup Script

1. **Open Command Prompt** in the backend directory

2. **Activate virtual environment** (if you created one):
   ```cmd
   venv\Scripts\activate
   ```

3. **Install dependencies** (if not done):
   ```cmd
   pip install -r requirements.txt
   ```

4. **Run setup script:**
   ```cmd
   python scripts\setup_database.py
   ```

   This will:
   - Verify database connection
   - Create all tables
   - Create admin user

5. **Expected Output:**
   ```
   ============================================================
   WorkForceHub Database Setup
   ============================================================
   
   Step 1: Checking/Creating database...
   ✓ Database 'workforcehub' already exists
   
   Step 2: Creating database tables...
   ✓ Database tables created successfully
   
   Step 3: Creating super admin user...
   ============================================================
   ✓ Super Admin Created Successfully!
   ============================================================
   Email: admin@workforcehub.com
   Username: admin
   Password: Admin@123
   ============================================================
   ⚠️  IMPORTANT: Change password after first login!
   ============================================================
   ```

## Step 9: Verify Everything Works

1. **Start Backend Server:**
   ```cmd
   cd backend
   venv\Scripts\activate
   uvicorn main:app --reload
   ```

2. **Test API:**
   - Open browser: http://localhost:8000/docs
   - Try the `/health` endpoint
   - Should return: `{"status": "healthy"}`

3. **Test Database Connection:**
   - In pgAdmin, expand `workforcehub` database
   - Expand "Schemas" → "public" → "Tables"
   - You should see all tables: users, employees, teams, etc.

## Troubleshooting

### Issue: "psql: command not found"

**Solution:**
- Use full path: `"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres`
- Or add PostgreSQL to PATH (see Step 4)

### Issue: "password authentication failed"

**Solution:**
- Verify password in `.env` file matches PostgreSQL password
- Try resetting PostgreSQL password:
  ```cmd
  "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "ALTER USER postgres PASSWORD 'newpassword';"
  ```

### Issue: "could not connect to server"

**Solution:**
1. Check PostgreSQL service is running:
   - `services.msc` → Look for "postgresql-x64-16"
   - If stopped, right-click → "Start"

2. Check firewall:
   - Windows Defender Firewall might be blocking
   - Allow PostgreSQL through firewall

3. Verify port 5432:
   ```cmd
   netstat -an | findstr 5432
   ```
   Should show PostgreSQL listening

### Issue: "database does not exist"

**Solution:**
- Create database manually:
  ```cmd
  psql -U postgres
  CREATE DATABASE workforcehub;
  \q
  ```

### Issue: "permission denied"

**Solution:**
- Run Command Prompt as Administrator
- Or ensure you're using the `postgres` user

### Issue: "module 'asyncpg' not found"

**Solution:**
- Make sure virtual environment is activated
- Install dependencies: `pip install -r requirements.txt`

## Quick Reference Commands

```cmd
# Connect to PostgreSQL
psql -U postgres

# List all databases
psql -U postgres -l

# Create database
psql -U postgres -c "CREATE DATABASE workforcehub;"

# Connect to specific database
psql -U postgres -d workforcehub

# List tables in database
psql -U postgres -d workforcehub -c "\dt"

# Check PostgreSQL version
psql --version

# Start PostgreSQL service (if stopped)
net start postgresql-x64-16

# Stop PostgreSQL service
net stop postgresql-x64-16
```

## Next Steps

After PostgreSQL is set up:

1. ✅ Database created: `workforcehub`
2. ✅ Tables created (via setup script)
3. ✅ Admin user created
4. ✅ Backend configured

Now you can:
- Start backend: `uvicorn main:app --reload`
- Start frontend: `npm run dev` (in frontend folder)
- Login with: username `admin`, password `Admin@123`

## Additional Resources

- **PostgreSQL Documentation:** https://www.postgresql.org/docs/
- **pgAdmin Documentation:** https://www.pgadmin.org/docs/
- **WorkForceHub Setup Guide:** See `SETUP_GUIDE.md`

---

**Congratulations!** PostgreSQL is now installed and configured on your Windows 10 system! 🎉
