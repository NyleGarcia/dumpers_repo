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

# Bypass interactive mode if arguments are passed
if [ "$#" -gt 0 ]; then
    $PYTHON_CMD -m pip install -r requirements.txt &> /dev/null
    $PYTHON_CMD dumper.py "$@"
    exit $?
fi

# Install dependencies
echo "[1/3] Installing dependencies..."
$PYTHON_CMD -m pip install -r requirements.txt
echo ""

echo "[2/3] Configuration Settings:"
echo ""

# 1. JSON file path / Directory
while true; do
    read -p "Enter path to JSON export or folder (Leave empty to auto-detect SC logs): " JSON_FILE
    # Remove surrounding quotes if pasted
    JSON_FILE="${JSON_FILE%\"}"
    JSON_FILE="${JSON_FILE#\"}"
    if [ -z "$JSON_FILE" ] || [ -f "$JSON_FILE" ] || [ -dir "$JSON_FILE" ] || [ -d "$JSON_FILE" ]; then
        break
    else
        echo "[ERROR] Path does not exist: '$JSON_FILE'"
    fi
done

# 2. Dry run check
read -p "Dry run only? (Y/N, Enter = N): " DRY_RUN
if [[ "$DRY_RUN" =~ ^[Yy]$ ]]; then
    echo ""
    echo "[3/3] Running dumper script in dry run mode..."
    echo ""
    if [ -z "$JSON_FILE" ]; then
        $PYTHON_CMD dumper.py --url "http://localhost/mock" --dry-run
    else
        $PYTHON_CMD dumper.py "$JSON_FILE" --url "http://localhost/mock" --dry-run
    fi
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
if [ -z "$JSON_FILE" ]; then
    $PYTHON_CMD dumper.py --url "$URL" --key "$API_KEY"
else
    $PYTHON_CMD dumper.py "$JSON_FILE" --url "$URL" --key "$API_KEY"
fi

echo ""
echo "===================================================="
echo "Import Complete."
echo "===================================================="
echo ""
