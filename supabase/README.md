# Supabase Setup Guide — MITE Canteen Pre-Order System

This folder contains the single, self-contained Supabase database setup script for the MITE Canteen Pre-Order System.

---

## 📁 Files

| File | Purpose |
|---|---|
| [`final_setup.sql`](./final_setup.sql) | **Complete all-in-one setup script** — creates all 13 tables, indexes, security triggers, PRD priority & no-show RPCs, RLS policies, Realtime publication, Storage buckets + policies, and full idempotent demo seed data. |

---

## 🚀 Step 1 — Run `supabase/final_setup.sql` in Supabase Dashboard

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** → **New query**.
3. Open [`supabase/final_setup.sql`](./final_setup.sql), copy the **entire contents**, and paste it into the SQL Editor.
4. Click **Run** (or press `Cmd + Enter` / `Ctrl + Enter`).
5. Confirm it completes cleanly (safe & idempotent — you can re-run it at any time without duplicate errors).

---

## ✅ Step 2 — Verify Tables, Buckets, Realtime & Seed Data

Run this verification query in the Supabase **SQL Editor**:

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

Copy `.env.example` to `.env.local` in the repository root:

```bash
cp .env.example .env.local
```

Open **Supabase Dashboard → Project Settings → API** and fill in your project values (never commit `.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-or-anon-key>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<optional-legacy-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<optional-service-role-key>
QR_SIGNING_SECRET=<generate-with-openssl-rand-hex-32>
ALLOWED_EMAIL_DOMAIN=mite.ac.in
```

> Generate a strong `QR_SIGNING_SECRET` with:
> ```bash
> openssl rand -hex 32
> ```

---

## 📧 Step 4 — Supabase Auth Settings

1. **URL Configuration** (**Authentication → URL Configuration**):
   - **Site URL:** `http://localhost:3000` (or your production domain)
   - **Redirect URLs:** add `http://localhost:3000/**`
2. **Email Provider** (**Authentication → Providers → Email**):
   - Keep **Enable Email provider** ON.
   - New `@mite.ac.in` accounts created during demo OTP `1234` login are automatically domain-validated and email-confirmed by `enforce_mite_email_before_insert` in `final_setup.sql` (non-`@mite.ac.in` emails and lookalikes like `@mite.ac.in.evil.com` are rejected at the database layer).

---

## 🎭 Seeded Demo Accounts

| Role | Email | Login / OTP | Portal |
|---|---|---|---|
| **Admin** | `admin@mite.ac.in` | `Admin@789` | `/admin/login` |
| **Canteen Staff** | `canteen@mite.ac.in` | `Canteen@123` | `/staff/login` |
| **Print Staff** | `print@mite.ac.in` | `Print@456` | `/staff/login` |
| **Student** | `4mt21cs001@mite.ac.in` | Demo OTP `1234` | `/login` |
| **Student** | `4mt22ec042@mite.ac.in` | Demo OTP `1234` | `/login` |
| **Student** | `4mt21is018@mite.ac.in` | Demo OTP `1234` | `/login` |
| **Student** | `4mt22me033@mite.ac.in` | Demo OTP `1234` | `/login` |
| **Student** | `4mt23ai012@mite.ac.in` | Demo OTP `1234` | `/login` |
| **Student** | `4mt23cs055@mite.ac.in` | Demo OTP `1234` | `/login` |
| **Faculty** | `john.doe@mite.ac.in` | Demo OTP `1234` | `/login` |
| **Faculty** | `priya.sharma@mite.ac.in` | Demo OTP `1234` | `/login` |

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
- **Regenerate today's pickup slots** via the Admin UI (**Admin → Slots → Generate Today's Slots**) or by re-running `supabase/final_setup.sql`.
