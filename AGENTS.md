# MITE Canteen Pre-Order System — Project Map

## Project Overview

A hackathon-grade canteen and print pre-order system for MITE (Mangalore Institute of Technology & Engineering). Students and faculty can browse the menu, pre-order food with a chosen pickup slot, and submit print jobs — all from a mobile-first web app. Kitchen staff get a real-time board; admins get analytics and control.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router (TypeScript) |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Database | Supabase (PostgreSQL + RLS + Realtime) |
| Auth | Supabase Auth (magic link / OTP, @mite.ac.in domain) |
| State | Zustand (cart, session) |
| Validation | Zod |
| Animation | Framer Motion + Three.js / React Three Fiber |
| PDF | pdf-lib (page counting & cost estimation) |
| QR | qrcode (order & print job collection QRs) |
| Toast | Sonner |
| Theme | next-themes (light Ivory & Burgundy / dark Burgundy Night) |
| Tables | @tanstack/react-table |
| Search | fuse.js |

## Build Phases

| Phase | Owner | Status |
|---|---|---|
| Phase 1 — Scaffold & Schema | scaffold agent | ✅ Complete |
| Phase 2 — Auth flows | auth agent | ⏳ Pending |
| Phase 3 — Student menu + cart + checkout | menu agent | ⏳ Pending |
| Phase 4 — Order tracking + QR + history | order agent | ⏳ Pending |
| Phase 5 — Staff kitchen board | staff agent | ⏳ Pending |
| Phase 6 — Print job system | print agent | ⏳ Pending |
| Phase 7 — Admin dashboard | admin agent | ⏳ Pending |
| Phase 8 — 3D landing page, polish | ui agent | ⏳ Pending |

## File Ownership

```
app/
  (public)/           ← auth agent
  (student)/
    home/             ← menu agent
    checkout/         ← order agent
    orders/[code]/    ← order agent
    history/          ← order agent
    print/            ← print agent
    profile/          ← auth agent
  staff/              ← staff agent
  admin/              ← admin agent
  403/                ← scaffold (done)
  not-found.tsx       ← scaffold (done)
  layout.tsx          ← scaffold (done)
  globals.css         ← scaffold (done)

components/
  ui/                 ← shared — any agent can extend
  auth/               ← auth agent
  menu/               ← menu agent
  cart/               ← order agent
  staff/              ← staff agent
  admin/              ← admin agent
  print/              ← print agent
  3d/                 ← ui agent

lib/
  supabase/           ← scaffold (done)
  types.ts            ← scaffold (done); extend as needed
  stores/             ← menu + order agents
  validators/         ← each feature agent owns its validators
  utils/              ← shared

supabase/
  migrations/         ← scaffold (done)
  seed.sql            ← scaffold (done)

middleware.ts         ← scaffold (done)
```

## Supabase Schema Summary

| Table | Purpose |
|---|---|
| `profiles` | User profiles — role, phone, department |
| `staff_accounts` | Canteen / print counter staff |
| `login_attempts` | Rate-limit helper |
| `categories` | Menu categories |
| `menu_items` | Food items with price in paise |
| `pickup_slots` | 10-minute pickup windows (08:00–20:00) |
| `orders` | Pre-orders with status FSM |
| `order_items` | Line items (snapshot of name + price) |
| `print_jobs` | Print job submissions |
| `notifications` | In-app push notifications |
| `sms_log` | Outbound SMS audit trail |
| `settings` | Key/value config (JSONB) |
| `audit_log` | Immutable action log |

### Key Design Decisions

- **Prices in paise** (integer) — avoids floating-point rounding
- **Role derived on signup** — `4MT*` local part → student, else faculty
- **Priority score** — numeric, lower = higher priority; faculty get -5 min boost; anti-starvation at 15 min
- **Order code** — `LETTER-DDDD` format, unique, human-readable
- **QR token** — separate from order code; signed opaque token for contactless collection
- **Source field** — supports future guest orders without an account

## Demo Credentials (Placeholder)

| Role | Email | Password |
|---|---|---|
| Student | 4mt21cs001@mite.ac.in | (OTP / magic link) |
| Faculty | john.doe@mite.ac.in | (OTP / magic link) |
| Staff — Canteen | canteen@mite.ac.in | TBD |
| Staff — Print | print@mite.ac.in | TBD |
| Admin | admin@mite.ac.in | TBD |

> Staff and admin accounts are created manually via Supabase dashboard and assigned the correct role in `profiles`.

## Assumptions

1. All users authenticate via email OTP (no password). Staff/admin may use a separate PIN-based flow.
2. `@mite.ac.in` is the only allowed domain; lookalike domains are rejected in the DB trigger.
3. Payment is assumed handled offline (cash) or via a future payment gateway integration; `payment_status` tracks the lifecycle.
4. SMS notifications are logged to `sms_log` for audit; actual sending happens via a Supabase Edge Function (not in scope for hackathon MVP).
5. File uploads for print jobs go to Supabase Storage bucket `print-jobs`; bucket creation is a manual step.
6. Pickup slots are seeded for today only; a cron job or admin action should regenerate them daily.
7. No real-time 3D on mobile — `components/3d/` components are lazy-loaded and skipped on low-power devices.
