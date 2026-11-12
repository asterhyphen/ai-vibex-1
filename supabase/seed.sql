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
