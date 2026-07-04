@echo off
setlocal enabledelayedexpansion

:: Check Python installation
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your PATH.
    echo Please install Python 3 (https://www.python.org/downloads/) and check
    echo the "Add Python to PATH" option during installation.
    echo.
    pause
    exit /b 1
)

:: Install dependencies silently
python -m pip install -r requirements.txt >nul 2>&1

:: Run python script forwarding all args
python dumper.py %*

if not "%~1"=="" (
    exit /b %errorlevel%
)

echo.
pause
