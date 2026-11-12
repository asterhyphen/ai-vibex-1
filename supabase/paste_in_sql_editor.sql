-- ============================================================================
-- MITE Canteen Pre-Order System — COMPLETE SUPABASE SETUP SCRIPT
-- ============================================================================
-- HOW TO USE:
--   1. Open your Supabase Dashboard -> SQL Editor -> New Query
--   2. Paste this entire file and click RUN (Cmd/Ctrl + Enter)
--   3. Safe & idempotent: can be re-run without duplicate errors
--
-- INCLUDES:
--   Part 1: Initial Schema (001_initial_schema.sql — 13 tables, base RLS)
--   Part 2: Security Triggers, Priority Scoring, No-Show RPC, Realtime & Storage
--           (002_enhancements_and_storage.sql)
--   Part 3: Complete Demo Seed (seed.sql — 5 categories, 24 items, 72 slots,
--           11 auth users + profiles, 2 staff counters, 15 orders, 5 print jobs,
--           notifications, SMS log, audit log)
-- ============================================================================


-- ============================================================================
-- PART 1: INITIAL SCHEMA (001_initial_schema.sql)
-- ============================================================================

-- ============================================================
-- MITE Canteen Pre-Order System — Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- ─────────────────────────── Extensions ────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────── Helpers ───────────────────────

-- set_updated_at: auto-bumps updated_at on every row update
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- get_my_role: returns the role of the currently-authenticated user
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- generate_order_code: returns LETTER-DDDD format (e.g. A-1234)
CREATE OR REPLACE FUNCTION generate_order_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  letters TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  letter  TEXT;
  digits  TEXT;
  code    TEXT;
  tries   INT := 0;
BEGIN
  LOOP
    letter := SUBSTR(letters, FLOOR(RANDOM() * LENGTH(letters) + 1)::INT, 1);
    digits := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    code   := letter || '-' || digits;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE orders.code = code);
    tries := tries + 1;
    IF tries > 100 THEN RAISE EXCEPTION 'Could not generate unique order code'; END IF;
  END LOOP;
  RETURN code;
END;
$$;

-- recompute_priority: calculates priority_score for an order
CREATE OR REPLACE FUNCTION recompute_priority(p_order_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_arrive_at      TIMESTAMPTZ;
  v_is_faculty     BOOL;
  v_placed_at      TIMESTAMPTZ;
  v_faculty_boost  INT;
  v_epoch_minutes  NUMERIC;
  v_waiting_min    NUMERIC;
  v_score          NUMERIC;
BEGIN
  SELECT o.arrive_at, o.is_faculty, o.created_at
    INTO v_arrive_at, v_is_faculty, v_placed_at
    FROM public.orders o WHERE o.id = p_order_id;

  SELECT (value->>'faculty_boost_minutes')::INT
    INTO v_faculty_boost
    FROM public.settings WHERE key = 'general' LIMIT 1;

  v_faculty_boost := COALESCE(v_faculty_boost, 5);

  v_epoch_minutes := EXTRACT(EPOCH FROM v_arrive_at) / 60.0;

  -- faculty get a negative boost (earlier in queue)
  IF v_is_faculty THEN
    v_epoch_minutes := v_epoch_minutes - v_faculty_boost;
  END IF;

  -- anti-starvation: orders waiting > 15 min get a boost
  v_waiting_min := EXTRACT(EPOCH FROM (NOW() - v_placed_at)) / 60.0;
  IF v_waiting_min > 15 THEN
    v_epoch_minutes := v_epoch_minutes - 10;
  END IF;

  v_score := v_epoch_minutes;

  UPDATE public.orders SET priority_score = v_score WHERE id = p_order_id;
END;
$$;

-- ─────────────────────────── Tables ────────────────────────

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  role        TEXT NOT NULL CHECK (role IN ('student','faculty','shopkeeper','admin')),
  phone       TEXT UNIQUE,
  phone_verified BOOL NOT NULL DEFAULT FALSE,
  department  TEXT,
  is_blocked  BOOL NOT NULL DEFAULT FALSE,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- staff_accounts
CREATE TABLE IF NOT EXISTS public.staff_accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  counter      TEXT NOT NULL CHECK (counter IN ('canteen','print')),
  active       BOOL NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- login_attempts (rate-limiting helper)
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  attempts     INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- categories
CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  icon       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- menu_items
CREATE TABLE IF NOT EXISTS public.menu_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  price_paise INT NOT NULL CHECK (price_paise > 0),
  prep_seconds INT NOT NULL DEFAULT 300,
  in_stock    BOOL NOT NULL DEFAULT TRUE,
  image_url   TEXT,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  is_active   BOOL NOT NULL DEFAULT TRUE,
  load_weight NUMERIC NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- pickup_slots
CREATE TABLE IF NOT EXISTS public.pickup_slots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_start     TIMESTAMPTZ NOT NULL,
  slot_end       TIMESTAMPTZ NOT NULL,
  capacity_units INT NOT NULL DEFAULT 20,
  used_units     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- orders
CREATE TABLE IF NOT EXISTS public.orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT NOT NULL UNIQUE,
  user_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name         TEXT,
  guest_token        TEXT,
  source             TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app','guest')),
  status             TEXT NOT NULL DEFAULT 'placed' CHECK (status IN (
                       'placed','awaiting_cash','accepted','preparing',
                       'ready','collected','cancelled','rejected')),
  payment_method     TEXT CHECK (payment_method IN ('online','cash')),
  payment_status     TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded')),
  total_paise        INT,
  cash_received_paise INT,
  change_given_paise  INT,
  slot_id            UUID REFERENCES public.pickup_slots(id) ON DELETE SET NULL,
  eta_minutes        INT,
  arrive_at          TIMESTAMPTZ,
  priority_score     NUMERIC,
  is_faculty         BOOL NOT NULL DEFAULT FALSE,
  qr_token           TEXT UNIQUE,
  collected_at       TIMESTAMPTZ,
  note               TEXT,
  rejected_reason    TEXT,
  no_show            BOOL NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- order_items
CREATE TABLE IF NOT EXISTS public.order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id    UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name_snapshot   TEXT NOT NULL,
  qty             INT NOT NULL CHECK (qty > 0),
  unit_price_paise INT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- print_jobs
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name     TEXT,
  file_path      TEXT,
  original_name  TEXT,
  pages          INT,
  color          BOOL NOT NULL DEFAULT FALSE,
  double_sided   BOOL NOT NULL DEFAULT FALSE,
  copies         INT NOT NULL DEFAULT 1 CHECK (copies BETWEEN 1 AND 50),
  paper          TEXT NOT NULL DEFAULT 'A4' CHECK (paper IN ('A4','A3')),
  cost_paise     INT,
  status         TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
                   'uploaded','paid','printing','ready','collected','rejected')),
  payment_method TEXT CHECK (payment_method IN ('online','cash')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded')),
  qr_token       TEXT UNIQUE,
  sanitised      BOOL NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  kind       TEXT NOT NULL DEFAULT 'info' CHECK (kind IN ('info','success','warning','error')),
  read       BOOL NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- sms_log
CREATE TABLE IF NOT EXISTS public.sms_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL,
  body       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- settings
CREATE TABLE IF NOT EXISTS public.settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  value      JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  table_name TEXT,
  row_id     UUID,
  diff       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────── updated_at Triggers ───────────────

DO $$ DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles','staff_accounts','login_attempts','categories','menu_items',
    'pickup_slots','orders','order_items','print_jobs','notifications',
    'sms_log','settings','audit_log'
  ] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;
      CREATE TRIGGER trg_%I_updated_at
      BEFORE UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- ─────────────────────── New-User Trigger ──────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_domain     TEXT;
  v_local      TEXT;
  v_role       TEXT;
  v_full_name  TEXT;
