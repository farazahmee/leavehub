@echo off
REM WorkForceHub - Start both backend and frontend for development
REM Requires: Backend venv activated, PostgreSQL running, npm installed

echo Starting WorkForceHub development servers...
echo.
echo [1/2] Starting backend on http://localhost:8080 ...
start "WorkForceHub Backend" cmd /k "cd /d %~dp0backend && (if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) else (echo Warning: venv not found, using system Python)) && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8080"

timeout /t 3 /nobreak >nul

echo [2/2] Starting frontend on http://localhost:5174 ...
start "WorkForceHub Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers are starting. Wait for them to be ready before opening:
echo   Frontend: http://localhost:5174
echo   Backend:  http://localhost:8080
echo   API docs: http://localhost:8080/docs
echo.
pause
