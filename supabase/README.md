# Supabase Setup Guide — MITE Canteen Pre-Order System

This folder contains the complete PostgreSQL schema, security triggers, priority scoring functions, Realtime setup, Storage buckets, and demo seed data for the MITE Canteen Pre-Order System.

---

## 📁 Files

| File | Purpose |
|---|---|
| [`paste_in_sql_editor.sql`](./paste_in_sql_editor.sql) | **All-in-one setup script** (`001` + `002` + `seed.sql`) — copy, paste, and click **Run** in the Supabase SQL Editor. |
| [`migrations/001_initial_schema.sql`](./migrations/001_initial_schema.sql) | Initial 13 tables, base functions, triggers, and RLS policies. |
| [`migrations/002_enhancements_and_storage.sql`](./migrations/002_enhancements_and_storage.sql) | Hardened `@mite.ac.in` email triggers, role/block protection trigger, PRD priority scoring (`recompute_priority`), `flag_overdue_noshows()` RPC, tightened RLS, Realtime publication, and Storage buckets + policies. |
| [`seed.sql`](./seed.sql) | Idempotent seed: 5 categories, 24 menu items, 72 daily pickup slots, default `settings`, 11 Auth users + profiles, 2 `staff_accounts`, 15 orders + line items, 5 print jobs, notifications, SMS log, and audit log. |

---

## 🚀 Step 1 — Run the Setup SQL in Supabase

### Option A: One-Click Paste in Supabase Dashboard (Recommended)

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** → **New query**.
3. Open [`supabase/paste_in_sql_editor.sql`](./paste_in_sql_editor.sql), copy the **entire contents**, and paste it into the editor.
4. Click **Run** (or press `Cmd + Enter` / `Ctrl + Enter`).
5. Confirm it completes with `Success. No rows returned` (the script is idempotent and safe to re-run).

### Option B: Run Files Sequentially

If you prefer applying migrations step by step via SQL Editor or Supabase CLI:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_enhancements_and_storage.sql`
3. `supabase/seed.sql`

---

## ✅ Step 2 — Verify Database, Buckets, Realtime & Users

Run this quick verification snippet in the Supabase **SQL Editor**:

```sql
-- 1. Check tables & row counts
SELECT 'categories'    AS item, COUNT(*) AS count FROM public.categories
UNION ALL SELECT 'menu_items',     COUNT(*) FROM public.menu_items
UNION ALL SELECT 'pickup_slots',   COUNT(*) FROM public.pickup_slots
UNION ALL SELECT 'profiles',       COUNT(*) FROM public.profiles
UNION ALL SELECT 'staff_accounts', COUNT(*) FROM public.staff_accounts
UNION ALL SELECT 'orders',         COUNT(*) FROM public.orders
UNION ALL SELECT 'print_jobs',     COUNT(*) FROM public.print_jobs
UNION ALL SELECT 'settings',       COUNT(*) FROM public.settings;

-- 2. Check storage buckets ('print-jobs' private, 'menu-images' public)
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('print-jobs', 'menu-images');

-- 3. Check Realtime publication tables
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
```

Expected counts on a fresh setup:
- `categories`: **5**
- `menu_items`: **24** (3 marked `in_stock = false` with `back_at` tags)
- `pickup_slots`: **72** (08:00–20:00 IST in 10-minute slots)
- `profiles`: **11** (1 admin, 2 shopkeepers, 6 students, 2 faculty)
- `staff_accounts`: **2** (`canteen` and `print`)
- `orders`: **15** (spanning `collected`, `ready`, `preparing`, `accepted`, `placed`, `awaiting_cash`, `cancelled`, including 1 walk-in guest order)
- `print_jobs`: **5** (spanning `paid`, `printing`, `ready`, `collected`)
- `settings`: **1** (`general`)
- Storage buckets: **`print-jobs`** (`public = false`, 20 MB, PDF only) and **`menu-images`** (`public = true`, 5 MB)
- Realtime tables: `menu_items`, `notifications`, `orders`, `pickup_slots`, `print_jobs`, `sms_log`

---

## 🔑 Step 3 — Configure `.env.local`

In the repository root, copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Open **Supabase Dashboard → Project Settings → API** and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-secret-key>
QR_SIGNING_SECRET=<generate-with-openssl-rand-hex-32>
ALLOWED_EMAIL_DOMAIN=mite.ac.in
```

> Generate a strong `QR_SIGNING_SECRET` with:
> ```bash
> openssl rand -hex 32
> ```

---

## 📧 Step 4 — Supabase Auth & Email OTP Settings

1. **URL Configuration** (**Authentication → URL Configuration**):
   - **Site URL:** `http://localhost:3000` (update to your production URL when deployed)
   - **Redirect URLs:** add:
     - `http://localhost:3000/**`
     - `https://<your-production-domain>/**`
2. **Email Provider** (**Authentication → Providers → Email**):
   - Ensure **Enable Email provider** is ON.
   - Ensure **Enable Email Signup** is ON (the PostgreSQL `BEFORE INSERT` trigger `enforce_mite_email_before_insert` automatically blocks any non-`@mite.ac.in` address, lookalike domains, and malformed emails).
3. **6-Digit OTP Template** (**Authentication → Email Templates → Magic Link**):
   - Because `/login` verifies a 6-digit OTP via `verifyOtp({ type: 'email' })`, make sure your **Magic Link** template body displays `{{ .Token }}`:
     ```html
     <h2>Your MITE Canteen Login Code</h2>
     <p>Enter this 6-digit verification code:</p>
     <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
     ```

---

## 🎭 Seeded Demo Accounts

| Role | Email | Password / Login Method | Portal |
|---|---|---|---|
| **Admin** | `admin@mite.ac.in` | `Admin@789` | `/admin/login` |
| **Canteen Staff** | `canteen@mite.ac.in` | `Canteen@123` | `/staff/login` |
| **Print Staff** | `print@mite.ac.in` | `Print@456` | `/staff/login` |
| **Student** | `4mt21cs001@mite.ac.in` | Email OTP | `/login` |
| **Student** | `4mt22ec042@mite.ac.in` | Email OTP | `/login` |
| **Student** | `4mt21is018@mite.ac.in` | Email OTP | `/login` |
| **Student** | `4mt22me033@mite.ac.in` | Email OTP | `/login` |
| **Student** | `4mt23ai012@mite.ac.in` | Email OTP | `/login` |
| **Student** | `4mt23cs055@mite.ac.in` | Email OTP | `/login` |
| **Faculty** | `john.doe@mite.ac.in` | Email OTP | `/login` |
| **Faculty** | `priya.sharma@mite.ac.in` | Email OTP | `/login` |

---

## 🛠️ Maintenance RPCs

- **Flag overdue no-shows (> 20 min past `arrive_at`) and release slot capacity:**
  ```sql
  SELECT public.flag_overdue_noshows();
  ```
- **Recompute an order's kitchen priority score:**
  ```sql
  SELECT public.recompute_priority('<order-uuid>');
  ```
- **Regenerate today's pickup slots** via the Admin UI (**Admin → Slots → Generate Today's Slots**) or by re-running `supabase/seed.sql`.