BEGIN
  -- Extract local part and domain
  v_local  := SPLIT_PART(NEW.email, '@', 1);
  v_domain := LOWER(SPLIT_PART(NEW.email, '@', 2));

  -- Reject lookalike domains: must be exactly 'mite.ac.in'
  IF v_domain <> 'mite.ac.in' THEN
    RAISE EXCEPTION 'Registration restricted to @mite.ac.in email addresses';
  END IF;

  -- Derive role: 4MT prefix → student, else faculty
  IF LOWER(v_local) LIKE '4mt%' THEN
    v_role := 'student';
  ELSE
    v_role := 'faculty';
  END IF;

  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', v_local);

  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (NEW.id, v_full_name, v_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_new_user ON auth.users;
CREATE TRIGGER trg_on_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────── RLS ───────────────────────────

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_slots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log      ENABLE ROW LEVEL SECURITY;

-- ── profiles policies ──────────────────────────────────────
DROP POLICY IF EXISTS "profiles: own read" ON public.profiles;
CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles: own update" ON public.profiles;
CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles: staff/admin read all" ON public.profiles;
CREATE POLICY "profiles: staff/admin read all"
  ON public.profiles FOR SELECT
  USING (get_my_role() IN ('shopkeeper','admin'));

DROP POLICY IF EXISTS "profiles: admin full" ON public.profiles;
CREATE POLICY "profiles: admin full"
  ON public.profiles FOR ALL
  USING (get_my_role() = 'admin');

-- ── categories policies ────────────────────────────────────
DROP POLICY IF EXISTS "categories: authenticated read" ON public.categories;
CREATE POLICY "categories: authenticated read"
  ON public.categories FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "categories: shopkeeper update" ON public.categories;
CREATE POLICY "categories: shopkeeper update"
  ON public.categories FOR UPDATE
  USING (get_my_role() IN ('shopkeeper','admin'));

DROP POLICY IF EXISTS "categories: admin full" ON public.categories;
CREATE POLICY "categories: admin full"
  ON public.categories FOR ALL
  USING (get_my_role() = 'admin');

-- ── menu_items policies ────────────────────────────────────
DROP POLICY IF EXISTS "menu_items: authenticated read" ON public.menu_items;
CREATE POLICY "menu_items: authenticated read"
  ON public.menu_items FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "menu_items: shopkeeper update stock" ON public.menu_items;
CREATE POLICY "menu_items: shopkeeper update stock"
  ON public.menu_items FOR UPDATE
  USING (get_my_role() IN ('shopkeeper','admin'));

DROP POLICY IF EXISTS "menu_items: admin full" ON public.menu_items;
CREATE POLICY "menu_items: admin full"
  ON public.menu_items FOR ALL
  USING (get_my_role() = 'admin');

-- ── pickup_slots policies ──────────────────────────────────
DROP POLICY IF EXISTS "pickup_slots: authenticated read" ON public.pickup_slots;
CREATE POLICY "pickup_slots: authenticated read"
  ON public.pickup_slots FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "pickup_slots: shopkeeper/admin update" ON public.pickup_slots;
CREATE POLICY "pickup_slots: shopkeeper/admin update"
  ON public.pickup_slots FOR UPDATE
  USING (get_my_role() IN ('shopkeeper','admin'));

DROP POLICY IF EXISTS "pickup_slots: admin full" ON public.pickup_slots;
CREATE POLICY "pickup_slots: admin full"
  ON public.pickup_slots FOR ALL
  USING (get_my_role() = 'admin');

-- ── orders policies ────────────────────────────────────────
DROP POLICY IF EXISTS "orders: own read" ON public.orders;
CREATE POLICY "orders: own read"
  ON public.orders FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "orders: own insert" ON public.orders;
CREATE POLICY "orders: own insert"
  ON public.orders FOR INSERT
  WITH CHECK (user_id = auth.uid() OR source = 'guest');

DROP POLICY IF EXISTS "orders: shopkeeper/admin read all" ON public.orders;
CREATE POLICY "orders: shopkeeper/admin read all"
  ON public.orders FOR SELECT
  USING (get_my_role() IN ('shopkeeper','admin'));

DROP POLICY IF EXISTS "orders: shopkeeper/admin update" ON public.orders;
CREATE POLICY "orders: shopkeeper/admin update"
  ON public.orders FOR UPDATE
  USING (get_my_role() IN ('shopkeeper','admin'));

-- ── order_items policies ───────────────────────────────────
DROP POLICY IF EXISTS "order_items: own read" ON public.order_items;
CREATE POLICY "order_items: own read"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "order_items: own insert" ON public.order_items;
CREATE POLICY "order_items: own insert"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "order_items: shopkeeper/admin all" ON public.order_items;
CREATE POLICY "order_items: shopkeeper/admin all"
  ON public.order_items FOR ALL
  USING (get_my_role() IN ('shopkeeper','admin'));

-- ── print_jobs policies ────────────────────────────────────
DROP POLICY IF EXISTS "print_jobs: own read" ON public.print_jobs;
CREATE POLICY "print_jobs: own read"
  ON public.print_jobs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "print_jobs: own insert" ON public.print_jobs;
CREATE POLICY "print_jobs: own insert"
  ON public.print_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "print_jobs: shopkeeper/admin all" ON public.print_jobs;
CREATE POLICY "print_jobs: shopkeeper/admin all"
  ON public.print_jobs FOR ALL
  USING (get_my_role() IN ('shopkeeper','admin'));

-- ── notifications policies ─────────────────────────────────
DROP POLICY IF EXISTS "notifications: own read" ON public.notifications;
CREATE POLICY "notifications: own read"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications: own update" ON public.notifications;
CREATE POLICY "notifications: own update"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications: system insert" ON public.notifications;
CREATE POLICY "notifications: system insert"
  ON public.notifications FOR INSERT
  WITH CHECK (TRUE);

-- ── sms_log policies ───────────────────────────────────────
DROP POLICY IF EXISTS "sms_log: admin read" ON public.sms_log;
CREATE POLICY "sms_log: admin read"
  ON public.sms_log FOR SELECT
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "sms_log: system insert" ON public.sms_log;
CREATE POLICY "sms_log: system insert"
  ON public.sms_log FOR INSERT
  WITH CHECK (TRUE);

-- ── settings policies ──────────────────────────────────────
DROP POLICY IF EXISTS "settings: authenticated read" ON public.settings;
CREATE POLICY "settings: authenticated read"
  ON public.settings FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "settings: admin write" ON public.settings;
CREATE POLICY "settings: admin write"
  ON public.settings FOR ALL
  USING (get_my_role() = 'admin');

-- ── audit_log policies ─────────────────────────────────────
DROP POLICY IF EXISTS "audit_log: admin read" ON public.audit_log;
CREATE POLICY "audit_log: admin read"
  ON public.audit_log FOR SELECT
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "audit_log: system insert" ON public.audit_log;
CREATE POLICY "audit_log: system insert"
  ON public.audit_log FOR INSERT
  WITH CHECK (TRUE);

-- ── login_attempts policies ────────────────────────────────
DROP POLICY IF EXISTS "login_attempts: public all" ON public.login_attempts;
CREATE POLICY "login_attempts: public all"
  ON public.login_attempts FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- ── staff_accounts policies ────────────────────────────────
DROP POLICY IF EXISTS "staff_accounts: own read" ON public.staff_accounts;
CREATE POLICY "staff_accounts: own read"
  ON public.staff_accounts FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "staff_accounts: admin full" ON public.staff_accounts;
CREATE POLICY "staff_accounts: admin full"
  ON public.staff_accounts FOR ALL
  USING (get_my_role() = 'admin');

-- ============================================================================
-- PART 2: ENHANCEMENTS, SECURITY, REALTIME & STORAGE (002_enhancements_and_storage.sql)
-- ============================================================================

-- ============================================================
-- MITE Canteen Pre-Order System — Enhancements, Security,
-- Priority Scoring, No-Show RPC, Realtime & Storage
-- Migration: 002_enhancements_and_storage.sql
-- Idempotent: safe to re-run multiple times
-- ============================================================

-- ─────────────────────────── 1. Hardened Helpers & Email / Role Triggers ─────

-- Hardened get_my_role with explicit search_path
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Hardened generate_order_code (SECURITY DEFINER so uniqueness checks see all orders)
CREATE OR REPLACE FUNCTION public.generate_order_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  letters TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  letter  TEXT;
  digits  TEXT;
  v_code  TEXT;
  tries   INT := 0;
BEGIN
  LOOP
    letter := SUBSTR(letters, FLOOR(RANDOM() * LENGTH(letters) + 1)::INT, 1);
    digits := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    v_code := letter || '-' || digits;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.code = v_code);
    tries := tries + 1;
    IF tries > 100 THEN
      RAISE EXCEPTION 'Could not generate unique order code';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Strict BEFORE INSERT/UPDATE email validation on auth.users:
-- Rejects lookalike domains (e.g. @mite.ac.in.evil.com), whitespace, missing local part, etc.
CREATE OR REPLACE FUNCTION public.enforce_mite_email_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email  TEXT;
  v_local  TEXT;
  v_domain TEXT;
BEGIN
  v_email := LOWER(TRIM(COALESCE(NEW.email, '')));

  IF v_email = ''
     OR v_email !~ '^[^@\s]+@mite\.ac\.in$'
     OR ARRAY_LENGTH(STRING_TO_ARRAY(v_email, '@'), 1) <> 2 THEN
    RAISE EXCEPTION 'Registration restricted to valid @mite.ac.in email addresses';
  END IF;

  v_local  := SPLIT_PART(v_email, '@', 1);
  v_domain := SPLIT_PART(v_email, '@', 2);

  IF v_local = ''
     OR v_local !~ '^[a-z0-9._%+-]+$'
     OR v_local LIKE '.%'
     OR v_local LIKE '%.'
     OR v_local LIKE '%..%'
     OR v_domain <> 'mite.ac.in' THEN
    RAISE EXCEPTION 'Registration restricted to @mite.ac.in email addresses (received: %)', COALESCE(NEW.email, '<null>');
  END IF;

  NEW.email := v_email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_mite_email_before_insert ON auth.users;
