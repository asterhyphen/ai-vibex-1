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
