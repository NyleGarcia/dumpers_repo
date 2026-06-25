# Stack upgrade — backup and revert

## Backup save points

| Label | Tag / branch | Commit | When |
|-------|--------------|--------|------|
| **PRE-upgrade** | `backup/pre-stack-upgrade-2026-03-26` | `0e28dc9` | Before Vite 8, React 19, ESLint 10, Tailwind 4 |
| **POST-upgrade** | `backup/post-stack-upgrade-2026-06-25` | `94b3fff` | After all three upgrade phases merged and QA passed |

Each name exists as both an **annotated tag** and a **frozen branch** at the same commit.

## Upgrade phases

| Phase | Branch (typical) | Contents |
|-------|------------------|----------|
| 1 | `upgrade/vite8-react19` | Vite 8, `@vitejs/plugin-react` 6, React 19 |
| 2 | `upgrade/eslint10` | ESLint 10, react-hooks 7 |
| 3 | `upgrade/tailwind4` | Tailwind CSS 4 |

Each phase is merged only when `npm run lint`, `npm run build`, and smoke QA pass. Pull requests run [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (lint + build, no deploy).

Production still deploys from `main` via [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

## Fast revert (production broken after a merge)

### Option A — Revert the merge commit (recommended)

```bash
git log --oneline -10          # find the merge commit SHA
git revert -m 1 <merge-sha>
git push origin main
```

GitHub Pages redeploys in roughly 5–10 minutes.

### Option B — Reset to a backup tag (fastest; force-push required)

**Roll back to pre-upgrade stack:**

```bash
git checkout main
git pull origin main
git reset --hard backup/pre-stack-upgrade-2026-03-26
git push --force origin main
```

**Roll back to post-upgrade stack** (e.g. after a bad change on `main`):

```bash
git checkout main
git pull origin main
git reset --hard backup/post-stack-upgrade-2026-06-25
git push --force origin main
```

Only use when revert is messy or you need an immediate rollback. Coordinate with anyone else pushing to `main`.

### Option C — GitHub Release archive

If you created a Release from `backup/pre-stack-upgrade-2026-03-26`, download the source zip from GitHub Releases as an offline reference.

## Local checkout of a backup state

```bash
git fetch origin --tags

# Pre-upgrade
git checkout backup/pre-stack-upgrade-2026-03-26

# Post-upgrade
git checkout backup/post-stack-upgrade-2026-06-25
```

Detached HEAD is fine for inspection. To branch from a backup: `git checkout -b restore-from-backup backup/post-stack-upgrade-2026-06-25`.