CREATE TRIGGER trg_enforce_mite_email_before_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_mite_email_before_insert();

DROP TRIGGER IF EXISTS trg_enforce_mite_email_before_update ON auth.users;
CREATE TRIGGER trg_enforce_mite_email_before_update
  BEFORE UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.enforce_mite_email_before_insert();

-- Hardened handle_new_user() trigger function (safe trim/lowercase + search_path)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email     TEXT;
  v_domain    TEXT;
  v_local     TEXT;
  v_role      TEXT;
  v_full_name TEXT;
BEGIN
  v_email  := LOWER(TRIM(COALESCE(NEW.email, '')));
  v_local  := SPLIT_PART(v_email, '@', 1);
  v_domain := SPLIT_PART(v_email, '@', 2);

  IF v_email = ''
     OR v_email !~ '^[^@\s]+@mite\.ac\.in$'
     OR v_local = ''
     OR v_domain <> 'mite.ac.in'
     OR ARRAY_LENGTH(STRING_TO_ARRAY(v_email, '@'), 1) <> 2 THEN
    RAISE EXCEPTION 'Registration restricted to @mite.ac.in email addresses';
  END IF;

  IF v_local LIKE '4mt%' THEN
    v_role := 'student';
  ELSE
    v_role := 'faculty';
  END IF;

  v_full_name := COALESCE(
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
    v_local
  );

  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (NEW.id, v_full_name, v_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Prevent non-admin users from self-elevating role or unblocking themselves
CREATE OR REPLACE FUNCTION public.protect_profile_role_and_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND COALESCE(public.get_my_role(), '') <> 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Only administrators can change profile role';
    END IF;
    IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked THEN
      RAISE EXCEPTION 'Only administrators can change account block status';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Profile ownership cannot be changed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role_and_block ON public.profiles;
CREATE TRIGGER trg_protect_profile_role_and_block
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role_and_block();

-- Prevent staff from mutating counter/active/user_id when updating last_login_at
CREATE OR REPLACE FUNCTION public.protect_staff_account_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND COALESCE(public.get_my_role(), '') <> 'admin' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.counter IS DISTINCT FROM OLD.counter
       OR NEW.active IS DISTINCT FROM OLD.active THEN
      RAISE EXCEPTION 'Only administrators can modify staff assignment or active status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_staff_account_fields ON public.staff_accounts;
CREATE TRIGGER trg_protect_staff_account_fields
  BEFORE UPDATE ON public.staff_accounts
  FOR EACH ROW EXECUTE FUNCTION public.protect_staff_account_fields();

-- Prevent customers from mutating price/status/payment fields on their own orders
CREATE OR REPLACE FUNCTION public.protect_order_own_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND COALESCE(public.get_my_role(), '') NOT IN ('shopkeeper', 'admin') THEN
    IF OLD.status NOT IN ('placed', 'awaiting_cash', 'accepted') THEN
      RAISE EXCEPTION 'Orders in status "%" cannot be modified by customer', OLD.status;
    END IF;

    IF NEW.code IS DISTINCT FROM OLD.code
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.total_paise IS DISTINCT FROM OLD.total_paise
       OR NEW.cash_received_paise IS DISTINCT FROM OLD.cash_received_paise
       OR NEW.change_given_paise IS DISTINCT FROM OLD.change_given_paise
       OR NEW.slot_id IS DISTINCT FROM OLD.slot_id
       OR NEW.is_faculty IS DISTINCT FROM OLD.is_faculty
       OR NEW.qr_token IS DISTINCT FROM OLD.qr_token
       OR NEW.collected_at IS DISTINCT FROM OLD.collected_at
       OR NEW.rejected_reason IS DISTINCT FROM OLD.rejected_reason
       OR NEW.no_show IS DISTINCT FROM OLD.no_show THEN
      RAISE EXCEPTION 'Customers may only update ETA or note on active pre-kitchen orders';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_own_update ON public.orders;
CREATE TRIGGER trg_protect_order_own_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_order_own_update();

-- ─────────────────────────── 2. Accurate Priority Scoring (PRD Section 6) ────

CREATE OR REPLACE FUNCTION public.recompute_priority(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arrive_at      TIMESTAMPTZ;
  v_is_faculty     BOOL;
  v_placed_at      TIMESTAMPTZ;
  v_status         TEXT;
  v_faculty_boost  INT;
  v_prep_minutes   INT;
  v_start_by       TIMESTAMPTZ;
  v_waiting_min    NUMERIC;
  v_score          NUMERIC;
BEGIN
  SELECT o.arrive_at, o.is_faculty, o.created_at, o.status
    INTO v_arrive_at, v_is_faculty, v_placed_at, v_status
    FROM public.orders o
   WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Do NOT reorder orders already cooking, ready, collected, cancelled, or rejected
  IF v_status IN ('preparing', 'ready', 'collected', 'cancelled', 'rejected') THEN
    RETURN;
  END IF;

  SELECT CEIL(COALESCE(NULLIF(SUM(oi.qty * COALESCE(mi.prep_seconds, 300)), 0), 300)::NUMERIC / 60.0)::INT
    INTO v_prep_minutes
    FROM public.order_items oi
    LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
   WHERE oi.order_id = p_order_id;

  v_prep_minutes := GREATEST(1, COALESCE(v_prep_minutes, 5));

  SELECT (value->>'faculty_boost_minutes')::INT
    INTO v_faculty_boost
    FROM public.settings
   WHERE key = 'general'
   LIMIT 1;

  v_faculty_boost := COALESCE(v_faculty_boost, 5);

  v_start_by := COALESCE(v_arrive_at, NOW()) - (v_prep_minutes || ' minutes')::INTERVAL;
  v_score := (EXTRACT(EPOCH FROM v_start_by) / 60.0)
           - (CASE WHEN v_is_faculty THEN v_faculty_boost ELSE 0 END);

  -- Anti-starvation: orders waiting > 15 minutes in placed/accepted get -10 boost
  v_waiting_min := EXTRACT(EPOCH FROM (NOW() - v_placed_at)) / 60.0;
  IF v_waiting_min > 15 AND v_status IN ('placed', 'accepted') THEN
    v_score := v_score - 10;
  END IF;

  UPDATE public.orders
     SET priority_score = v_score
   WHERE id = p_order_id;
END;
$$;

-- ─────────────────────────── 3. Overdue No-Show Flagging RPC ─────────────────

CREATE OR REPLACE FUNCTION public.flag_overdue_noshows()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order         RECORD;
  v_total_qty     INT;
  v_flagged_count INT := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND COALESCE(public.get_my_role(), '') NOT IN ('shopkeeper', 'admin') THEN
    RAISE EXCEPTION 'Forbidden: staff or admin permissions required';
  END IF;

  FOR v_order IN
    SELECT o.id, o.code, o.user_id, o.slot_id, o.arrive_at
      FROM public.orders o
     WHERE o.status IN ('placed', 'accepted', 'preparing', 'ready')
       AND o.no_show = FALSE
       AND o.arrive_at IS NOT NULL
       AND o.arrive_at < NOW() - INTERVAL '20 minutes'
     FOR UPDATE OF o SKIP LOCKED
  LOOP
    UPDATE public.orders
       SET no_show = TRUE
     WHERE id = v_order.id;

    v_total_qty := 0;
    IF v_order.slot_id IS NOT NULL THEN
      SELECT COALESCE(SUM(oi.qty), 0)::INT
        INTO v_total_qty
        FROM public.order_items oi
       WHERE oi.order_id = v_order.id;

      IF v_total_qty > 0 THEN
        UPDATE public.pickup_slots
           SET used_units = GREATEST(0, used_units - v_total_qty)
         WHERE id = v_order.slot_id;
      END IF;
    END IF;

    -- Notify active canteen staff
    INSERT INTO public.notifications (user_id, title, body, kind)
    SELECT DISTINCT p.user_id,
           'No-Show Flagged: ' || v_order.code,
           'Order ' || v_order.code || ' exceeded 20 min past arrival ETA; slot capacity released.',
           'warning'
      FROM public.profiles p
      LEFT JOIN public.staff_accounts sa ON sa.user_id = p.user_id
     WHERE p.role = 'shopkeeper'
       AND p.is_blocked = FALSE
       AND (sa.counter IS NULL OR sa.counter = 'canteen')
       AND (sa.active IS NULL OR sa.active = TRUE);

    -- Immutable audit entry
    INSERT INTO public.audit_log (actor_id, action, table_name, row_id, diff)
    VALUES (
      auth.uid(),
      'order_noshow_flagged',
      'orders',
      v_order.id,
      jsonb_build_object(
        'code', v_order.code,
        'slot_id', v_order.slot_id,
        'freed_units', v_total_qty,
        'arrive_at', v_order.arrive_at
      )
    );

    v_flagged_count := v_flagged_count + 1;
  END LOOP;

  RETURN v_flagged_count;
END;
$$;

-- ─────────────────────────── 4. Helpful Indexes ──────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_status_priority
  ON public.orders (status, priority_score ASC NULLS LAST, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON public.orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_arrive_at
  ON public.orders (arrive_at)
  WHERE no_show = FALSE;

CREATE INDEX IF NOT EXISTS idx_pickup_slots_start
  ON public.pickup_slots (slot_start ASC);

CREATE INDEX IF NOT EXISTS idx_print_jobs_status_created
  ON public.print_jobs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created
  ON public.login_attempts (email, created_at DESC);

-- ─────────────────────────── 5. Tightened RLS Policies ───────────────────────

-- profiles: own update (role/is_blocked additionally locked by trigger)
DROP POLICY IF EXISTS "profiles: own update" ON public.profiles;
CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- staff_accounts: allow staff to update last_login_at on their own row safely
DROP POLICY IF EXISTS "staff_accounts: own update" ON public.staff_accounts;
CREATE POLICY "staff_accounts: own update"
  ON public.staff_accounts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- orders: require shopkeeper/admin for source = 'guest'
DROP POLICY IF EXISTS "orders: own insert" ON public.orders;
CREATE POLICY "orders: own insert"
  ON public.orders FOR INSERT
  WITH CHECK (
    (source = 'app' AND user_id = auth.uid())
    OR (source = 'guest' AND public.get_my_role() IN ('shopkeeper', 'admin'))
  );

-- orders: allow customers to update ETA/note pre-kitchen (protected by trigger)
DROP POLICY IF EXISTS "orders: own update" ON public.orders;
CREATE POLICY "orders: own update"
  ON public.orders FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- print_jobs: require shopkeeper/admin when inserting guest (user_id IS NULL) jobs
DROP POLICY IF EXISTS "print_jobs: own insert" ON public.print_jobs;
CREATE POLICY "print_jobs: own insert"
  ON public.print_jobs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND public.get_my_role() IN ('shopkeeper', 'admin'))
  );

-- menu_items: explicit WITH CHECK for shopkeeper/admin stock updates
DROP POLICY IF EXISTS "menu_items: shopkeeper update stock" ON public.menu_items;
CREATE POLICY "menu_items: shopkeeper update stock"
  ON public.menu_items FOR UPDATE
  USING (public.get_my_role() IN ('shopkeeper', 'admin'))
  WITH CHECK (public.get_my_role() IN ('shopkeeper', 'admin'));

-- ─────────────────────────── 6. Supabase Realtime Publication ──────────────

ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY[
      'orders',
      'menu_items',
      'pickup_slots',
      'print_jobs',
      'notifications',
      'sms_log'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1
          FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END LOOP;
  END IF;
END $$;

-- ─────────────────────────── 7. Supabase Storage Buckets & Policies ──────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'print-jobs',
  'print-jobs',
  FALSE,
  20971520, -- 20 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  TRUE,
  5242880, -- 5 MB
  NULL
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS for private 'print-jobs' bucket
DROP POLICY IF EXISTS "print-jobs: own upload" ON storage.objects;
CREATE POLICY "print-jobs: own upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'print-jobs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "print-jobs: owner and staff read" ON storage.objects;
CREATE POLICY "print-jobs: owner and staff read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'print-jobs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.get_my_role() IN ('shopkeeper', 'admin')
    )
  );

