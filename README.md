# MITE Canteen Pre-Order System

> Hackathon project — Next.js App Router + Supabase · Premium Ivory & Burgundy themes

A mobile-first canteen and campus print pre-order system for **MITE (Mangalore Institute of Technology & Engineering)**. Students and faculty browse the live menu, order using plain language or tap-to-cart, reserve 10-minute pickup slots, pay online or with cash at the counter, upload PDF print jobs, and collect with signed QR codes — while kitchen staff manage a real-time Kanban board and admins monitor KPIs and operations.

---

## 🚀 Quick Start

1. Clone and install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your Supabase credentials and QR signing secret:
   ```bash
   cp .env.example .env.local
   ```
   Required environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `QR_SIGNING_SECRET`
   - `ALLOWED_EMAIL_DOMAIN=mite.ac.in`
3. Run the database migration in your Supabase SQL editor:
   - `supabase/migrations/001_initial_schema.sql`
4. Run the seed script in your Supabase SQL editor:
   - `supabase/seed.sql`
5. Create a private Supabase Storage bucket named `print-jobs` for PDF print uploads.
6. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

---

## 🎭 Demo Accounts

| Role | Email | Password / Method |
|---|---|---|
| Student | `4mt21cs001@mite.ac.in` | Email OTP |
| Student | `4mt22ec042@mite.ac.in` | Email OTP |
| Faculty | `john.doe@mite.ac.in` | Email OTP |
| Faculty | `priya.sharma@mite.ac.in` | Email OTP |
| Canteen Staff | `canteen@mite.ac.in` | Password: `Canteen@123` |
| Print Staff | `print@mite.ac.in` | Password: `Print@456` |
| Admin | `admin@mite.ac.in` | Password: `Admin@789` |

> **Note:** Student/faculty login uses Supabase email OTP — check your inbox or the Supabase Auth dashboard during local/demo runs. Staff and admin accounts are provisioned via Supabase Auth with matching `profiles.role` (`shopkeeper` / `admin`) and `staff_accounts` records.

---

## 🏗️ Architecture

- **Framework:** Next.js App Router (Next.js 16 + React 19, TypeScript `strict: true`)
- **Database & Realtime:** Supabase (PostgreSQL + Row Level Security + Realtime channels)
- **Authentication:** Supabase Auth (email OTP restricted to `@mite.ac.in` for students/faculty; email + password for staff/admin)
- **Styling:** Tailwind CSS v4 with CSS custom property brand tokens in `app/globals.css`
- **State Management:** Zustand (`lib/stores/cart.ts` persisted to `localStorage`, `lib/stores/session.ts`)
- **Validation:** Zod schemas in `lib/validators/`
- **3D Hero:** React Three Fiber + `@react-three/drei` + Three.js (landing page only, lazy-loaded via `React.lazy` + `Suspense`, DPR capped at 2, skipped when `prefers-reduced-motion` is active or on low-power devices)
- **Motion & Alerts:** Framer Motion (`lib/utils/motion.ts`), Sonner toasts, and Supabase Realtime notifications + iPhone-style SMS popup queue (`components/ui/RealtimeAlertsProvider.tsx`)
- **PDF & QR:** `pdf-lib` (active content detection & sanitization + page counting), `qrcode` (collection QRs), `fuse.js` (plain-language menu matching), `@tanstack/react-table` (admin data grids)

---

## 🔐 Security Notes

- **Domain enforcement in 3 layers:** Client validation, server route checks (`app/api/auth/request`), and PostgreSQL trigger (`handle_new_user()` rejecting lookalike domains so only exact `mite.ac.in` passes).
- **Server-derived roles:** Local parts matching `4mt%` are assigned `student`; all other `@mite.ac.in` accounts receive `faculty` — users cannot self-elevate roles.
- **Row Level Security (RLS):** Enabled on all 13 tables in `001_initial_schema.sql`; no table is publicly writable.
- **Server-side pricing:** Order totals and print costs are recomputed on the server from database records (client totals are never trusted).
- **QR tokens:** HMAC-SHA256 signed (`QR_SIGNING_SECRET`), single-use, bound to order/print records.
- **PDF sanitization:** Uploaded PDFs are validated by magic bytes (`%PDF-`), scanned for active content (`/OpenAction`, `/AA`, `/Launch`, `/URI`, `/EmbeddedFile`, `/XFA`), and copied cleanly into a fresh `PDFDocument` via `pdf-lib` before private storage.
- **Role-based middleware:** Root `middleware.ts` enforces role gates for `/staff/*`, `/admin/*`, student routes, and blocked accounts (`/403`).

---

## 📋 Fake Features (Demo-Grade)

Labeled clearly for hackathon evaluation:

