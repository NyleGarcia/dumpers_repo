# Stack upgrade — backup and revert

**Backup tag (known-good before major upgrades):** `backup/pre-stack-upgrade-2026-03-26`  
**Backup branch:** `backup/pre-stack-upgrade-2026-03-26` (same commit as the tag)

Created from `main` at commit `0e28dc9` before Vite 8, React 19, ESLint 10, and Tailwind 4.

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

### Option B — Reset to backup tag (fastest; force-push required)

```bash
git checkout main
git pull origin main
git reset --hard backup/pre-stack-upgrade-2026-03-26
git push --force origin main
```

Only use when revert is messy or you need an immediate rollback. Coordinate with anyone else pushing to `main`.

### Option C — GitHub Release archive

If you created a Release from `backup/pre-stack-upgrade-2026-03-26`, download the source zip from GitHub Releases as an offline reference.

## Local checkout of backup state

```bash
git fetch origin --tags
git checkout backup/pre-stack-upgrade-2026-03-26
```

Detached HEAD is fine for inspection. To branch from backup: `git checkout -b restore-from-backup backup/pre-stack-upgrade-2026-03-26`.
