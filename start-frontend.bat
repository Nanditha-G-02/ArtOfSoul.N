@echo off
REM ArtOfSoul.N frontend for Windows. Run start-backend.bat first.
cd /d "%~dp0frontend"
where npm >nul 2>nul || (echo Node.js not found. Install the LTS version from https://nodejs.org/ & pause & exit /b 1)
if not exist node_modules (
  echo Installing frontend packages...
  call npm install || (pause & exit /b 1)
)
echo Opening http://localhost:5174  (leave this window open)
start "" http://localhost:5174
call npm run dev
pause
