@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo             BP Dumper CLI Setup
echo ====================================================
echo.

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

:: Install dependencies
echo [1/3] Installing dependencies...
python -m pip install --upgrade pip >nul 2>&1
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [WARNING] Failed to install dependencies via pip. Retrying...
    pip install -r requirements.txt
)
echo.

:: Prompts
echo [2/3] Configuration Settings:
echo.

:: 1. JSON file path
:prompt_file
set /p "JSON_FILE=Enter path to JSON export file: "
:: Strip quotes if pasted
set "JSON_FILE=!JSON_FILE:"=!"
if not exist "!JSON_FILE!" (
    echo [ERROR] File does not exist: "!JSON_FILE!"
    goto prompt_file
)

:: 2. Secret API key
:prompt_key
set /p "API_KEY=Enter your Secret API Key (e.g. dr_...): "
set "API_KEY=!API_KEY:"=!"
if "!API_KEY!"=="" (
    echo [ERROR] API Key is required.
    goto prompt_key
)

:: 3. Webhook URL
:prompt_url
set /p "URL=Enter Supabase Edge Function Webhook URL: "
set "URL=!URL:"=!"
if "!URL!"=="" (
    echo [ERROR] Webhook URL is required.
    goto prompt_url
)

echo.
echo [3/3] Running dumper script...
echo.
python dumper.py "!JSON_FILE!" --url "!URL!" --key "!API_KEY!"
echo.
echo ====================================================
echo Import Complete.
echo ====================================================
echo.
pause
