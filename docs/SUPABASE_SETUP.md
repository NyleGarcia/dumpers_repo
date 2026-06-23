# Supabase setup

Use this guide when standing up a **new** Dumper's Repo franchise database, or when catching up an **existing** database with new migrations.

## If you already have a live database

1. **Do not** re-run the squashed baseline (`001`–`006`) or migrations you have already applied.
2. If you previously ran incremental migrations `001`–`041` from `supabase/migrations_legacy/`, your starting point for this repo is **`042_site_settings.sql`** onward.
3. In **SQL Editor**, run only the migration files you are **missing**, **in numeric order** (see full list below).
4. Each file is idempotent where practical. Errors about existing objects usually mean that step already ran — verify with the sanity checks at the end.

**Latest migration:** `084_discord_rsi_personal_webhooks.sql` (RSI gate for personal deal webhooks). Apply `080`–`083` first if not already applied.

---

## 1. Create a Supabase project

1. [supabase.com](https://supabase.com) → New project
2. Note **Project URL** and **anon public** key for `.env`
3. Note **service_role** key (Settings → API) — needed for Edge Functions; keep secret

---

## 2. Enable Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs:
   - `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
   - Your app origin(s) for local dev: `http://localhost:5173`
4. Copy the **Client ID** and **Client Secret**
5. In Supabase: Authentication → Providers → Google → Enable
6. Paste Client ID and Client Secret
7. Add your app origin(s) to Site URL and Redirect URLs

---

## 3. Run SQL migrations

In **SQL Editor**, run these files **in order** from `supabase/migrations/`:

| # | File | Summary |
|---|------|---------|
| 1 | `001_core_profiles_auth.sql` | Profiles, auth trigger |
| 2 | `002_bans_admin.sql` | Ban infrastructure |
| 3 | `003_blueprints_catalog.sql` | Blueprint resources catalog |
| 4 | `004_resource_tracker.sql` | Personal inventory, site totals |
| 5 | `005_orders_schema.sql` | Custom orders system |
| 6 | `006_access_rls_functions.sql` | RLS policies, access functions |
| 7 | `042_site_settings.sql` | Site-wide settings (DFP display toggle) |
| 8 | `043_blueprint_order_overrides.sql` | Blueprint orderable overrides |
| 9 | `044_auto_approve_setting.sql` | Auto-approve new signups toggle |
| 10 | `045_remove_preview_features.sql` | Opens preview-gated features to all members |
| 11 | `046_starstrings_data.sql` | Legacy reference data tables (later renamed in 075) |
| 12 | `047_public_auto_approve_read.sql` | Public read for auto-approve status (login page) |
| 13 | `048_blueprints_sync.sql` | Legacy `synced_blueprints` table (dropped in 079) |
| 14 | `049_welcome_modal.sql` | Welcome onboarding (`has_seen_welcome`, always-show setting) |
| 15 | `050_rsi_handle_verification.sql` | RSI Handle verification |
| 16 | `051_support_tickets.sql` | Support ticket system |
| 17 | `052_order_creation_notify.sql` | Notify members on new custom order |
| 18 | `053_pending_rep_limits.sql` | Pending rep order limits + RSI enforcement |
| 19 | `054_order_abuse_prevention.sql` | Min order value, duplicate detection, abuse reports |
| 20 | `055_order_timeouts.sql` | 72h timeouts, rating deadlines, disputes, strikes |
| 21 | `056_officer_rep_immunity.sql` | Officers/super-admins exempt from pending rep limits |
| 22 | `057_guest_preview_anon_read.sql` | Anonymous read for archive reference data |
| 23 | `058_officer_ratings_escalation.sql` | Officer ticket ratings + escalation |
| 24 | `059_mining_tracker.sql` | Mining Tracker entries (member sync) |
| 25 | `060_shop_data.sql` | Shop inventories and prices (UEX sync target tables) |
| 26 | `061_discord_integration.sql` | Discord webhook integration + message queue |
| 27 | `062_granular_order_events.sql` | Granular Discord order event subscriptions |
| 28 | `063_user_webhook_management.sql` | User-managed Discord webhooks (4 max) |
| 29 | `064_rename_order_fulfilled.sql` | Rename Discord “Order Fulfilled” → “Order Accepted” |
| 30 | `065_discord_cron_job.sql` | pg_cron job to drain Discord queue |
| 31 | `066_fix_queue_status_rpc.sql` | Fix `get_discord_queue_status` RPC |
| 32 | `067_discord_cron_1min.sql` | Discord cron interval → 1 minute |
| 33 | `068_discord_cron_config.sql` | Discord cron config in `app_config` table |
| 34 | `069_order_slot_qualities.sql` | Per-slot quality on order blueprint lines |
| 35 | `070_slot_qualities_rpc.sql` | RPC updates for slot qualities on create/edit |
| 36 | `071_new_user_discord_notification.sql` | Discord notification on new sign-ups |
| 37 | `072_inventory_note_field.sql` | Note field on personal resource inventory |
| 38 | `073_blueprint_owner_counts.sql` | Blueprint owner count RPC for order UI |
| 39 | `074_resource_lore.sql` | Resource lore/description column |
| 40 | `075_game_data_tables.sql` | Rename `starstrings_*` → `game_*` tables |
| 41 | `076_game_data_anon_read.sql` | Anonymous read on public `game_*` reference tables |
| 42 | `077_guest_pending_order_count.sql` | `get_pending_custom_order_count()` for Offline Fulfillment teaser |
| 43 | `078_order_listing_type.sql` | WTB/WTS `listing_type`, semantic buyer/seller RPCs |
| 44 | `079_drop_synced_blueprints.sql` | Drop legacy `synced_blueprints` (sccrafter era) |
| 45 | `080_discord_personal_routing.sql` | Personal + marketplace Discord routing, server-side triggers |
| 46 | `081_rsi_org_schema.sql` | RSI org affiliation tables (DB only; site code deferred) |
| 47 | `082_discord_market_coalesce.sql` | Marketplace listing churn coalesce + admin quiet-period setting |
| 48 | `083_discord_per_event_webhooks.sql` | Remove webhook cap; per-event sync RPC; return URLs to owner |
| 49 | `084_discord_rsi_personal_webhooks.sql` | Require RSI verification for `my_order_*` webhook registration |

### pg_cron (migrations 054, 065–068)

Migrations **065–068** schedule a cron job that calls the `send-discord` Edge Function. On Supabase:

1. Dashboard → **Database** → **Extensions** → enable **pg_cron** and **pg_net**
2. Deploy the `send-discord` Edge Function (see below)
3. Run migrations 065–068 if not already applied

If pg_cron is unavailable on your plan, Discord queue messages can still be processed manually from super-admin Discord settings (invoke `send-discord`).

---

## 4. Deploy Edge Functions

```bash
npm install -g supabase   # if needed
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase functions deploy ban-user
supabase functions deploy unban-user
supabase functions deploy delete-account
supabase functions deploy sync-shop-data
supabase functions deploy validate-rsi-handle
supabase functions deploy send-discord
```

| Function | Purpose |
|----------|---------|
| `ban-user` / `unban-user` | Admin user management |
| `delete-account` | User self-service account deletion |
| `sync-shop-data` | UEX Corp API → shop inventory tables |
| `validate-rsi-handle` | Validate RSI Handles against robertsspaceindustries.com |
| `send-discord` | Process queued Discord webhook messages (used by pg_cron) |

Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` automatically. **Never** expose service_role in frontend code.

> **Removed from repo:** `sync-blueprints` (sccrafter.com) and `sync-starstrings` (StarStrings). Blueprint catalog ships from `game-blueprints.json`; reference data uses game file extraction + optional `sync-game-data-to-db.mjs`.

---

## 5. Promote a super-admin

After your first Google sign-in (creates a `pending` profile):

```sql
UPDATE public.profiles
SET role = 'super-admin', approved_at = now()
WHERE email = 'your-google-email@example.com';
```

---

## 6. Configure the frontend

Copy `.env.example` to `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Optional (production franchises must use the canonical DFP host per LICENSE):

```env
# Dev only — local public/ copy from dfp-engine-private build
# VITE_DFP_ENGINE_BASE_URL=http://localhost:5173
```

---

## 7. Build and host

```bash
npm install
npm run build
```

Deploy `dist/` to your static host. See [docs/SELF_HOSTING.md](SELF_HOSTING.md).

---

## 8. DFP canonical hosting

Franchise production apps load DFP from **https://www.dumpers-repo.com**:

- `/dfp-engine.js`
- `/dfp-version.json`

Configure **CORS** on the reference host so franchise origins can fetch these files.

---

## Sanity checks

After applying migrations, verify key features:

```sql
-- 077: Offline Fulfillment teaser
SELECT public.get_pending_custom_order_count();

-- 078: WTB/WTS marketplace
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'custom_orders' AND column_name = 'listing_type';

-- Shops (060)
SELECT COUNT(*) FROM public.shops;

-- Game data tables (075/076)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'game_%';

-- 079: legacy sccrafter table removed
SELECT to_regclass('public.synced_blueprints');  -- should be NULL

-- 080: personal Discord routing
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'discord_message_queue' AND column_name = 'target_user_id';

-- 081: org schema (optional until Phase 2 site code)
SELECT to_regclass('public.user_rsi_org_affiliations');  -- should exist after 081

-- 082: marketplace Discord coalesce
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'discord_settings' AND column_name = 'market_coalesce_enabled';

-- 084: RSI gate on personal deal webhooks
SELECT pg_get_functiondef(oid) LIKE '%my_order_%'
FROM pg_proc
WHERE proname = 'sync_my_discord_event_webhooks';
```

---

## Legacy migrations

`supabase/migrations_legacy/` (001–041) is historical audit only — **not** for new installs.
