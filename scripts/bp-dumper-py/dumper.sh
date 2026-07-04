#!/usr/bin/env bash

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

# Install dependencies silently
$PYTHON_CMD -m pip install -r requirements.txt &> /dev/null

# Run python script forwarding all args
$PYTHON_CMD dumper.py "$@"
exit $?
