# SkipQ Pre-Order System — Project Map

## Project Overview

A hackathon-grade canteen and print pre-order system for **MITE (Mangalore Institute of Technology & Engineering)**. Students and faculty can browse the menu, order in plain words or via menu cards, pre-order food with a chosen 10-minute pickup slot, pay online (simulated) or with cash, and submit sanitized PDF print jobs — all from a mobile-first web app. Kitchen & print staff get a real-time Kanban board and QR scanner; admins get analytics, reusable CRUD data grids, and system controls.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router (`next@16.4.6`, React 19, TypeScript `strict: true`) |
| Styling | Tailwind CSS v4 + CSS custom properties (WCAG AA Ivory & Burgundy / Burgundy Night) |
| Typography | `Fraunces` (display headings), `Inter` (UI/body), `JetBrains Mono` (codes, OTPs, tabular prices) |
| Database | Supabase (PostgreSQL + RLS + Realtime + Private Storage `print-jobs` & `menu-images`) |
| Auth | Supabase Auth (`@mite.ac.in` demo OTP `1234` for students/faculty; email + password for staff/admin) |
| State | Zustand (`lib/stores/cart.ts`, `lib/stores/session.ts`) |
| Validation | Zod (`lib/validators/*`) |
| Animation & 3D | Framer Motion + Three.js / React Three Fiber / `@react-three/drei` (lazy-loaded hero) |
| PDF | `pdf-lib` (active content stripping, sanitization & page counting) |
| QR | `qrcode` (HMAC-SHA256 signed order & print job collection QRs) |
| Toast & Alerts | `sonner` + `RealtimeAlertsProvider` + in-app `SmsPopup` & `NotificationBell` |
| Theme | `next-themes` (Light Ivory & Burgundy / Dark Burgundy Night with circular reveal toggle) |
| Tables & Search | `@tanstack/react-table` + `fuse.js` |

## Build Phases

| Phase | Owner | Status |
|---|---|---|
| Phase 1 — Scaffold & Schema | scaffold agent | ✅ Complete |
| Phase 2 — Auth flows, middleware, security & profile | auth agent | ✅ Complete |
| Phase 3 — Student menu + NLP parser + cart + checkout + QR tracking + history | menu agent | ✅ Complete |
| Phase 4 — Staff kitchen board, cash modal, QR scanner, guest POS, stock control | staff agent | ✅ Complete |
| Phase 5 — Print job upload, PDF sanitization, cost estimator & print queue | staff agent | ✅ Complete |
| Phase 6 — Admin dashboard, reusable DataGrid, CRUD APIs & danger zone | staff agent | ✅ Complete |
| Phase 7 — 3D hero, landing page, shared UI primitives, alerts system & docs | ui agent | ✅ Complete |
| Phase 8 — Supabase SQL enhancements, storage buckets, realtime pub & full seed | supabase agent | ✅ Complete |

## File Ownership

```
app/
  (public)/
    page.tsx              ← ui agent (landing page + 3D HeroScene)
    login/                ← auth agent
    onboarding/           ← auth agent
  (student)/
    home/                 ← menu agent
    checkout/             ← menu agent
    orders/[code]/        ← menu agent
    history/              ← menu agent
    print/                ← staff agent (student print upload + [id] tracker)
    profile/              ← auth agent
  staff/
    page.tsx              ← staff agent (kitchen Kanban board)
    login/                ← auth agent
    stock/                ← staff agent
    print/                ← staff agent
  admin/
    page.tsx              ← staff agent (redirects / admin dashboard entry)
    dashboard/            ← staff agent
    login/                ← auth agent
    orders/               ← staff agent
    print-jobs/           ← staff agent
    menu/                 ← staff agent
    categories/           ← staff agent
    slots/                ← staff agent
    users/                ← staff agent
    shopkeepers/          ← staff agent
    settings/             ← staff agent
    sms-log/              ← staff agent
    audit/                ← staff agent
    database/             ← staff agent
  api/
    auth/                 ← auth agent (request, verify, signout)
    orders/               ← menu agent (create, [code]/eta)
    print/                ← staff agent (upload, jobs)
    staff/                ← staff agent (board, orders, print, stock)
    admin/                ← staff agent ([table], dashboard, danger, menu, shopkeepers, slots)
  403/                    ← auth agent
  not-found.tsx           ← ui agent
  layout.tsx              ← ui agent (fonts, ThemeProvider, RealtimeAlertsProvider)
  globals.css             ← ui agent (brand tokens, typography, WCAG AA contrast)

components/
  ui/                     ← ui agent (BrandQMark, Preloader, Button, Card, Badge, LoadingBar, ThemeToggle, NotificationBell, SmsPopup, RealtimeAlertsProvider)
  auth/                   ← auth agent (OtpInput, PortalLoginForm, SmsPopup, ThemeToggle)
  menu/                   ← menu agent (MenuCard, CategoryChips, ItemSheet, PlainLanguageModal, TopBar)
  cart/                   ← menu agent (CartBar)
  staff/                  ← staff agent (OrderCard, CashModal, QrScannerModal, GuestPosModal, RejectModal, SlotHeatmap, StaffHeader)
  admin/                  ← staff agent (AdminShell, DataGrid, OrdersPerHourChart)
  print/                  ← staff agent (AnimatedPrice, QrCodeCard)
  3d/                     ← ui agent (HeroScene, HeroCanvas, FloatingObject, HeroFallback)

lib/
  supabase/               ← scaffold + auth (client, server, middleware, config)
  auth/                   ← auth agent (portal-login)
  rate-limit.ts           ← auth agent
  types.ts                ← scaffold (DB interfaces)
  stores/                 ← menu agent (cart, session)
  validators/             ← feature agents (auth, order, print, staff, admin)
  admin/                  ← staff agent (crud)
  utils/                  ← shared (format, motion, nlp, qr, server-auth)

supabase/
  final_setup.sql         ← supabase agent (consolidated idempotent schema, triggers, RLS, Realtime, Storage, seed)
  README.md               ← supabase agent (SQL Editor instructions)

middleware.ts             ← auth agent (role-based gates, rate limit, security headers)
```

