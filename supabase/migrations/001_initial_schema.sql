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
      CREATE TRIGGER trg_%I_updated_at
      BEFORE UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', tbl, tbl);
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
CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "profiles: staff/admin read all"
  ON public.profiles FOR SELECT
  USING (get_my_role() IN ('shopkeeper','admin'));

CREATE POLICY "profiles: admin full"
  ON public.profiles FOR ALL
  USING (get_my_role() = 'admin');

-- ── categories policies ────────────────────────────────────
CREATE POLICY "categories: authenticated read"
  ON public.categories FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "categories: shopkeeper update"
  ON public.categories FOR UPDATE
  USING (get_my_role() IN ('shopkeeper','admin'));

CREATE POLICY "categories: admin full"
  ON public.categories FOR ALL
  USING (get_my_role() = 'admin');

-- ── menu_items policies ────────────────────────────────────
CREATE POLICY "menu_items: authenticated read"
  ON public.menu_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "menu_items: shopkeeper update stock"
  ON public.menu_items FOR UPDATE
  USING (get_my_role() IN ('shopkeeper','admin'));

CREATE POLICY "menu_items: admin full"
  ON public.menu_items FOR ALL
  USING (get_my_role() = 'admin');

-- ── pickup_slots policies ──────────────────────────────────
CREATE POLICY "pickup_slots: authenticated read"
  ON public.pickup_slots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "pickup_slots: shopkeeper/admin update"
  ON public.pickup_slots FOR UPDATE
  USING (get_my_role() IN ('shopkeeper','admin'));

CREATE POLICY "pickup_slots: admin full"
  ON public.pickup_slots FOR ALL
  USING (get_my_role() = 'admin');

-- ── orders policies ────────────────────────────────────────
CREATE POLICY "orders: own read"
  ON public.orders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "orders: own insert"
  ON public.orders FOR INSERT
  WITH CHECK (user_id = auth.uid() OR source = 'guest');

CREATE POLICY "orders: shopkeeper/admin read all"
  ON public.orders FOR SELECT
  USING (get_my_role() IN ('shopkeeper','admin'));

CREATE POLICY "orders: shopkeeper/admin update"
  ON public.orders FOR UPDATE
  USING (get_my_role() IN ('shopkeeper','admin'));

-- ── order_items policies ───────────────────────────────────
CREATE POLICY "order_items: own read"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
  );

CREATE POLICY "order_items: own insert"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
  );

CREATE POLICY "order_items: shopkeeper/admin all"
  ON public.order_items FOR ALL
  USING (get_my_role() IN ('shopkeeper','admin'));

-- ── print_jobs policies ────────────────────────────────────
CREATE POLICY "print_jobs: own read"
  ON public.print_jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "print_jobs: own insert"
  ON public.print_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "print_jobs: shopkeeper/admin all"
  ON public.print_jobs FOR ALL
  USING (get_my_role() IN ('shopkeeper','admin'));

-- ── notifications policies ─────────────────────────────────
CREATE POLICY "notifications: own read"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications: own update"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "notifications: system insert"
  ON public.notifications FOR INSERT
  WITH CHECK (TRUE);

-- ── sms_log policies ───────────────────────────────────────
CREATE POLICY "sms_log: admin read"
  ON public.sms_log FOR SELECT
  USING (get_my_role() = 'admin');

CREATE POLICY "sms_log: system insert"
  ON public.sms_log FOR INSERT
  WITH CHECK (TRUE);

-- ── settings policies ──────────────────────────────────────
CREATE POLICY "settings: authenticated read"
  ON public.settings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "settings: admin write"
  ON public.settings FOR ALL
  USING (get_my_role() = 'admin');

-- ── audit_log policies ─────────────────────────────────────
CREATE POLICY "audit_log: admin read"
  ON public.audit_log FOR SELECT
  USING (get_my_role() = 'admin');

CREATE POLICY "audit_log: system insert"
  ON public.audit_log FOR INSERT
  WITH CHECK (TRUE);

-- ── login_attempts policies ────────────────────────────────
CREATE POLICY "login_attempts: public all"
  ON public.login_attempts FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- ── staff_accounts policies ────────────────────────────────
CREATE POLICY "staff_accounts: own read"
  ON public.staff_accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "staff_accounts: admin full"
  ON public.staff_accounts FOR ALL
  USING (get_my_role() = 'admin');