DROP POLICY IF EXISTS "print-jobs: owner and admin delete" ON storage.objects;
CREATE POLICY "print-jobs: owner and admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'print-jobs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.get_my_role() = 'admin'
    )
  );

-- Storage RLS for public 'menu-images' bucket
DROP POLICY IF EXISTS "menu-images: public read" ON storage.objects;
CREATE POLICY "menu-images: public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "menu-images: admin insert" ON storage.objects;
CREATE POLICY "menu-images: admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND public.get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "menu-images: admin update" ON storage.objects;
CREATE POLICY "menu-images: admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    bucket_id = 'menu-images'
    AND public.get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "menu-images: admin delete" ON storage.objects;
CREATE POLICY "menu-images: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND public.get_my_role() = 'admin'
  );

-- ============================================================================
-- PART 3: DEMO SEED DATA (seed.sql)
-- ============================================================================

-- ============================================================
-- MITE Canteen Pre-Order System — Rich Idempotent Seed Data
-- Safe to run multiple times without creating duplicates.
-- ============================================================

-- ─────────────────────────── 1. Categories ─────────────────

INSERT INTO public.categories (id, name, sort_order, icon) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Breakfast',  1, '☀️'),
  ('a1000000-0000-0000-0000-000000000002', 'Meals',      2, '🍱'),
  ('a1000000-0000-0000-0000-000000000003', 'Snacks',     3, '🥪'),
  ('a1000000-0000-0000-0000-000000000004', 'Beverages',  4, '☕'),
  ('a1000000-0000-0000-0000-000000000005', 'Desserts',   5, '🍮')
ON CONFLICT (id) DO UPDATE
SET name       = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    icon       = EXCLUDED.icon;

-- ─────────────────────────── 2. Menu Items (24) ────────────

INSERT INTO public.menu_items
  (id, category_id, name, description, price_paise, prep_seconds, in_stock, tags, is_active, load_weight)
VALUES
  -- Breakfast (5)
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'Masala Dosa', 'Crispy golden crepe stuffed with spiced potato masala, served with coconut chutney & sambar.',
   4000, 420, TRUE, ARRAY['veg','south-indian','popular','breakfast'], TRUE, 1.5),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'Idli Vada', 'Two fluffy steamed idlis paired with a crispy medu vada, sambar, and fresh chutney.',
   3000, 300, TRUE, ARRAY['veg','south-indian','combo','breakfast'], TRUE, 1.0),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001',
   'Poha', 'Light flattened rice tempered with mustard seeds, curry leaves, peanuts, and fresh lemon.',
   2500, 240, TRUE, ARRAY['veg','light','quick','breakfast'], TRUE, 0.8),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001',
   'Upma', 'Warm semolina cooked with roasted cashews, ginger, green chillies, and ghee.',
   2000, 240, TRUE, ARRAY['veg','light','comfort','breakfast'], TRUE, 0.8),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001',
   'Medu Vada', 'Two crunchy lentil doughnuts with soft centres, served hot with chutney & sambar.',
   2500, 300, TRUE, ARRAY['veg','crispy','south-indian'], TRUE, 1.0),

  -- Meals (4)
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002',
   'Veg Meals', 'Traditional coastal Karnataka lunch plate with rice, sambar, rasam, two sabzis, curd & papad.',
   7000, 600, TRUE, ARRAY['veg','lunch','filling','popular'], TRUE, 2.0),
  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002',
   'Special Thali', 'Festive platter featuring pulao, paneer curry, chapatis, dal fry, raita, and sweet.',
   9000, 720, FALSE, ARRAY['veg','special','lunch','back_at:13:00'], TRUE, 2.5),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002',
   'Chapati Sabzi', 'Three soft whole-wheat chapatis served with homestyle seasonal vegetable curry.',
   4500, 480, TRUE, ARRAY['veg','wheat','lunch'], TRUE, 1.5),
  ('b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002',
   'Dal Rice', 'Steamed rice topped with aromatic tempered yellow dal and pickle.',
   5000, 480, TRUE, ARRAY['veg','comfort','lunch'], TRUE, 1.2),

  -- Snacks (5)
  ('b1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000003',
   'Samosa', 'Flaky pastry triangle packed with spiced potatoes and green peas, served with tamarind chutney.',
   1500, 120, TRUE, ARRAY['veg','crispy','popular','snack'], TRUE, 0.5),
  ('b1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000003',
   'Bread Pakoda', 'Golden batter-fried bread sandwich filled with masala potato mash.',
   2000, 180, TRUE, ARRAY['veg','fried','snack'], TRUE, 0.8),
  ('b1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000003',
   'Veg Puff', 'Oven-baked flaky puff pastry stuffed with spiced mixed vegetables.',
   1800, 150, TRUE, ARRAY['veg','bakery','quick'], TRUE, 0.5),
  ('b1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000003',
   'Paneer Roll', 'Grilled kathi wrap loaded with smoky masala paneer cubes, onions, and mint chutney.',
   3500, 300, FALSE, ARRAY['veg','protein','wrap','back_at:16:00'], TRUE, 1.2),
  ('b1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000003',
   'Manchurian', 'Crispy vegetable balls tossed in tangy Indo-Chinese garlic-soy sauce.',
   4000, 360, TRUE, ARRAY['veg','spicy','popular','snack'], TRUE, 1.5),

  -- Beverages (5)
  ('b1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000004',
   'Filter Coffee', 'Authentic Udupi-style frothy decoction coffee brewed fresh in brass filters.',
   1500, 120, TRUE, ARRAY['hot','popular','caffeine'], TRUE, 0.5),
  ('b1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000004',
   'Tea', 'Steaming masala chai brewed with crushed cardamom, ginger, and Assam tea leaves.',
   1000,  90, TRUE, ARRAY['hot','classic','quick'], TRUE, 0.4),
  ('b1000000-0000-0000-0000-000000000017', 'a1000000-0000-0000-0000-000000000004',
   'Cold Coffee', 'Chilled creamy blended espresso topped with cocoa dust.',
   3000, 180, FALSE, ARRAY['cold','sweet','back_at:15:30'], TRUE, 0.8),
  ('b1000000-0000-0000-0000-000000000018', 'a1000000-0000-0000-0000-000000000004',
   'Lassi', 'Thick chilled sweet yoghurt lassi whisked with a hint of cardamom.',
   2500, 120, TRUE, ARRAY['cold','refreshing','dairy'], TRUE, 0.6),
  ('b1000000-0000-0000-0000-000000000019', 'a1000000-0000-0000-0000-000000000004',
   'Buttermilk', 'Spiced coastal neer-majjige with curry leaves, ginger, and roasted cumin.',
   1500,  90, TRUE, ARRAY['cold','light','digestive'], TRUE, 0.4),

  -- Desserts (5)
  ('b1000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000005',
   'Gulab Jamun', 'Two warm melt-in-mouth khoya dumplings soaked in rose-cardamom syrup.',
   2000, 120, TRUE, ARRAY['sweet','warm','popular'], TRUE, 0.5),
  ('b1000000-0000-0000-0000-000000000021', 'a1000000-0000-0000-0000-000000000005',
   'Halwa', 'Rich golden carrot & cashew halwa slow-cooked in pure ghee.',
   2500, 150, TRUE, ARRAY['sweet','warm','ghee'], TRUE, 0.6),
  ('b1000000-0000-0000-0000-000000000022', 'a1000000-0000-0000-0000-000000000005',
   'Ice Cream', 'Double scoop vanilla & chocolate ice cream cup.',
   3000,  60, TRUE, ARRAY['cold','sweet','quick'], TRUE, 0.4),
  ('b1000000-0000-0000-0000-000000000023', 'a1000000-0000-0000-0000-000000000005',
   'Payasam', 'Mangalorean-style vermicelli & jaggery payasam garnished with toasted cashews.',
   2000, 120, TRUE, ARRAY['sweet','traditional','warm'], TRUE, 0.5),
  ('b1000000-0000-0000-0000-000000000024', 'a1000000-0000-0000-0000-000000000005',
   'Kheer', 'Creamy slow-simmered rice kheer scented with saffron and pistachios.',
   2500, 120, TRUE, ARRAY['sweet','chilled','classic'], TRUE, 0.5)