## Supabase Schema Summary

| Table | Purpose |
|---|---|
| `profiles` | User profiles — role, phone, phone_verified, department, is_blocked |
| `staff_accounts` | Canteen / print counter staff metadata & last login |
| `login_attempts` | Staff/admin lockout tracking |
| `categories` | Menu categories |
| `menu_items` | Food items with price in paise, prep time, tags (`back_at:*`), stock status |
| `pickup_slots` | 10-minute pickup windows (08:00–20:00) |
| `orders` | Pre-orders with status FSM, priority score, HMAC QR token |
| `order_items` | Line items (snapshot of name + price) |
| `print_jobs` | Print job submissions (PDF page count, options, sanitized flag) |
| `notifications` | In-app realtime push notifications |
| `sms_log` | Outbound fake SMS audit trail |
| `settings` | Key/value config (JSONB) |
| `audit_log` | Immutable action & rate-limit block log |

### Key Design Decisions

- **Prices in paise** (integer) — avoids floating-point rounding
- **Role derived on signup** — `4MT*` local part → `student`, else `faculty` (protected by DB trigger)
- **Priority score** — numeric, lower = higher priority; subtracts prep time and faculty boost (`-5 min`); anti-starvation at `15 min`
- **Order code** — `LETTER-DDDD` format, unique, human-readable
- **QR token** — HMAC-SHA256 signed (`orderId:orderCode`), single-use, verified on scan with 6-digit `deriveOrderOtp` fallback
- **Source field** — supports both authenticated app orders (`app`) and staff walk-in POS orders (`guest`)

## Demo Accounts

| Role | Email | Password / Method |
|---|---|---|
| Student | `4mt21cs001@mite.ac.in` | Email OTP (`1234`) |
| Student | `4mt22ec042@mite.ac.in` | Email OTP (`1234`) |
| Faculty | `john.doe@mite.ac.in` | Email OTP (`1234`) |
| Faculty | `priya.sharma@mite.ac.in` | Email OTP (`1234`) |
| Canteen Staff | `canteen@mite.ac.in` | `Canteen@123` |
| Print Staff | `print@mite.ac.in` | `Print@456` |
| Admin | `admin@mite.ac.in` | `Admin@789` |

> Seeded directly in `supabase/final_setup.sql`.

## Assumptions

1. Students and faculty authenticate via `@mite.ac.in` using the 4-digit demo OTP `1234` (backed by a Supabase session); staff and admin accounts use email + password with 5-attempt lockout.
2. `@mite.ac.in` domain enforcement runs on client, `/api/auth/request`, and PostgreSQL `auth.users` triggers (rejecting lookalikes and multiple `@`).
3. Payments (`online` UPI/Card/Wallet or `cash`) are demo-grade; `online` simulates a 2-second gateway confirmation, while `cash` requires staff cash collection before acceptance.
4. SMS notifications are displayed in-app (`SmsPopup`) and logged to `sms_log` for audit.
5. File uploads for print jobs are sanitized via `pdf-lib` and stored in the private Supabase Storage bucket `print-jobs`.
6. Pickup slots are seeded for `CURRENT_DATE` (`08:00`–`20:00`); admins can regenerate slots or reset demo data from Admin Settings / Danger Zone.
7. Real-time 3D rendering on the landing page (`components/3d/`) is lazy-loaded, capped at `dpr={[1, 2]}`, and skipped when `prefers-reduced-motion` is enabled or on low-power devices.
