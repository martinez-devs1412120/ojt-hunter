@echo off
rem OJT Hunter local server - double-click me instead of opening index.html directly.
cd /d "%~dp0"
start "ojt-hunter-server" /min python -m http.server 8081
timeout /t 1 /nobreak >nul
start "" http://localhost:8081/
echo.
echo  OJT Hunter is running at http://localhost:8081
echo  Keep this window open while using the app.
echo  To stop: close this window and the minimized "ojt-hunter-server" window.
echo.
pause