- **SMS OTP & Alerts:** Displayed in-app via the iPhone-style `SmsPopup` bubble (`components/auth/SmsPopup.tsx` and `components/ui/SmsPopup.tsx`); any code displayed (or `123456`) works during phone onboarding, and outbound messages are logged to `sms_log`.
- **Online Payment Gateway:** Simulated UPI / Card / Wallet checkout flow with a 2-second processing animation that always succeeds for demo orders and print jobs.
- **Rate Limiting:** In-memory request counter in auth routes (resets on server restart) and `login_attempts` lockouts for staff/admin portals.
- **PDF Storage:** Uses the Supabase Storage bucket `print-jobs` (must be created manually in the Supabase dashboard).

---

## 🎨 Design System

Two themes powered by `next-themes` and CSS variables in `app/globals.css`, with a circular clip-path reveal toggle (`ThemeToggle`):

- **Light — Ivory & Burgundy:** `#FAF7F4` background, `#FFFFFF` surface, `#7A1F3D` primary, `#B8893B` accent, `#2B1117` text
- **Dark — Burgundy Night:** `#14080C` background, `#1E0E14` surface, `#A83060` primary, `#D4A855` accent, `#F6ECEC` text

---

## 📁 Folder Structure

```text
app/
  (public)/             # Landing page with 3D hero, OTP login, phone onboarding
  (student)/            # Student & faculty portal: menu home, checkout, orders/[code], history, print, profile
  staff/                # Kitchen Kanban board, stock control, print queue, staff login
  admin/                # Admin dashboard, data grids, settings, admin login
  api/                  # Server route handlers for auth, orders, print upload/jobs, staff, and admin
  403/ & not-found.tsx  # Access restricted & 404 pages
  layout.tsx            # Root layout with ThemeProvider + RealtimeAlertsProvider + Sonner Toaster
  globals.css           # Tailwind v4 setup and Ivory & Burgundy / Burgundy Night CSS variables

components/
  3d/                   # HeroScene (lazy-loaded), HeroCanvas, FloatingObject, HeroFallback
  ui/                   # Button, Card, Badge, LoadingBar, ThemeToggle, NotificationBell, SmsPopup, RealtimeAlertsProvider
  auth/                 # OtpInput, PortalLoginForm, SmsPopup, ThemeToggle
  menu/ & cart/         # MenuCard, CategoryChips, ItemSheet, PlainLanguageModal, TopBar, CartBar
  staff/, print/, admin/# Kitchen cards/modals, print widgets, reusable admin DataGrid

lib/
  supabase/             # Browser, server, middleware, and config helpers
  stores/               # Zustand stores (cart, session)
  utils/                # format, motion, nlp, qr, server-auth helpers
  validators/           # Zod schemas for auth, orders, print, staff, admin
  types.ts              # TypeScript interfaces mirroring Supabase schema

supabase/
  migrations/           # 001_initial_schema.sql (13 tables, triggers, functions, RLS policies)
  seed.sql              # 5 categories, 24 menu items, 72 daily pickup slots, default settings
```

---

## 🧪 90-Second Demo Script

1. Open [http://localhost:3000](http://localhost:3000) — view the interactive 3D canteen hero, scroll-reveal features, and theme toggle.
2. Click **"Continue with college email"** → enter `4mt21cs001@mite.ac.in`.
3. Enter the 6-digit email OTP → complete phone onboarding with `9876543210` and the SMS bubble code (or `123456`).
4. On `/home`, type `"two masala dosa and filter coffee"` into the plain-language bar → inspect parsed items → add to cart.
5. Proceed to `/checkout`: select a 10-minute pickup slot, set ETA to `10 min`, and pay via the simulated UPI tab.
6. View the generated order code and flip the card on `/orders/[code]` to reveal the collection QR code.
7. Open `/staff` in a second tab (`canteen@mite.ac.in` / `Canteen@123`) → watch the incoming order arrive live.
8. Click **Accept** → **Start Cooking** → **Mark Ready** and observe live toast + SMS popup alerts in the student tab.
9. Verify collection via the QR scanner (or manual order code + fallback OTP) to mark the order **Collected**.
10. Open `/admin` (`admin@mite.ac.in` / `Admin@789`) to explore today's KPIs, slot heatmap, order grid, and system settings.

---

## 📌 Assumptions

- Students and faculty authenticate passwordlessly via email OTP (`@mite.ac.in`); staff and admin accounts are created ahead of time in Supabase Auth with appropriate roles.
- Payments are simulated in demo mode (`online` simulated gateway or `cash` collected at the counter via staff POS).
- Pickup slots in `seed.sql` are generated for `CURRENT_DATE` (`08:00`–`20:00` in 10-minute intervals); production deployments should regenerate slots daily via a scheduled job.
- Real-time 3D rendering is isolated to the landing page hero, lazy-loaded, capped at `dpr={[1, 2]}`, and automatically bypassed for `prefers-reduced-motion` or low-power devices.
