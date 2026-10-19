@echo off
REM ArtOfSoul.N backend for Windows - free local AI. First run sets everything up; later runs just start.
cd /d "%~dp0backend"
where python >nul 2>nul || (echo Python not found. Install Python 3.11+ from https://www.python.org/downloads/ and tick "Add python.exe to PATH". & pause & exit /b 1)
if not exist .venv (
  echo Creating Python environment - first run only, takes a few minutes...
  python -m venv .venv || (pause & exit /b 1)
)
call .venv\Scripts\activate.bat
python -c "import psutil" 2>nul || pip install -r requirements.txt || (pause & exit /b 1)
if not exist .env copy ..\.env.example .env >nul

REM --- Local voice (optional): Piper + a public-domain voice ---
python -c "import piper" 2>nul || (echo Installing the local voice engine... & pip install -r requirements-voice.txt || echo Voice engine not installed - the app will use the Windows system voice.)
if not exist "..\models\piper\en_US-ljspeech-medium.onnx" (
  python -c "import piper" 2>nul && (echo Downloading the teacher's voice - about 60 MB, one time... & python -m piper.download_voices en_US-ljspeech-medium --data-dir ..\models\piper || echo Voice download failed - the app will use the Windows system voice.)
)

REM --- Local AI model through Ollama ---
set MODEL=gemma4:e4b
for /f "tokens=2,* delims=:" %%a in ('findstr /b "MODEL_TEACHER=ollama:" .env') do set MODEL=%%a:%%b
where ollama >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Ollama is not installed. It runs the free AI models on this PC.
  echo  1. Download and install it from https://ollama.com/download
  echo  2. Run this file again.
  echo  The app will still open, but the AI teacher stays off until Ollama is installed.
  echo.
) else (
  ollama list | findstr /i /c:"%MODEL%" >nul
  if errorlevel 1 (
    echo Downloading the free AI model %MODEL% - one time, several GB...
    ollama pull %MODEL%
  )
)
echo.
echo Starting ArtOfSoul.N on http://localhost:8040  (leave this window open, then run start-frontend.bat)
uvicorn app.main:app --host 127.0.0.1 --port 8040
pause
