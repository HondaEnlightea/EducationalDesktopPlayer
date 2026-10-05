@echo off
setlocal
cd /d "%~dp0"
if not defined DESKTOP_PLAYER_DATA_DIR set "DESKTOP_PLAYER_DATA_DIR=%~dp0data"
if not exist "release\win-unpacked\Educational Desktop Player.exe" goto missing
if /i "%~1"=="--wait" goto wait
start "" "release\win-unpacked\Educational Desktop Player.exe"
exit /b %errorlevel%
:wait
start "" /wait "release\win-unpacked\Educational Desktop Player.exe"
exit /b %errorlevel%
:missing
echo Windows build not found. Please check README.md.
pause
exit /b 1
