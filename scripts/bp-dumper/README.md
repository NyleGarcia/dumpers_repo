# BP Dumper

A cross-platform utility to batch-import historical blueprint JSON exports from your log watcher to your account.

## Setup Instructions

### 1. Prerequisites
- **Python 3.8+** must be installed on your system.
  - Windows: Make sure **"Add Python to PATH"** is selected during installation.
  - macOS/Linux: Usually installed by default. Verify via `python3 --version`.

### 2. Installation
Open your terminal (or command prompt) inside this folder and run:
```bash
pip install -r requirements.txt
```

---

## How to Run

### Windows (Quick Start)
1. Double-click the **`dumper.bat`** file.
2. Enter the path to your JSON export file when prompted.
3. Enter your Secret API Key (generate one in your website settings under "API Access").
4. Enter the Supabase Webhook URL (from the admin/setup guides).
5. The script will automatically install dependencies and run the import.

### macOS & Linux (Quick Start)
1. Open your terminal inside this folder and run:
   ```bash
   chmod +x dumper.sh dumper.py
   ./dumper.sh
   ```
2. Enter the path to your JSON export file when prompted.
3. Choose whether to perform a dry run (local only, no API key required).
4. Enter your Secret API Key and Supabase Webhook URL when prompted.

### Advanced Usage (CLI Commands)
If you prefer to bypass the prompts, you can run `dumper.py` directly:
```bash
# Dry Run Mode (local only, no API key required)
python3 dumper.py /path/to/your/export.json --url "http://localhost/mock" --dry-run

# Real Mode (via LOG_WATCHER_API_KEY environment variable)
export LOG_WATCHER_API_KEY="dr_your_secret_api_key"
python3 dumper.py /path/to/your/export.json --url "https://YOUR_PROJECT_ID.supabase.co/functions/v1/log-watcher-webhook"

# Real Mode (passing key directly)
python3 dumper.py /path/to/your/export.json \
  --url "https://YOUR_PROJECT_ID.supabase.co/functions/v1/log-watcher-webhook" \
  --key "dr_your_secret_api_key"
```

---

## Output Description
The script will display the status of each unique blueprint:
- **`★ Would Import`**: (Dry run mode only) The blueprint was detected locally and is ready to import.
- **`★ Successfully Imported`**: The blueprint was added to your account.
- **`↻ Already Acquired`**: The blueprint was already present (skipped, no duplicate created).
- **`✗ Failed`**: The API returned an error (e.g., account pending approval, banned, or invalid ID).
