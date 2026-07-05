# BP Dumper Releases

Go and Python BP Dumper versions are managed with [semantic-release](https://semantic-release.gitbook.io/) using [Conventional Commits](https://www.conventionalcommits.org/).

## Version source of truth

- `scripts/bp-dumper/version.json` — canonical semver (current baseline: **1.1.2**, tag `v1.1.2`)
- Synced to `scripts/bp-dumper-go/main.go`, `scripts/bp-dumper-py/_version.py`, and `scripts/bp-dumper/package.json`

## Automatic release flow

1. Push to `main` that changes dumper files triggers **Release BP Dumper** (`.github/workflows/release-dumper.yml`).
2. semantic-release analyzes commits since the last `v*` tag and bumps the version when warranted.
3. A release commit updates version files, creates a `vX.Y.Z` tag, and publishes GitHub release notes.
4. The tag triggers **Build Executables on Release**, which uploads:
   - `bp-dumper-windows.exe`
   - `bp-dumper-mac-intel` / `bp-dumper-mac-silicon`
   - `bp-dumper-linux`
   - `bp-dumper-py.zip`

## Commit messages

Use conventional commits on dumper changes:

| Commit type | Version bump |
|-------------|--------------|
| `fix(dumper): ...` | patch |
| `feat(dumper): ...` | minor |
| `feat(dumper)!: ...` or `BREAKING CHANGE:` | major |

Example: `fix(dumper): default watch mode to on`

## Manual release (local)

```bash
npm ci
npm run release:dumper
```

Requires `GITHUB_TOKEN` with repo write access and a clean `main` checkout with full git history.

## Manual binary build (no semver bump)

Use **Actions → Build Executables on Release → Run workflow** and supply a tag (e.g. `v1.1.2`).

## Sync version locally after editing

```bash
npm run sync-dumper-version 1.2.0
```
