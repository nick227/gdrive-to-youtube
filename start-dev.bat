@echo off
echo Starting YouTube Upload Manager in development mode...
echo.

cd backend
start "Backend Server" cmd /k "npm run dev"

timeout /t 2 /nobreak >nul

cd ..\frontend
start "Frontend Client" cmd /k "npm run dev"

echo.
echo Backend server starting on http://localhost:4000
echo Frontend client starting on http://localhost:3000
echo.
echo Both windows will remain open. Close them to stop the servers.
echo.
pause

