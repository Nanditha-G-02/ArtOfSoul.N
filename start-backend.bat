@echo off
REM ArtOfSoul.N backend for Windows. First run sets everything up; later runs just start the server.
cd /d "%~dp0backend"
where python >nul 2>nul || (echo Python not found. Install Python 3.11+ from https://www.python.org/downloads/ and tick "Add python.exe to PATH". & pause & exit /b 1)
if not exist .venv (
  echo Creating Python environment...
  python -m venv .venv || (pause & exit /b 1)
  call .venv\Scripts\activate.bat
  python -m pip install --upgrade pip
  pip install -r requirements-dev.txt || (pause & exit /b 1)
) else (
  call .venv\Scripts\activate.bat
)
if not exist .env (
  copy ..\.env.example .env >nul
  echo.
  echo Created backend\.env  -  open it in Notepad and paste your ANTHROPIC_API_KEY, then run this file again.
  notepad .env
  pause
  exit /b 0
)
echo Starting API on http://localhost:8040  (leave this window open)
uvicorn app.main:app --port 8040
pause
