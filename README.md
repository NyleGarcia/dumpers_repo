# Dumper's Repo

**Buy. Craft. Sell.** — Blueprint tracking, resource coordination, and a member marketplace for Star Citizen orgs.

**Reference deployment:** [dumpers-repo.com](https://www.dumpers-repo.com) (Black Star, operated by Michael Linzenmeyer / RSI `Sinedrone_Sentinel`). Other hosts running this codebase are separate franchise instances.

## Features

### Core tools

- **Blueprints** — Browse the catalog, mark acquired blueprints, member collection directory
- **Mission Tracker** — Personal target blueprint list with mission preferences
- **Resource Tracker** — Per-member stock (quality-tier SCU), **Site Total** live rollup, super-admin catalog sync
- **Mining Tracker** — RS signature reference grid for mining (available offline)
- **Info Archive** — Components, ordnance, factions, resource lore, and site guides

### Marketplace (members only)

- **Custom Orders** — One **New Order** form for both listing types:
  - **WTB** (Submit Buy Order) — request crafted items or supplied resources
  - **WTS** (Submit Sell Order) — offer stock or crafted items you have on hand
  - DFP-priced lines, reputation gates, edit or delete while pending
- **Fulfillment** — Browse pending **WTB** and **WTS** listings with All/WTB/WTS filters; accept to craft for buyers or purchase from sellers; optional inventory deduct; ratings and archive

Both marketplace pages share one reputation system (buyer rep + fulfiller/seller rep). RSI Handle verification is required to post or accept.

### Offline Mode (no account)

Try most tools in the browser before signing up: blueprints, Mission Tracker, Resource Tracker, Mining Tracker, and Archive. Offline progress can migrate to your account on first sign-in.

**Fulfillment teaser:** Offline users can open Fulfillment to see how many orders are waiting (count only — sign in to browse details or accept).

Custom Orders and accepting trades require a free member account.

### Community & admin

- **Notifications** — Header bell; dismiss deletes the row
- **Discord Webhooks** — Paste your channel webhook at `/discord-subscribe` for personal deal alerts, opt-in marketplace feed, and support ticket updates
- **Support tickets** — Member bug reports and issue reporting
- **Roles** — Google OAuth; `pending` → officer approval → `member` / `officer` / `super-admin`
- **Ghost Mode** — Hide from member directory; keeps personal tools, hides orders/fulfillment
- **Admin** — Approve users, roles, ban/unban; super-admin **DB Actions** (game data extract/parse/deploy)

## Tech stack

React 18, Vite, TanStack Router/Query, Tailwind, Supabase (Auth + Postgres + RLS + RPCs).

## Quick start

1. Clone and `npm install` (Node **22+**, npm **11+** — see `.nvmrc`)
2. Copy `.env.example` → `.env` with your Supabase URL and anon key
3. Set up the database — see [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)
   - **Existing databases:** apply incremental migrations in order through `082_discord_market_coalesce.sql`
4. `npm run dev` for local development
5. `npm run build` to produce `dist/` for any static host

## Hosting

Host `dist/` on **any** static file provider (GitHub Pages, Cloudflare, nginx, S3, etc.). GitHub Actions in this repo deploys the reference instance to GitHub Pages only.

## Game data

Blueprint and component catalog data comes from direct Star Citizen game file extraction. After a patch:

```bash
.\scripts\extract-game-data.ps1
node scripts/parse-extracted-data.mjs
```

Output lives in `src/data/game-*.json`. Super-admins can also run extract → parse → deploy from **DB Actions**. See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Dumpers Fair-Value Pricing (DFP)

**Dumper's Fair-Value Price (DFP)** is **proprietary** to Michael Linzenmeyer. Production franchises must load the official engine from `https://www.dumpers-repo.com` (`dfp-engine.js` + `dfp-version.json`). Do not tamper with or replace the engine.

The engine is built from the private **dfp-engine-private** repository (not public). This repo ships the pre-built bundle in `public/`.

Super-admins may **disable DFP display** in Settings; the required opt-out footer notice appears on every page.

## Franchise policy

Dumper's Repo is owned and licensed by **Michael Linzenmeyer** (RSI: Sinedrone_Sentinel). You may run a **free** franchise for your org under [LICENSE](LICENSE):

- Keep the **Dumper's Repo** header
- **Do not charge** members to use the app
- **Do not tamper with** DFP
- Ship unmodified [LICENSE](LICENSE) and [TRADEMARK.md](TRADEMARK.md)

See [TRADEMARK.md](TRADEMARK.md) for brand rules.

## Disclaimer

Not affiliated with Cloud Imperium Games. Star Citizen is a trademark of Cloud Imperium Games.
