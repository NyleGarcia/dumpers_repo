#!/usr/bin/env python3
"""
Import blueprints JSON export or directly scan Star Citizen log files to your account.
Works on macOS, Windows, and Linux. Requires Python 3.
"""

import argparse
from collections import deque
import concurrent.futures
import json
import os
import re
import sys
from pathlib import Path



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

def process_log_file(task_info):
    """Worker function for a single thread to process one file."""
    index, total, path = task_info
    size_mb = path.stat().st_size / (1024 * 1024)
    print(f"  [{index:>3}/{total}] Scanning {path.name} ({size_mb:.2f} MB)...")
    return parse_blueprints_from_log(path)

def load_env_file(env_path: Path) -> dict:
    env = {}
    if env_path.is_file():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        env[k.strip()] = v.strip().strip('"').strip("'")
        except Exception:
            pass
    return env

def save_env_file(env_path: Path, variables: dict):
    try:
        with open(env_path, "w", encoding="utf-8") as f:
            f.write("# Saved Configuration Settings\n")
            for k, v in variables.items():
                if v:
                    # Strip quotes before saving
                    clean_v = str(v).strip().strip('"').strip("'")
                    f.write(f"{k}={clean_v}\n")
    except Exception:
        pass

def load_cache_file(cache_path: Path) -> set:
    if cache_path.is_file():
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return set(data)
        except Exception:
            pass
    return set()

