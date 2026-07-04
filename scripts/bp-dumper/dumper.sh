#!/usr/bin/env bash

echo "===================================================="
echo "             BP Dumper CLI Setup"
echo "===================================================="
echo ""

# Check Python installation
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "[ERROR] Python 3 is not installed or not in your PATH."
    echo "Please install Python 3."
    exit 1
fi

PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

# Install dependencies
echo "[1/3] Installing dependencies..."
$PYTHON_CMD -m pip install -r requirements.txt
echo ""

echo "[2/3] Configuration Settings:"
echo ""

# 1. JSON file path
while true; do
    read -p "Enter path to JSON export file: " JSON_FILE
    # Remove surrounding quotes if pasted
    JSON_FILE="${JSON_FILE%\"}"
    JSON_FILE="${JSON_FILE#\"}"
    if [ -f "$JSON_FILE" ]; then
        break
    else
        echo "[ERROR] File does not exist: '$JSON_FILE'"
    fi
done

# 2. Dry run check
read -p "Dry run only? (Y/N, Enter = N): " DRY_RUN
if [[ "$DRY_RUN" =~ ^[Yy]$ ]]; then
    echo ""
    echo "[3/3] Running dumper script in dry run mode..."
    echo ""
    $PYTHON_CMD dumper.py "$JSON_FILE" --url "http://localhost/mock" --dry-run
    exit 0
fi

# 3. Secret API key
while true; do
    read -p "Enter your Secret API Key (e.g. dr_...): " API_KEY
    API_KEY="${API_KEY%\"}"
    API_KEY="${API_KEY#\"}"
    if [ -n "$API_KEY" ]; then
        break
    else
        echo "[ERROR] API Key is required."
    fi
done

# 4. Webhook URL
while true; do
    read -p "Enter Supabase Edge Function Webhook URL: " URL
    URL="${URL%\"}"
    URL="${URL#\"}"
    if [ -n "$URL" ]; then
        break
    else
        echo "[ERROR] Webhook URL is required."
    fi
done

echo ""
echo "[3/3] Running dumper script..."
echo ""
$PYTHON_CMD dumper.py "$JSON_FILE" --url "$URL" --key "$API_KEY"

echo ""
echo "===================================================="
echo "Import Complete."
echo "===================================================="
echo ""
