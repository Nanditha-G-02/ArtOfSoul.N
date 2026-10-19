@echo off
REM ArtOfSoul.N backend for Windows - free local AI through Ollama. First run sets everything up.
cd /d "%~dp0backend"
where python >nul 2>nul || (echo Python not found. Install Python 3.11+ from https://www.python.org/downloads/ and tick "Add python.exe to PATH". & pause & exit /b 1)
if not exist .venv (
  echo Creating Python environment - first run only, takes a few minutes...
  python -m venv .venv || (pause & exit /b 1)
  call .venv\Scripts\activate.bat
  python -m pip install --upgrade pip
  pip install -r requirements-dev.txt || (pause & exit /b 1)
) else (
  call .venv\Scripts\activate.bat
)
if not exist .env copy ..\.env.example .env >nul

set MODEL=gemma4:e4b
for /f "tokens=2,* delims=:" %%a in ('findstr /b "MODEL_TEACHER=ollama:" .env') do set MODEL=%%a:%%b

where ollama >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Ollama is not installed. It runs the free AI models on this PC.
  echo  1. Download and install it from https://ollama.com/download
  echo  2. Run this file again.
  echo  The app will still open, but AI features stay off until Ollama is installed.
  echo.
) else (
  ollama list | findstr /i /c:"%MODEL%" >nul
  if errorlevel 1 (
    echo Downloading the free AI model %MODEL% - one time, several GB...
    ollama pull %MODEL%
  )
)
echo.
echo Starting ArtOfSoul.N API on http://localhost:8040  (leave this window open)
uvicorn app.main:app --port 8040
pause
