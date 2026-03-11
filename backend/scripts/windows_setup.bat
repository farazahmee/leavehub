@echo off
REM Windows batch script for WorkForceHub database setup
REM This script helps Windows users set up the database easily

echo ============================================================
echo WorkForceHub - Windows Database Setup
echo ============================================================
echo.

REM Check if PostgreSQL is installed
where psql >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PostgreSQL is not installed or not in PATH
    echo.
    echo Please install PostgreSQL first:
    echo 1. Download from: https://www.postgresql.org/download/windows/
    echo 2. Install with default settings
    echo 3. Remember the password you set for 'postgres' user
    echo.
    echo For detailed instructions, see: WINDOWS_POSTGRESQL_SETUP.md
    echo.
    pause
    exit /b 1
)

echo [INFO] PostgreSQL found!
echo.

REM Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo [INFO] Virtual environment not found. Creating one...
    python -m venv venv
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to create virtual environment
        echo Make sure Python is installed and in PATH
        pause
        exit /b 1
    )
)

echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat

echo [INFO] Installing/updating dependencies...
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [INFO] Checking .env file...
if not exist ".env" (
    echo [INFO] Creating .env file from .env.example...
    copy .env.example .env
    echo.
    echo [IMPORTANT] Please edit .env file and update DATABASE_URL:
    echo DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/workforcehub
    echo.
    echo Replace YOUR_PASSWORD with your PostgreSQL password
    echo.
    pause
)

echo.
echo [INFO] Running database setup script...
python scripts\setup_database.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo Setup completed successfully!
    echo ============================================================
    echo.
    echo Next steps:
    echo 1. Start backend: uvicorn main:app --reload
    echo 2. Start frontend: cd ..\frontend ^&^& npm run dev
    echo 3. Login with: username=admin, password=Admin@123
    echo.
) else (
    echo.
    echo [ERROR] Setup failed. Please check the error messages above.
    echo.
    echo Common issues:
    echo - PostgreSQL service not running
    echo - Wrong password in .env file
    echo - Database already exists (this is OK)
    echo.
)

pause