ON CONFLICT (id) DO UPDATE
SET category_id  = EXCLUDED.category_id,
    name         = EXCLUDED.name,
    description  = EXCLUDED.description,
    price_paise  = EXCLUDED.price_paise,
    prep_seconds = EXCLUDED.prep_seconds,
    in_stock     = EXCLUDED.in_stock,
    tags         = EXCLUDED.tags,
    is_active    = EXCLUDED.is_active,
    load_weight  = EXCLUDED.load_weight;

-- ─────────────────────────── 3. Settings ───────────────────

INSERT INTO public.settings (key, value) VALUES
  ('general', '{
    "faculty_boost_minutes": 5,
    "slot_capacity": 20,
    "bw_rate_paise": 200,
    "color_rate_paise": 1000,
    "a3_multiplier": 2,
    "open_hours": {"start": "08:00", "end": "20:00"},
    "slot_minutes": 10,
    "rate_limit": {"requests_per_10s": 10, "otp_per_min": 3},
    "sms_template": "Your order {code} is confirmed. Collect by {slot}."
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────── 4. Pickup Slots (72 today) ────

DO $$
DECLARE
  v_ist_date   DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
  v_day_start  TIMESTAMPTZ := (v_ist_date::TIMESTAMP AT TIME ZONE 'Asia/Kolkata');
  v_day_end    TIMESTAMPTZ := v_day_start + INTERVAL '1 day';
  v_slot_start TIMESTAMPTZ;
  v_slot_end   TIMESTAMPTZ;
  v_used       INT;
  t            INT;
BEGIN
  -- Idempotency: only seed 72 slots if today (IST) has none yet
  IF NOT EXISTS (
    SELECT 1 FROM public.pickup_slots
     WHERE slot_start >= v_day_start AND slot_start < v_day_end
  ) THEN
    FOR t IN 0..71 LOOP
      v_slot_start := ((v_ist_date + TIME '08:00:00') AT TIME ZONE 'Asia/Kolkata') + (t * INTERVAL '10 minutes');
      v_slot_end   := v_slot_start + INTERVAL '10 minutes';

      -- Realistic peak-hour slot utilization for heatmap & load bars
      v_used := CASE t
        WHEN 6  THEN 4   -- 09:00 breakfast
        WHEN 7  THEN 6   -- 09:10
        WHEN 12 THEN 5   -- 10:00 break
        WHEN 18 THEN 7   -- 11:00 short break
        WHEN 27 THEN 9   -- 12:30 lunch starts
        WHEN 28 THEN 14  -- 12:40 lunch rush (amber)
        WHEN 29 THEN 17  -- 12:50 lunch peak (red >80%)
        WHEN 30 THEN 19  -- 13:00 lunch peak (red >80%)
        WHEN 31 THEN 12  -- 13:10 lunch (amber)
        WHEN 32 THEN 10  -- 13:20 lunch (amber)
        WHEN 48 THEN 11  -- 16:00 snacks break (amber)
        WHEN 49 THEN 16  -- 16:10 snacks rush (red/amber 80%)
        WHEN 50 THEN 8   -- 16:20
        ELSE 0
      END;

      INSERT INTO public.pickup_slots (slot_start, slot_end, capacity_units, used_units)
      VALUES (v_slot_start, v_slot_end, 20, v_used);
    END LOOP;
  END IF;
END $$;

-- ─────────────────────────── 5. Demo Users, Profiles, Staff, Orders, Print, Logs ──

DO $$
DECLARE
  v_ist_date DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
  v_day_start TIMESTAMPTZ := (v_ist_date::TIMESTAMP AT TIME ZONE 'Asia/Kolkata');

  -- Fixed fallback UUIDs (replaced by existing auth.users.id if user already exists)
  u_admin       UUID := 'c1000000-0000-0000-0000-000000000001';
  u_canteen     UUID := 'c1000000-0000-0000-0000-000000000002';
  u_print       UUID := 'c1000000-0000-0000-0000-000000000003';
  u_student1    UUID := 'c1000000-0000-0000-0000-000000000004';
  u_student2    UUID := 'c1000000-0000-0000-0000-000000000005';
  u_student3    UUID := 'c1000000-0000-0000-0000-000000000006';
  u_student4    UUID := 'c1000000-0000-0000-0000-000000000007';
  u_student5    UUID := 'c1000000-0000-0000-0000-000000000008';
  u_student6    UUID := 'c1000000-0000-0000-0000-000000000009';
  u_faculty1    UUID := 'c1000000-0000-0000-0000-000000000010';
  u_faculty2    UUID := 'c1000000-0000-0000-0000-000000000011';

  v_uid         UUID;
  v_slot_morn   UUID;
  v_slot_lunch1 UUID;
  v_slot_lunch2 UUID;
  v_slot_even   UUID;

  v_seed_users JSONB := '[
    {"slot":"admin",    "id":"c1000000-0000-0000-0000-000000000001","email":"admin@mite.ac.in",      "pw":"Admin@789",   "role":"admin",      "name":"MITE Admin",         "phone":"9845000001","dept":"Administration"},
    {"slot":"canteen",  "id":"c1000000-0000-0000-0000-000000000002","email":"canteen@mite.ac.in",    "pw":"Canteen@123", "role":"shopkeeper", "name":"Ramesh Shetty",      "phone":"9845000002","dept":"Canteen Operations"},
    {"slot":"print",    "id":"c1000000-0000-0000-0000-000000000003","email":"print@mite.ac.in",      "pw":"Print@456",   "role":"shopkeeper", "name":"Suresh Bhat",        "phone":"9845000003","dept":"Print Hub"},
    {"slot":"student1", "id":"c1000000-0000-0000-0000-000000000004","email":"4mt21cs001@mite.ac.in", "pw":null,          "role":"student",    "name":"Aarav Sharma",       "phone":"9845100001","dept":"Computer Science & Engg."},
    {"slot":"student2", "id":"c1000000-0000-0000-0000-000000000005","email":"4mt22ec042@mite.ac.in", "pw":null,          "role":"student",    "name":"Diya Nair",          "phone":"9845100002","dept":"Electronics & Comm. Engg."},
    {"slot":"student3", "id":"c1000000-0000-0000-0000-000000000006","email":"4mt21is018@mite.ac.in", "pw":null,          "role":"student",    "name":"Karthik Rao",        "phone":"9845100003","dept":"Information Science & Engg."},
    {"slot":"student4", "id":"c1000000-0000-0000-0000-000000000007","email":"4mt22me033@mite.ac.in", "pw":null,          "role":"student",    "name":"Sneha Kulkarni",     "phone":"9845100004","dept":"Mechanical Engineering"},
    {"slot":"student5", "id":"c1000000-0000-0000-0000-000000000008","email":"4mt23ai012@mite.ac.in", "pw":null,          "role":"student",    "name":"Rohan Kamath",       "phone":"9845100005","dept":"Artificial Intelligence & ML"},
    {"slot":"student6", "id":"c1000000-0000-0000-0000-000000000009","email":"4mt23cs055@mite.ac.in", "pw":null,          "role":"student",    "name":"Ananya Hegde",       "phone":"9845100006","dept":"Computer Science & Engg."},
    {"slot":"faculty1", "id":"c1000000-0000-0000-0000-000000000010","email":"john.doe@mite.ac.in",   "pw":null,          "role":"faculty",    "name":"Dr. John Doe",       "phone":"9845200001","dept":"Computer Science & Engg."},
    {"slot":"faculty2", "id":"c1000000-0000-0000-0000-000000000011","email":"priya.sharma@mite.ac.in","pw":null,         "role":"faculty",    "name":"Prof. Priya Sharma", "phone":"9845200002","dept":"Electronics & Comm. Engg."}
  ]'::jsonb;

  v_rec         JSONB;
  v_email       TEXT;
  v_pw          TEXT;
  v_encrypted   TEXT;