def save_cache_file(cache_path: Path, cache_set: set):
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(sorted(list(cache_set)), f, indent=2)
    except Exception:
        pass

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

    # Load configuration from .env file
    env_path = Path(__file__).resolve().parent / ".env"
    env_vars = load_env_file(env_path)

    # Determine if we should run in interactive mode
    # We run interactively if stdout is a terminal AND either:
    # 1. No command-line arguments are passed
    # 2. --dry-run was passed, but we don't have a target file/folder
    # 3. We are running in real mode, but --url (or API key) is missing
    is_interactive = sys.stdout.isatty() and (
        len(sys.argv) == 1 or
        (len(sys.argv) == 2 and args.dry_run) or
        (not args.dry_run and not args.url and not env_vars.get("SUPABASE_WEBHOOK_URL"))
    )

    if is_interactive:
        print(f"{Colors.CYAN}===================================================={Colors.RESET}")
        print(f"{Colors.CYAN}             BP Dumper Configuration Wizard{Colors.RESET}")
        print(f"{Colors.CYAN}===================================================={Colors.RESET}")
        print()

        # 1. Prompt file path / directory
        default_path = env_vars.get("LOG_PATH", "")
        path_prompt = "Enter path to JSON export or folder (Leave empty to auto-detect SC logs)"
        if default_path:
            path_prompt += f" [{default_path}]"
        path_prompt += ": "
        
        try:
            user_path = input(path_prompt).strip().strip('"').strip("'")
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(0)
            
        if not user_path and default_path:
            user_path = default_path
        
        if user_path:
            args.file_path = Path(user_path)

        # 2. Prompt Dry Run
        try:
            user_dry_run = input("Dry run only? (Y/N, Enter = N): ").strip().lower()
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(0)
            
        if user_dry_run == 'y':
            args.dry_run = True

        # 3. Prompt URL (only if not dry run)
        if not args.dry_run:
            default_url = env_vars.get("SUPABASE_WEBHOOK_URL", "")
            url_prompt = "Enter Supabase Edge Function Webhook URL"
            if default_url:
                url_prompt += f" [{default_url}]"
            url_prompt += ": "
            
            try:
                user_url = input(url_prompt).strip().strip('"').strip("'")
            except (KeyboardInterrupt, EOFError):
                print("\nAborted.")
                sys.exit(0)
                
            if not user_url and default_url:
                user_url = default_url
            args.url = user_url

        # 4. Prompt Key (only if not dry run)
        if not args.dry_run:
            default_key = env_vars.get("LOG_WATCHER_API_KEY", "")
            key_prompt = "Enter your Secret API Key (e.g. dr_...)"
            if default_key:
                masked_key = f"{default_key[:6]}...{default_key[-4:]}" if len(default_key) > 10 else default_key
                key_prompt += f" [{masked_key}]"
            key_prompt += ": "
            
            try:
                user_key = input(key_prompt).strip().strip('"').strip("'")
            except (KeyboardInterrupt, EOFError):
                print("\nAborted.")
                sys.exit(0)
                
            if not user_key and default_key:
                user_key = default_key
            args.key = user_key

        print()

        # Save variables to .env file immediately
        new_env = {
            "LOG_PATH": str(args.file_path) if args.file_path else "",
            "SUPABASE_WEBHOOK_URL": args.url if args.url else "",
            "LOG_WATCHER_API_KEY": args.key if args.key else ""
        }
        env_vars.update(new_env)
        save_env_file(env_path, env_vars)

    # Resolve URL & API Key (checks CLI args -> ENV variables -> .env file)
    url = args.url or os.getenv("SUPABASE_WEBHOOK_URL") or env_vars.get("SUPABASE_WEBHOOK_URL")
    api_key = None
    if not args.dry_run:
        if not url:
            print(f"{Colors.RED}Error: Webhook URL must be provided via --url or configured in .env file.{Colors.RESET}", file=sys.stderr)
            sys.exit(1)
        api_key = args.key or os.getenv("LOG_WATCHER_API_KEY") or env_vars.get("LOG_WATCHER_API_KEY")
        if not api_key:
            print(f"{Colors.RED}Error: API key must be provided via --key, LOG_WATCHER_API_KEY environment variable, or configured in .env file.{Colors.RESET}", file=sys.stderr)
            sys.exit(1)

    # Update script args.url with resolved URL for reference
    args.url = url

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
            print(f"Scanning {len(log_files)} log file(s) in {args.file_path.name} (Multithreaded)...")
            all_bps = []
            work_items = [(i, len(log_files), path) for i, path in enumerate(log_files, 1)]
            with concurrent.futures.ThreadPoolExecutor() as executor:
                for res in executor.map(process_log_file, work_items):
                    all_bps.extend(res)
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

        print(f"Scanning {len(log_files)} log file(s) (Multithreaded)...")
        all_bps = []
        work_items = [(i, len(log_files), path) for i, path in enumerate(log_files, 1)]
        with concurrent.futures.ThreadPoolExecutor() as executor:
            for res in executor.map(process_log_file, work_items):
                all_bps.extend(res)
        
        unique_blueprints = sorted(list(set(all_bps)))
        source_name = f"direct log scan ({len(log_files)} file(s))"

    if not unique_blueprints:
        print(f"{Colors.YELLOW}No blueprints discovered.{Colors.RESET}")
        return

    # Load local dumper cache
    cache_path = Path(__file__).resolve().parent / ".dumper_cache.json"
    acquired_blueprints = load_cache_file(cache_path)

    # If running in non-dry-run mode, synchronize with the server
    if not args.dry_run:
        try:
            import requests
        except ImportError:
            print("Error: The 'requests' library is not installed. Run 'pip install -r requirements.txt' to import blueprints to your account.", file=sys.stderr)
            sys.exit(1)

        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        })

        # Sync from database (Option 2: Webhook GET Sync)
        print(f"{Colors.DIM}Synchronizing blueprints list from server...{Colors.RESET}")
        try:
            res = session.get(args.url, timeout=15)
            if res.status_code == 200:
                response_json = res.json()
                if response_json.get("success"):
                    server_bps = response_json.get("blueprints", [])
                    acquired_blueprints.update(server_bps)
                    save_cache_file(cache_path, acquired_blueprints)
                    print(f"Synced {len(server_bps)} blueprints from account.")
            else:
                print(f"{Colors.YELLOW}Warning: Server sync returned HTTP {res.status_code}. Using local cache only.{Colors.RESET}")
        except Exception as e:
            print(f"{Colors.YELLOW}Warning: Could not sync blueprints from server ({e}). Using local cache only.{Colors.RESET}")

    # Option 1: Local Cache Filter
    to_import = [bp for bp in unique_blueprints if bp not in acquired_blueprints]
    skipped_count = len(unique_blueprints) - len(to_import)

    if skipped_count > 0:
        print(f"{Colors.DIM}Skipped {skipped_count} blueprint(s) already acquired (cached or server-synced).{Colors.RESET}")

    if not to_import:
        print(f"{Colors.GREEN}All discovered blueprints are already acquired! Nothing to import.{Colors.RESET}")
        return

    print(f"{Colors.CYAN}Starting import of {len(to_import)} unique blueprint(s) from {source_name}...{Colors.RESET}")
    print()

    success_count = 0
    dupe_count = 0
    fail_count = 0

    if args.dry_run:
        for idx, bp_id in enumerate(to_import, 1):
            success_count += 1
            print(f"  [{idx}/{len(to_import)}] {Colors.GREEN}★ Would Import:{Colors.RESET} {bp_id}")
    else:
        for idx, bp_id in enumerate(to_import, 1):
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
                        print(f"  [{idx}/{len(to_import)}] {Colors.YELLOW}↻ Already Acquired:{Colors.RESET} {bp_id}")
                    else:
                        success_count += 1
                        print(f"  [{idx}/{len(to_import)}] {Colors.GREEN}★ Successfully Imported:{Colors.RESET} {bp_id}")
                    
                    # Update local cache immediately
                    acquired_blueprints.add(bp_id)
                    save_cache_file(cache_path, acquired_blueprints)
                else:
                    fail_count += 1
                    reason = response_json.get("error", f"HTTP {res.status_code}")
                    print(f"  [{idx}/{len(to_import)}] {Colors.RED}✗ Failed:{Colors.RESET} {bp_id} {Colors.DIM}(Reason: {reason}){Colors.RESET}")

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
