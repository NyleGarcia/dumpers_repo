# BP Dumper

A blazingly fast, zero-dependency cross-platform utility written in Go to batch-import historical blueprint JSON exports or trail active logs from your Star Citizen client in real-time to your account.

---

## 🚀 Quick Start (Build from source)
Pre-built release binaries are not published yet. Build locally or run the Python script:

**Go (recommended):**
```bash
cd scripts/bp-dumper-go
go build -ldflags="-s -w" -o bp-dumper.exe   # Windows
./bp-dumper.exe
```

**Python:**
```bash
cd scripts/bp-dumper-py
pip install -r requirements.txt
python dumper.py --dry-run
```

---

## 🛠️ Developer Setup & Compilation

### 1. Prerequisites
- **Go 1.21+** must be installed on your system.

### 2. Compilation
Compile a optimized static binary for your current operating system:
```bash
go build -ldflags="-s -w" -o bp-dumper
# On Windows: go build -ldflags="-s -w" -o bp-dumper.exe
```

---

## How to Run

### Command Line Arguments
You can pass arguments directly to the compiled binary to bypass the setup wizard and run it in headless/scripted modes:

```bash
# Dry Run Mode: Auto-detect and scan local Star Citizen logs (no API key required)
./bp-dumper --url "http://localhost/mock" --dry-run

# Watch Mode (Live): Trail Game.log in real-time and upload discovered blueprints instantly
./bp-dumper --watch --url "https://YOUR_PROJECT_ID.supabase.co/functions/v1/log-watcher-webhook" --key "dr_your_secret_api_key"

# Real Mode: Auto-detect logs and import using environment key
export LOG_WATCHER_API_KEY="dr_your_secret_api_key"
./bp-dumper --url "https://YOUR_PROJECT_ID.supabase.co/functions/v1/log-watcher-webhook"

# Real Mode: Scan specific Game.log file directly and pass key as parameter
./bp-dumper /path/to/Game.log \
  --url "https://YOUR_PROJECT_ID.supabase.co/functions/v1/log-watcher-webhook" \
  --key "dr_your_secret_api_key"
```

---

## Output Description
The utility displays the status of each blueprint and mission in color prefixing dates and times:
- **`★ Would Import`**: (Dry run mode only) The blueprint was detected locally and is ready to import.
- **`★ Successfully Imported`**: The blueprint was added to your account.
- **`↻ Already Acquired`**: The blueprint was already present (skipped, no duplicate created).
- **`✗ Failed`**: The API returned an error (e.g., account pending approval, banned, or invalid ID).