BEGIN
  -- Ensure pgcrypto (crypt/gen_salt) resolves whether installed in public or extensions
  PERFORM set_config('search_path', 'public, extensions', true);

  -- 5a. Upsert auth.users, auth.identities, and public.profiles
  FOR v_rec IN SELECT * FROM jsonb_array_elements(v_seed_users) LOOP
    v_email := LOWER(TRIM(v_rec->>'email'));
    v_pw    := NULLIF(v_rec->>'pw', '');

    SELECT id INTO v_uid FROM auth.users WHERE LOWER(email) = v_email LIMIT 1;

    IF v_uid IS NULL THEN
      v_uid := (v_rec->>'id')::UUID;
      v_encrypted := CASE
        WHEN v_pw IS NOT NULL THEN crypt(v_pw, gen_salt('bf'))
        ELSE ''
      END;

      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
      ) VALUES (
        v_uid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        v_email,
        v_encrypted,
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_rec->>'name'),
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM auth.identities
       WHERE user_id = v_uid AND provider = 'email'
    ) THEN
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_uid,
        jsonb_build_object(
          'sub', v_uid::text,
          'email', v_email,
          'email_verified', true,
          'phone_verified', false
        ),
        'email',
        v_uid::text,
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Ensure profile has exact seeded role, phone, phone_verified, department
    INSERT INTO public.profiles (user_id, full_name, role, phone, phone_verified, department)
    VALUES (
      v_uid,
      v_rec->>'name',
      v_rec->>'role',
      CASE
        WHEN EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.phone = v_rec->>'phone' AND p2.user_id <> v_uid)
        THEN NULL
        ELSE v_rec->>'phone'
      END,
      TRUE,
      v_rec->>'dept'
    )
    ON CONFLICT (user_id) DO UPDATE
    SET full_name      = EXCLUDED.full_name,
        role           = EXCLUDED.role,
        phone          = COALESCE(EXCLUDED.phone, public.profiles.phone),
        phone_verified = TRUE,
        department     = EXCLUDED.department;

    -- Track actual resolved UUIDs for foreign keys below
    CASE v_rec->>'slot'
      WHEN 'admin'    THEN u_admin    := v_uid;
      WHEN 'canteen'  THEN u_canteen  := v_uid;
      WHEN 'print'    THEN u_print    := v_uid;
      WHEN 'student1' THEN u_student1 := v_uid;
      WHEN 'student2' THEN u_student2 := v_uid;
      WHEN 'student3' THEN u_student3 := v_uid;
      WHEN 'student4' THEN u_student4 := v_uid;
      WHEN 'student5' THEN u_student5 := v_uid;
      WHEN 'student6' THEN u_student6 := v_uid;
      WHEN 'faculty1' THEN u_faculty1 := v_uid;
      WHEN 'faculty2' THEN u_faculty2 := v_uid;
    END CASE;
  END LOOP;

  -- 5b. Staff accounts for canteen & print shopkeepers
  IF NOT EXISTS (SELECT 1 FROM public.staff_accounts WHERE user_id = u_canteen) THEN
    INSERT INTO public.staff_accounts (user_id, display_name, counter, active, last_login_at)
    VALUES (u_canteen, 'Main Canteen Kitchen', 'canteen', TRUE, NOW() - INTERVAL '45 minutes');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.staff_accounts WHERE user_id = u_print) THEN
    INSERT INTO public.staff_accounts (user_id, display_name, counter, active, last_login_at)
    VALUES (u_print, 'Campus Print Desk', 'print', TRUE, NOW() - INTERVAL '30 minutes');
  END IF;

  -- Resolve slot IDs from today's pickup slots
  SELECT id INTO v_slot_morn   FROM public.pickup_slots WHERE slot_start >= v_day_start ORDER BY slot_start ASC OFFSET 6  LIMIT 1;
  SELECT id INTO v_slot_lunch1 FROM public.pickup_slots WHERE slot_start >= v_day_start ORDER BY slot_start ASC OFFSET 28 LIMIT 1;
  SELECT id INTO v_slot_lunch2 FROM public.pickup_slots WHERE slot_start >= v_day_start ORDER BY slot_start ASC OFFSET 30 LIMIT 1;
  SELECT id INTO v_slot_even   FROM public.pickup_slots WHERE slot_start >= v_day_start ORDER BY slot_start ASC OFFSET 48 LIMIT 1;

  IF v_slot_morn IS NULL THEN
    SELECT id INTO v_slot_morn FROM public.pickup_slots ORDER BY slot_start ASC LIMIT 1;
  END IF;
  v_slot_lunch1 := COALESCE(v_slot_lunch1, v_slot_morn);
  v_slot_lunch2 := COALESCE(v_slot_lunch2, v_slot_morn);
  v_slot_even   := COALESCE(v_slot_even,   v_slot_morn);

  -- 5c. 15 Historical & Active Orders (spanning collected, ready, preparing, accepted, placed, awaiting_cash, cancelled)
  -- Opaque qr_token values avoid x.y.z 3-part signature check so seeded demo orders scan cleanly!

  -- 1. A-1001: collected (student1)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000001' OR code = 'A-1001') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, slot_id, eta_minutes, arrive_at, priority_score, is_faculty, qr_token, collected_at, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000001', 'A-1001', u_student1, 'app', 'collected', 'online', 'paid', 9500, v_slot_morn, 10, NOW() - INTERVAL '3 hours', EXTRACT(EPOCH FROM (NOW() - INTERVAL '3 hours 10 minutes'))/60.0, FALSE, 'seed-qr-a1001', NOW() - INTERVAL '2 hours 52 minutes', NOW() - INTERVAL '3 hours 2 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Masala Dosa', 2, 4000, NOW() - INTERVAL '3 hours 2 minutes'),
      ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000015', 'Filter Coffee', 1, 1500, NOW() - INTERVAL '3 hours 2 minutes');
  END IF;

  -- 2. B-1002: collected (faculty1)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000002' OR code = 'B-1002') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, slot_id, eta_minutes, arrive_at, priority_score, is_faculty, qr_token, collected_at, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000002', 'B-1002', u_faculty1, 'app', 'collected', 'online', 'paid', 8500, v_slot_lunch1, 10, NOW() - INTERVAL '2 hours 20 minutes', EXTRACT(EPOCH FROM (NOW() - INTERVAL '2 hours 35 minutes'))/60.0, TRUE, 'seed-qr-b1002', NOW() - INTERVAL '2 hours 14 minutes', NOW() - INTERVAL '2 hours 24 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000006', 'Veg Meals', 1, 7000, NOW() - INTERVAL '2 hours 24 minutes'),
      ('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000019', 'Buttermilk', 1, 1500, NOW() - INTERVAL '2 hours 24 minutes');
  END IF;

  -- 3. C-1003: collected (student2, cash paid)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000003' OR code = 'C-1003') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, cash_received_paise, change_given_paise, slot_id, eta_minutes, arrive_at, priority_score, is_faculty, qr_token, collected_at, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000003', 'C-1003', u_student2, 'app', 'collected', 'cash', 'paid', 7000, 10000, 3000, v_slot_morn, 15, NOW() - INTERVAL '2 hours', EXTRACT(EPOCH FROM (NOW() - INTERVAL '2 hours 10 minutes'))/60.0, FALSE, 'seed-qr-c1003', NOW() - INTERVAL '1 hour 52 minutes', NOW() - INTERVAL '2 hours 3 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000010', 'Samosa', 2, 1500, NOW() - INTERVAL '2 hours 3 minutes'),
      ('d1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000014', 'Manchurian', 1, 4000, NOW() - INTERVAL '2 hours 3 minutes');
  END IF;

  -- 4. D-1004: collected (student3)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000004' OR code = 'D-1004') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, slot_id, eta_minutes, arrive_at, priority_score, is_faculty, qr_token, collected_at, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000004', 'D-1004', u_student3, 'app', 'collected', 'online', 'paid', 7000, v_slot_lunch1, 10, NOW() - INTERVAL '1 hour 30 minutes', EXTRACT(EPOCH FROM (NOW() - INTERVAL '1 hour 40 minutes'))/60.0, FALSE, 'seed-qr-d1004', NOW() - INTERVAL '1 hour 21 minutes', NOW() - INTERVAL '1 hour 32 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000009', 'Dal Rice', 1, 5000, NOW() - INTERVAL '1 hour 32 minutes'),
      ('d1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000020', 'Gulab Jamun', 1, 2000, NOW() - INTERVAL '1 hour 32 minutes');
  END IF;

  -- 5. E-1005: collected (faculty2)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000005' OR code = 'E-1005') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, slot_id, eta_minutes, arrive_at, priority_score, is_faculty, qr_token, collected_at, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000005', 'E-1005', u_faculty2, 'app', 'collected', 'online', 'paid', 6000, v_slot_morn, 5, NOW() - INTERVAL '55 minutes', EXTRACT(EPOCH FROM (NOW() - INTERVAL '1 hour 10 minutes'))/60.0, TRUE, 'seed-qr-e1005', NOW() - INTERVAL '49 minutes', NOW() - INTERVAL '58 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000002', 'Idli Vada', 1, 3000, NOW() - INTERVAL '58 minutes'),
      ('d1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000015', 'Filter Coffee', 2, 1500, NOW() - INTERVAL '58 minutes');
  END IF;

  -- 6. F-1006: ready (student1)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000006' OR code = 'F-1006') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, slot_id, eta_minutes, arrive_at, priority_score, is_faculty, qr_token, note, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000006', 'F-1006', u_student1, 'app', 'ready', 'online', 'paid', 7000, v_slot_lunch2, 10, NOW() + INTERVAL '2 minutes', EXTRACT(EPOCH FROM (NOW() - INTERVAL '8 minutes'))/60.0, FALSE, 'seed-qr-f1006', 'Less spicy sabzi please', NOW() - INTERVAL '12 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000008', 'Chapati Sabzi', 1, 4500, NOW() - INTERVAL '12 minutes'),
      ('d1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000018', 'Lassi', 1, 2500, NOW() - INTERVAL '12 minutes');
  END IF;

  -- 7. G-1007: ready (student4)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000007' OR code = 'G-1007') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, slot_id, eta_minutes, arrive_at, priority_score, is_faculty, qr_token, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000007', 'G-1007', u_student4, 'app', 'ready', 'online', 'paid', 7000, v_slot_lunch2, 10, NOW() + INTERVAL '4 minutes', EXTRACT(EPOCH FROM (NOW() - INTERVAL '7 minutes'))/60.0, FALSE, 'seed-qr-g1007', NOW() - INTERVAL '10 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000003', 'Poha', 2, 2500, NOW() - INTERVAL '10 minutes'),
      ('d1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000016', 'Tea', 2, 1000, NOW() - INTERVAL '10 minutes');
  END IF;

  -- 8. H-1008: preparing (faculty1)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000008' OR code = 'H-1008') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, slot_id, eta_minutes, arrive_at, priority_score, is_faculty, qr_token, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000008', 'H-1008', u_faculty1, 'app', 'preparing', 'online', 'paid', 9000, v_slot_lunch2, 10, NOW() + INTERVAL '6 minutes', EXTRACT(EPOCH FROM (NOW() - INTERVAL '11 minutes'))/60.0, TRUE, 'seed-qr-h1008', NOW() - INTERVAL '8 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000006', 'Veg Meals', 1, 7000, NOW() - INTERVAL '8 minutes'),
      ('d1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000023', 'Payasam', 1, 2000, NOW() - INTERVAL '8 minutes');
  END IF;

  -- 9. J-1009: preparing (student5)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000009' OR code = 'J-1009') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, slot_id, eta_minutes, arrive_at, priority_score, is_faculty, qr_token, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000009', 'J-1009', u_student5, 'app', 'preparing', 'online', 'paid', 7500, v_slot_lunch2, 12, NOW() + INTERVAL '8 minutes', EXTRACT(EPOCH FROM (NOW() - INTERVAL '6 minutes'))/60.0, FALSE, 'seed-qr-j1009', NOW() - INTERVAL '7 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000001', 'Masala Dosa', 1, 4000, NOW() - INTERVAL '7 minutes'),
      ('d1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000005', 'Medu Vada', 1, 2500, NOW() - INTERVAL '7 minutes'),
      ('d1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000016', 'Tea', 1, 1000, NOW() - INTERVAL '7 minutes');
  END IF;

  -- 10. K-1010: accepted (student6, waiting >15m -> anti-starvation boost!)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000010' OR code = 'K-1010') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, slot_id, eta_minutes, arrive_at, is_faculty, qr_token, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000010', 'K-1010', u_student6, 'app', 'accepted', 'online', 'paid', 7000, v_slot_even, 10, NOW() + INTERVAL '5 minutes', FALSE, 'seed-qr-k1010', NOW() - INTERVAL '18 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000014', 'Manchurian', 1, 4000, NOW() - INTERVAL '18 minutes'),
      ('d1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000022', 'Ice Cream', 1, 3000, NOW() - INTERVAL '18 minutes');
    PERFORM public.recompute_priority('d1000000-0000-0000-0000-000000000010');
  END IF;

  -- 11. L-1011: accepted (faculty2)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000011' OR code = 'L-1011') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, slot_id, eta_minutes, arrive_at, is_faculty, qr_token, note, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000011', 'L-1011', u_faculty2, 'app', 'accepted', 'online', 'paid', 4500, v_slot_even, 10, NOW() + INTERVAL '10 minutes', TRUE, 'seed-qr-l1011', 'Extra sambar', NOW() - INTERVAL '5 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000002', 'Idli Vada', 1, 3000, NOW() - INTERVAL '5 minutes'),
      ('d1000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000015', 'Filter Coffee', 1, 1500, NOW() - INTERVAL '5 minutes');
    PERFORM public.recompute_priority('d1000000-0000-0000-0000-000000000011');
  END IF;

  -- 12. M-1012: placed (student2)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000012' OR code = 'M-1012') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, slot_id, eta_minutes, arrive_at, is_faculty, qr_token, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000012', 'M-1012', u_student2, 'app', 'placed', 'online', 'paid', 5500, v_slot_even, 15, NOW() + INTERVAL '14 minutes', FALSE, 'seed-qr-m1012', NOW() - INTERVAL '3 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000004', 'Upma', 2, 2000, NOW() - INTERVAL '3 minutes'),
      ('d1000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000015', 'Filter Coffee', 1, 1500, NOW() - INTERVAL '3 minutes');
    PERFORM public.recompute_priority('d1000000-0000-0000-0000-000000000012');
  END IF;

  -- 13. N-1013: placed (1 walk-in guest order)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000013' OR code = 'N-1013') THEN
    INSERT INTO public.orders (id, code, user_id, guest_name, guest_token, source, status, payment_method, payment_status, total_paise, cash_received_paise, change_given_paise, slot_id, eta_minutes, arrive_at, is_faculty, qr_token, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000013', 'N-1013', NULL, 'Walk-in Guest (Campus)', 'guest-token-n1013', 'guest', 'placed', 'cash', 'paid', 5500, 10000, 4500, NULL, 5, NOW() + INTERVAL '5 minutes', FALSE, 'seed-qr-n1013', NOW() - INTERVAL '2 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000013', 'b1000000-0000-0000-0000-000000000010', 'Samosa', 2, 1500, NOW() - INTERVAL '2 minutes'),
      ('d1000000-0000-0000-0000-000000000013', 'b1000000-0000-0000-0000-000000000005', 'Medu Vada', 1, 2500, NOW() - INTERVAL '2 minutes');
    PERFORM public.recompute_priority('d1000000-0000-0000-0000-000000000013');
  END IF;

  -- 14. P-1014: awaiting_cash (student3)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000014' OR code = 'P-1014') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, slot_id, eta_minutes, arrive_at, is_faculty, qr_token, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000014', 'P-1014', u_student3, 'app', 'awaiting_cash', 'cash', 'pending', 9500, v_slot_even, 10, NOW() + INTERVAL '10 minutes', FALSE, 'seed-qr-p1014', NOW() - INTERVAL '4 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000006', 'Veg Meals', 1, 7000, NOW() - INTERVAL '4 minutes'),
      ('d1000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000021', 'Halwa', 1, 2500, NOW() - INTERVAL '4 minutes');
    PERFORM public.recompute_priority('d1000000-0000-0000-0000-000000000014');
  END IF;

  -- 15. R-1015: cancelled (student4)
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'd1000000-0000-0000-0000-000000000015' OR code = 'R-1015') THEN
    INSERT INTO public.orders (id, code, user_id, source, status, payment_method, payment_status, total_paise, slot_id, eta_minutes, arrive_at, priority_score, is_faculty, qr_token, note, created_at)
    VALUES ('d1000000-0000-0000-0000-000000000015', 'R-1015', u_student4, 'app', 'cancelled', 'online', 'refunded', 6500, v_slot_morn, 15, NOW() - INTERVAL '1 hour', EXTRACT(EPOCH FROM (NOW() - INTERVAL '1 hour 10 minutes'))/60.0, FALSE, 'seed-qr-r1015', 'Class rescheduled', NOW() - INTERVAL '1 hour 15 minutes');
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, qty, unit_price_paise, created_at) VALUES
      ('d1000000-0000-0000-0000-000000000015', 'b1000000-0000-0000-0000-000000000001', 'Masala Dosa', 1, 4000, NOW() - INTERVAL '1 hour 15 minutes'),
      ('d1000000-0000-0000-0000-000000000015', 'b1000000-0000-0000-0000-000000000024', 'Kheer', 1, 2500, NOW() - INTERVAL '1 hour 15 minutes');
  END IF;

  -- 5d. 5 Print Jobs (across paid, printing, ready, collected)
  INSERT INTO public.print_jobs
    (id, user_id, guest_name, file_path, original_name, pages, color, double_sided, copies, paper, cost_paise, status, payment_method, payment_status, qr_token, sanitised, created_at)
  VALUES
    ('e1000100-0000-0000-0000-000000000001', u_student1, 'Aarav Sharma', u_student1::text || '/ds-module3-notes.pdf',
     'DS_Module3_Notes.pdf', 18, FALSE, TRUE, 1, 'A4', 1800, 'paid', 'online', 'paid', 'seed-print-qr-001', TRUE, NOW() - INTERVAL '12 minutes'),
    ('e1000200-0000-0000-0000-000000000002', u_student2, 'Diya Nair', u_student2::text || '/dbms-lab-manual.pdf',
     'DBMS_Lab_Manual.pdf', 24, FALSE, TRUE, 2, 'A4', 4800, 'printing', 'online', 'paid', 'seed-print-qr-002', TRUE, NOW() - INTERVAL '18 minutes'),
    ('e1000300-0000-0000-0000-000000000003', u_faculty1, 'Dr. John Doe', u_faculty1::text || '/ieee-workshop-poster.pdf',
     'IEEE_Workshop_Poster.pdf', 2, TRUE, FALSE, 3, 'A3', 12000, 'ready', 'online', 'paid', 'seed-print-qr-003', TRUE, NOW() - INTERVAL '35 minutes'),
    ('e1000400-0000-0000-0000-000000000004', u_student3, 'Karthik Rao', u_student3::text || '/miniproject-report.pdf',
     'MiniProject_Report_Draft.pdf', 31, TRUE, FALSE, 1, 'A4', 31000, 'paid', 'online', 'paid', 'seed-print-qr-004', TRUE, NOW() - INTERVAL '6 minutes'),
    ('e1000500-0000-0000-0000-000000000005', u_student5, 'Rohan Kamath', u_student5::text || '/os-question-bank.pdf',
     'OS_Question_Bank.pdf', 10, FALSE, FALSE, 1, 'A4', 2000, 'collected', 'online', 'paid', 'seed-print-qr-005', TRUE, NOW() - INTERVAL '2 hours')
  ON CONFLICT (id) DO NOTHING;

  -- 5e. Notifications
  INSERT INTO public.notifications (id, user_id, title, body, kind, read, created_at) VALUES
    ('f1000000-0000-0000-0000-000000000001', u_student1, 'Order F-1006 is Ready!', 'Your order F-1006 is ready! 🎉 Please show your QR at the counter.', 'success', FALSE, NOW() - INTERVAL '3 minutes'),
    ('f1000000-0000-0000-0000-000000000002', u_student1, 'Print Job P-E10001 Submitted', '"DS_Module3_Notes.pdf" (₹18) sent to the print counter.', 'info', TRUE, NOW() - INTERVAL '12 minutes'),
    ('f1000000-0000-0000-0000-000000000003', u_student4, 'Order G-1007 is Ready!', 'Your order G-1007 is ready! Collect at MITE Canteen counter.', 'success', FALSE, NOW() - INTERVAL '2 minutes'),
    ('f1000000-0000-0000-0000-000000000004', u_faculty1, 'Print Job P-E10003 Ready!', '"IEEE_Workshop_Poster.pdf" is printed and ready for pickup.', 'success', FALSE, NOW() - INTERVAL '15 minutes'),
    ('f1000000-0000-0000-0000-000000000005', u_student6, 'Order K-1010 Accepted', 'The kitchen has accepted your order K-1010.', 'info', FALSE, NOW() - INTERVAL '14 minutes')
  ON CONFLICT (id) DO NOTHING;

  -- 5f. SMS Log
  INSERT INTO public.sms_log (id, phone, body, kind, created_at) VALUES
    ('f2000000-0000-0000-0000-000000000001', '9845100001', 'Your order F-1006 is ready! 🎉 Collect at MITE Canteen counter.', 'order_ready', NOW() - INTERVAL '3 minutes'),
    ('f2000000-0000-0000-0000-000000000002', '9845100004', 'Your order G-1007 is ready! 🎉 Collect at MITE Canteen counter.', 'order_ready', NOW() - INTERVAL '2 minutes'),
    ('f2000000-0000-0000-0000-000000000003', '9845200001', 'Your print job P-E10003 (IEEE_Workshop_Poster.pdf) is ready! Collect at MITE Print Counter.', 'print_ready', NOW() - INTERVAL '15 minutes'),
    ('f2000000-0000-0000-0000-000000000004', '9845100002', 'Your order M-1012 is confirmed. Collect at your scheduled slot.', 'order_confirmed', NOW() - INTERVAL '3 minutes'),
    ('f2000000-0000-0000-0000-000000000005', '9845100001', 'Your verification code: 482910. Valid for 10 minutes.', 'phone_otp', NOW() - INTERVAL '4 hours')
  ON CONFLICT (id) DO NOTHING;

  -- 5g. Audit Log
  INSERT INTO public.audit_log (id, actor_id, action, table_name, row_id, diff, created_at) VALUES
    ('f3000000-0000-0000-0000-000000000001', u_canteen, 'order_collected_qr', 'orders', 'd1000000-0000-0000-0000-000000000001', '{"code":"A-1001"}'::jsonb, NOW() - INTERVAL '2 hours 52 minutes'),
    ('f3000000-0000-0000-0000-000000000002', u_canteen, 'order_cash_collected', 'orders', 'd1000000-0000-0000-0000-000000000003', '{"code":"C-1003","total_paise":7000,"cash_received_paise":10000,"change_given_paise":3000}'::jsonb, NOW() - INTERVAL '1 hour 55 minutes'),
    ('f3000000-0000-0000-0000-000000000003', u_canteen, 'stock_update', 'menu_items', 'b1000000-0000-0000-0000-000000000007', '{"name":"Special Thali","in_stock_from":true,"in_stock_to":false,"back_at":"13:00"}'::jsonb, NOW() - INTERVAL '1 hour'),
    ('f3000000-0000-0000-0000-000000000004', u_print, 'print_job_ready', 'print_jobs', 'e1000300-0000-0000-0000-000000000003', '{"from":"printing","to":"ready"}'::jsonb, NOW() - INTERVAL '15 minutes'),
    ('f3000000-0000-0000-0000-000000000005', u_canteen, 'order_ready', 'orders', 'd1000000-0000-0000-0000-000000000006', '{"code":"F-1006","from":"preparing","to":"ready"}'::jsonb, NOW() - INTERVAL '3 minutes'),
    ('f3000000-0000-0000-0000-000000000006', u_admin, 'admin_update', 'settings', NULL, '{"key":"general","note":"Initial verified config"}'::jsonb, NOW() - INTERVAL '4 hours')
  ON CONFLICT (id) DO NOTHING;

END $$;
