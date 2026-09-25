@echo off
rem Double-click to start the dev server and open the app in your browser.
cd /d "%~dp0"
call npm run dev -- --open
pause
