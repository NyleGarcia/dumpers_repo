#!/usr/bin/env python3
"""
Import blueprints JSON export or directly scan Star Citizen log files to your account.
Works on macOS, Windows, and Linux. Requires Python 3.
"""

import argparse
from collections import deque
import json
import os
import re
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("Error: The 'requests' library is not installed. Run 'pip install -r requirements.txt' first.", file=sys.stderr)
    sys.exit(1)

# Default Star Citizen path locations
DEFAULT_WIN_PATH = r"C:\Program Files\Roberts Space Industries\StarCitizen"
SCAN_MAX_DEPTH = 4

# Skip system/cache folders during drive scans
SCAN_SKIP_DIRS = frozenset(name.lower() for name in (
    "windows", "windows.old", "winsxs",
    "$recycle.bin", "$winreagent", "$sysreset", "$getcurrent",
    "system volume information", "config.msi", "recovery", "boot",
    "programdata", "appdata",
    "perflogs", "onedrivetemp",
    "node_modules", ".git", ".svn", ".hg",
))

SC_ROOT_NAMES = frozenset(("starcitizen", "star citizen"))
KNOWN_CHANNEL_NAMES = frozenset(("LIVE", "PTU", "EPTU", "HOTFIX", "TECH-PREVIEW"))

# ANSI colors for nice terminal feedback
class Colors:
    GREEN = "\033[92m"
    CYAN = "\033[96m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    DIM = "\033[2m"
    RESET = "\033[0m"

def disable_colors():
    """No-op colors for environments that do not support them."""
    Colors.GREEN = ""
    Colors.CYAN = ""
    Colors.YELLOW = ""
    Colors.RED = ""
    Colors.DIM = ""
    Colors.RESET = ""

def _is_channel_dir(p: Path) -> bool:
    if p.name.upper() in KNOWN_CHANNEL_NAMES:
        return True
    try:
        return (p / "build_manifest.id").is_file()
    except OSError:
        return False

def _looks_like_sc_root(p: Path) -> bool:
    try:
        for child in p.iterdir():
            if child.is_dir() and _is_channel_dir(child):
                return True
    except OSError:
        pass
    return False

def _find_sc_roots(drive_root: Path, max_depth: int = SCAN_MAX_DEPTH) -> list[Path]:
    roots = []
    queue_dirs = deque([(drive_root, 0)])
    while queue_dirs:
        current, depth = queue_dirs.popleft()
        try:
            entries = list(current.iterdir())
        except (OSError, PermissionError):
            continue
        for entry in entries:
            try:
                if not entry.is_dir():
                    continue
            except OSError:
                continue
            name_lower = entry.name.lower()
            if name_lower in SCAN_SKIP_DIRS:
                continue
            if name_lower in SC_ROOT_NAMES and _looks_like_sc_root(entry):
                roots.append(entry)
                continue
            if depth + 1 < max_depth:
                queue_dirs.append((entry, depth + 1))
    return roots

def detect_sc_installs() -> dict[str, Path]:
    if sys.platform != "win32":
        return {}

    import ctypes
    import string

    DRIVE_FIXED = 3
    try:
        get_drive_type = ctypes.windll.kernel32.GetDriveTypeW
    except (AttributeError, OSError):
        return {}

    found = {}
    for letter in string.ascii_uppercase:
        root_str = f"{letter}:\\"
        try:
            if get_drive_type(root_str) != DRIVE_FIXED:
                continue
        except OSError:
            continue
        for sc_root in _find_sc_roots(Path(root_str)):
            try:
                children = list(sc_root.iterdir())
            except OSError:
                continue
            for channel_dir in children:
                if not channel_dir.is_dir() or not _is_channel_dir(channel_dir):
                    continue
                channel = channel_dir.name.upper()
                if channel not in found:
                    found[channel] = channel_dir
    return found

# Log parsing patterns
PATTERN_BLUEPRINT = re.compile(r'Added notification "Received Blueprint: ([^:]+):')

def parse_blueprints_from_log(path: Path) -> list[str]:
    discovered = []
    try:
        with open(path, "rb") as f:
            for raw in f:
                line = raw.decode("utf-8", errors="replace").rstrip("\r\n")
                if m := PATTERN_BLUEPRINT.search(line):
                    discovered.append(m.group(1).strip())
    except OSError as e:
        print(f"{Colors.YELLOW}Warning: Could not read log file {path.name} ({e}){Colors.RESET}")
    return discovered

def main():
    if sys.platform == "win32":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        except Exception:
            disable_colors()
    if not sys.stdout.isatty():
        disable_colors()

    parser = argparse.ArgumentParser(
        description="Submit historical log-watcher blueprint exports to your account."
    )
    parser.add_argument(
        "file_path",
        type=Path,
        nargs="?",
        default=None,
        help="Optional: Path to the JSON file generated by 'watcher.py import'. If omitted, the script will scan Star Citizen log files directly."
    )
    parser.add_argument(
        "--url",
        required=True,
        help="Supabase log-watcher-webhook Edge Function URL (e.g. https://<project>.supabase.co/functions/v1/log-watcher-webhook)"
    )
    parser.add_argument(
        "--key",
        help="Your secret API key. If omitted, the script will read the LOG_WATCHER_API_KEY environment variable."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Dry run: scan and log blueprints locally without making network calls or requiring an API key."
    )
    parser.add_argument(
        "--log-dir",
        type=Path,
        help="Directly scan a specific directory for log files instead of auto-detecting Star Citizen."
    )

    args = parser.parse_args()

    # Resolve API Key (only required if not performing a dry run)
    api_key = None
    if not args.dry_run:
        api_key = args.key or os.getenv("LOG_WATCHER_API_KEY")
        if not api_key:
            print(f"{Colors.RED}Error: API key must be provided via --key or LOG_WATCHER_API_KEY environment variable.{Colors.RESET}", file=sys.stderr)
            sys.exit(1)

    unique_blueprints = []
    source_name = ""

    # Mode 1: A path is provided
    if args.file_path:
        if args.file_path.is_file():
            if args.file_path.suffix == ".json":
                # JSON Export File
                try:
                    with open(args.file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    blueprints_list = data.get("blueprints", [])
                    unique_blueprints = sorted(list(set(
                        bp.get("productName") for bp in blueprints_list if bp.get("productName")
                    )))
                    source_name = args.file_path.name
                except Exception as e:
                    print(f"{Colors.RED}Error parsing JSON: {e}{Colors.RESET}", file=sys.stderr)
                    sys.exit(1)
            else:
                # Direct single log file parsing (e.g., Game.log)
                print(f"Scanning single log file: {args.file_path.name}...")
                all_bps = parse_blueprints_from_log(args.file_path)
                unique_blueprints = sorted(list(set(all_bps)))
                source_name = args.file_path.name
        elif args.file_path.is_dir():
            # Direct directory scan (e.g. logbackups folder)
            log_files = list(args.file_path.glob("*.log"))
            if not log_files:
                print(f"{Colors.RED}Error: No .log files found in directory: {args.file_path}{Colors.RESET}", file=sys.stderr)
                sys.exit(1)
            print(f"Scanning {len(log_files)} log file(s) in {args.file_path.name}...")
            all_bps = []
            for path in log_files:
                all_bps.extend(parse_blueprints_from_log(path))
            unique_blueprints = sorted(list(set(all_bps)))
            source_name = f"direct directory scan ({len(log_files)} file(s))"
        else:
            print(f"{Colors.RED}Error: Path not found: {args.file_path}{Colors.RESET}", file=sys.stderr)
            sys.exit(1)

    # Mode 2: Auto-detect installs (no path provided, or --log-dir was passed)
    else:
        log_dirs = []
        if args.log_dir:
            log_dirs = [args.log_dir]
        else:
            # Auto-detect installs
            print(f"{Colors.DIM}Scanning local system for Star Citizen installations...{Colors.RESET}")
            installs = detect_sc_installs()
            if installs:
                print(f"Detected channel installations:")
                for channel, install_path in installs.items():
                    print(f"  - {channel}: {install_path}")
                # Prefer LIVE, fall back to first one found
                chosen_channel = "LIVE" if "LIVE" in installs else list(installs.keys())[0]
                channel_dir = installs[chosen_channel]
                print(f"Using channel: {Colors.CYAN}{chosen_channel}{Colors.RESET} ({channel_dir})")
                log_dirs = [channel_dir, channel_dir / "logbackups"]
            else:
                # Standard fallback locations
                fallback = Path(DEFAULT_WIN_PATH)
                if fallback.is_dir():
                    # scan LIVE by default
                    live_dir = fallback / "LIVE"
                    if live_dir.is_dir():
                        log_dirs = [live_dir, live_dir / "logbackups"]
                
        if not log_dirs or not any(d.is_dir() for d in log_dirs):
            print(f"{Colors.RED}Error: No Star Citizen installations or log directories detected.{Colors.RESET}", file=sys.stderr)
            print(f"Please run the script pointing to your logbackups folder or a single Game.log directly:", file=sys.stderr)
            print(f"  python dumper.py --log-dir \"C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\logbackups\"", file=sys.stderr)
            sys.exit(1)

        # Collect log files
        log_files = []
        for d in log_dirs:
            if d.is_dir():
                log_files.extend(d.glob("*.log"))
        
        if not log_files:
            print(f"{Colors.RED}Error: No log files found in detected directories: {[str(d) for d in log_dirs]}{Colors.RESET}", file=sys.stderr)
            sys.exit(1)

        print(f"Scanning {len(log_files)} log file(s)...")
        all_bps = []
        for path in log_files:
            all_bps.extend(parse_blueprints_from_log(path))
        
        unique_blueprints = sorted(list(set(all_bps)))
        source_name = f"direct log scan ({len(log_files)} file(s))"

    if not unique_blueprints:
        print(f"{Colors.YELLOW}No blueprints discovered.{Colors.RESET}")
        return

    print(f"{Colors.CYAN}Starting import of {len(unique_blueprints)} unique blueprint(s) from {source_name}...{Colors.RESET}")
    print()

    success_count = 0
    dupe_count = 0
    fail_count = 0

    if args.dry_run:
        for idx, bp_id in enumerate(unique_blueprints, 1):
            success_count += 1
            print(f"  [{idx}/{len(unique_blueprints)}] {Colors.GREEN}★ Would Import:{Colors.RESET} {bp_id}")
    else:
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        })

        for idx, bp_id in enumerate(unique_blueprints, 1):
            payload = {
                "type": "blueprint_received",
                "blueprint": bp_id
            }

            try:
                res = session.post(args.url, json=payload, timeout=15)
                response_json = res.json()

                if res.status_code == 200:
                    is_duplicate = response_json.get("duplicate", False)
                    if is_duplicate:
                        dupe_count += 1
                        print(f"  [{idx}/{len(unique_blueprints)}] {Colors.YELLOW}↻ Already Acquired:{Colors.RESET} {bp_id}")
                    else:
                        success_count += 1
                        print(f"  [{idx}/{len(unique_blueprints)}] {Colors.GREEN}★ Successfully Imported:{Colors.RESET} {bp_id}")
                else:
                    fail_count += 1
                    reason = response_json.get("error", f"HTTP {res.status_code}")
                    print(f"  [{idx}/{len(unique_blueprints)}] {Colors.RED}✗ Failed:{Colors.RESET} {bp_id} {Colors.DIM}(Reason: {reason}){Colors.RESET}")

            except requests.RequestException as e:
                fail_count += 1
                print(f"  [{idx}/{len(unique_blueprints)}] {Colors.RED}✗ Connection Error:{Colors.RESET} {bp_id} {Colors.DIM}(Reason: {e}){Colors.RESET}")

    print()
    print(f"{Colors.CYAN}Import Finished Summary:{Colors.RESET}")
    if args.dry_run:
        print(f"  {Colors.GREEN}★ Would Import: {success_count}{Colors.RESET}")
    else:
        print(f"  {Colors.GREEN}★ Imported:     {success_count}{Colors.RESET}")
        print(f"  {Colors.YELLOW}↻ Duplicates:   {dupe_count}{Colors.RESET}")
        if fail_count > 0:
            print(f"  {Colors.RED}✗ Failed:       {fail_count}{Colors.RESET}")
        else:
            print(f"  ✗ Failed:       0")

if __name__ == "__main__":
    main()
