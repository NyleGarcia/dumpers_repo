# BP Dumper (native Windows + Linux)

Native member build of **DumperApps** — Go port of the Python watcher in
`scripts/bp-dumper-py/`.

| Platform | Client |
|---|---|
| Windows (GitHub Releases) | **This module** → `DumperApps.exe` |
| Linux (GitHub Releases) | **This module** → `DumperApps-linux-amd64` / `DumperApps-linux-arm64` |
| macOS / scripts | `scripts/bp-dumper-py/dumper.py` |

Only one instance at a time: on Windows this exe and `dumper.py` share the mutex `Local\DumpersRepo.BPDumper`;
on Linux both take an exclusive `flock` on `$XDG_DATA_HOME/dumper-apps/instance.lock` (default `~/.local/share`).

Wire protocol: [`scripts/bp-dumper-shared/PROTOCOL.md`](../bp-dumper-shared/PROTOCOL.md).

## Why Go on Windows

PyInstaller `--onefile` shared bootloaders are frequently flagged by AV / VirusTotal
(e.g. `Trojan:Win32/Wacatac.B!ml`) even when the app is clean. A native Go binary
avoids that packaging fingerprint. The VirusTotal publish gate uses
`VT_GATE_MODE=named` (blocks named malware families; ignores common generic/ML
heuristic labels) before a release leaves draft.

## Build

```powershell
node scripts/copy-blueprint-lookup.mjs
.\scripts\installer\build-exe.ps1 -Version 1.16.0
# → scripts/installer/output/DumperApps.exe
```

Or locally:

```powershell
cd scripts/bp-dumper-go
go build -ldflags "-s -w -X main.Version=1.16.0" -o DumperApps.exe .
```

Do **not** UPX-pack or re-wrap the exe.

Linux (any host with Go 1.23+; static, no cgo):

```bash
node scripts/copy-blueprint-lookup.mjs   # embeds the current game data lookup
cd scripts/bp-dumper-go
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags "-s -w -X main.Version=1.23.0" -o DumperApps-linux-amd64 .
```

Release CI (`build-releases.yml`) builds `amd64` + `arm64` and adds them to `SHA256SUMS`.

## Linux notes

- Star Citizen runs under Wine/Proton, so auto-detect looks for `drive_c/Program Files/Roberts Space Industries/StarCitizen/<channel>` in:
  `$WINEPREFIX`, `~/.wine`, `~/Games/*` (Lutris / LUG helper), Heroic prefixes, Steam `compatdata/*/pfx` (native + Flatpak),
  Bottles (native + Flatpak), any `drive_c` up to 6 levels under `$HOME` or `/mnt`, `/media`, `/run/media/$USER`,
  plus extra Wine drives mapped in `dosdevices/` (`d:`, `e:`, …). If a channel appears in several prefixes the newest `Game.log` wins.
- Paths typed in the wizard accept `~/…`.
- `.env` / `.dumper_cache.json` live beside the binary; if that dir is read-only (e.g. `/usr/local/bin`) they go to `$XDG_CONFIG_HOME/bp-dumper`.
- `Data/Localization` is matched case-insensitively (Wine keeps CIG's `Data` casing on case-sensitive filesystems).
- Update prompts link the matching `DumperApps-linux-<arch>` asset.

## Member setup notes

- Leave the LIVE path blank in the wizard to **auto-detect** Star Citizen (drive search for LIVE / Game.log), or paste a path to override.
- Full history import defaults to **Y** (Enter) on first run and `--configure`. It scans every log with no version filter, then disables itself. Recent backup import is current patch only (e.g. `4.10.x`).
- Updates are **manual**: download a new `DumperApps.exe` from GitHub Releases when prompted (HTTP 426). No auto-download/self-replace.
