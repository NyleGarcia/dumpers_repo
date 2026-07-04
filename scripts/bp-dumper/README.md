# BP Dumper

A blazingly fast, zero-dependency cross-platform utility written in Go to batch-import historical blueprint JSON exports or trail active logs from your Star Citizen client in real-time to your account.

---

## 🚀 Quick Start (Pre-Compiled Executables)
If you are non-technical or don't want to compile Go from source:
1. Go to the **Releases** tab of this repository on GitHub.
2. Download the pre-built file for your system:
   * **Windows**: Download `bp-dumper-windows.exe`.
   * **macOS (Intel)**: Download `bp-dumper-mac-intel`.
   * **macOS (Apple Silicon)**: Download `bp-dumper-mac-silicon`.
   * **Linux**: Download `bp-dumper-linux`.
3. Put the downloaded file in any folder and **double-click it** (or double-click to run in terminal).
4. The built-in setup wizard will guide you through the settings (auto-detecting your game, prompting for your Webhook URL/API Key) and save them into a local `.env` file so you only have to do it once!

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
