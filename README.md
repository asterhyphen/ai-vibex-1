# SkipQ — Campus Pre-Order & Print System

<div align="center">

```
  ███████╗██╗  ██╗██╗██████╗  ██████╗ 
  ██╔════╝██║ ██╔╝██║██╔══██╗██╔═══██╗
  ███████╗█████╔╝ ██║██████╔╝██║   ██║
  ╚════██║██╔═██╗ ██║██╔═══╝ ██║▄▄ ██║
  ███████║██║  ██╗██║██║     ╚██████╔╝
  ╚══════╝╚═╝  ╚═╝╚═╝╚═╝      ╚══▀▀═╝ 
```

**High-Throughput Canteen & Document Pre-Order Architecture for MITE**  
*Mangalore Institute of Technology & Engineering*

[![Next.js 16](https://img.shields.io/badge/Next.js-16.4.6-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

[Live Demo](https://ai-vibex-1.vercel.app) · [Report Bug](https://github.com/asterhyphen/ai-vibex-1/issues) · [Explore Architecture](#-architecture)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Priority Scheduling Engine](#-priority-scheduling-engine)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Demo Credentials](#-demo-credentials)
- [Design System](#-design-system)
- [Security Architecture](#-security-architecture)
- [Deployment on Vercel](#-deployment-on-vercel)
- [Directory Structure](#-directory-structure)
- [90-Second Demo Walkthrough](#-90-second-demo-walkthrough)

---

## 🍽️ Overview

**SkipQ** eliminates canteen rush lines and print counter delays across campus. Built specifically for MITE's class-break rush, students and faculty can browse real-time inventory, place orders in plain English, schedule pickup windows, pay online or with counter cash, submit sanitized PDF print jobs, and collect with signed HMAC-SHA256 QR codes.

Staff and managers receive specialized interfaces:
- **Kitchen Counter Staff** get a real-time Kanban queue auto-sorted by kitchen start deadlines.
- **Print Hub Staff** download verified PDFs and track printing jobs.
- **Campus Admins** monitor hourly sales throughput, capacity heatmaps, user roles, audit logs, and system parameters.

---

## ✨ Key Features

### 🎓 Students & Faculty
- **Locked Domain Sign-In:** Permanent `@mite.ac.in` suffix locked inside login fields with 4-digit demo OTP (`1234`).
- **Plain-Language AI Ordering:** Natural language parser powered by `fuse.js` — type *"two masala dosa and filter coffee"* to instantly populate your cart.
- **10-Minute Pickup Windows:** Schedule exact pickup intervals to guarantee fresh, hot food upon arrival.
- **Faculty Fast-Track:** Faculty accounts receive automatic priority scheduling and dedicated badge recognition.
- **Interactive 3D Hero & Preloader:** Fluid brand preloader where a plate and spoon form the signature **`Q`** mark and glide into the navbar.
- **Curved Footer Reveal:** Modern Mobbin-inspired curved layout reveal transitioning into a rich deep burgundy footer.
- **PDF Print Hub:** Upload PDFs with automated client & server active-content stripping, page counting, duplex/color options, and live cost calculation.

### 👨‍🍳 Kitchen & Print Counter Staff
- **Separated Portals:** Kitchen operations (`/staff`) and Print counter (`/staff/print`) are routed independently based on staff accounts.
- **Smart 3-Column Kanban Board:** *Incoming* $\rightarrow$ *Cooking* $\rightarrow$ *Ready for Pickup*, auto-sorted by cook deadline.
- **Walk-in Guest POS:** Create counter walk-in orders that deduct live ingredients and slot units.
- **Live Overdue & Slot Heatmaps:** Real-time visual alerts for orders nearing their pickup window.
- **QR Scanner & OTP Fallback:** Scan customer QR passes with an integrated camera scanner or manual 6-digit OTP verification.

### 🛡️ Administration & Operations
- **Real-Time KPIs:** Live order volume, revenue in paise, average turnaround wait, and active queue length.
- **24-Hour Orders per Hour Chart:** Interactive SVG volume trends.
- **Reusable DataGrid:** Sort, search, filter, and export CSVs for categories, menu items, orders, slots, users, and audit logs.
- **Danger Zone Controls:** Reset demo orders, re-seed today's 10-minute slots, or flush audit tables in one click.

---

## ⚡ Priority Scheduling Engine

SkipQ utilizes a dynamic priority equation ensuring kitchen staff start cooking items at the exact minute needed so orders are fresh when customers arrive:

$$\text{Priority Score} = \underbrace{(\text{Target Arrival Time} - \text{Total Preparation Duration})}_{\text{Ideal Kitchen Start Time}} - \underbrace{(5\text{ min for Faculty})}_{\text{Faculty Head-Start}} - \underbrace{(10\text{ min if Waiting } > 15\text{m})}_{\text{Anti-Starvation Safeguard}}$$

> [!NOTE]
> Lower numerical priority score indicates an earlier required start time and moves the order to the **top of the cooking queue**.

| Parameter | Logic | Impact |
|---|---|---|
| **Target Timeframe** | Pickup slot `slot_start` or immediate order ETA | Orders needed earlier are cooked first. |
| **Preparation Duration** | Aggregate sum of item `prep_seconds` | High-prep meals (e.g. 20 min) start before quick beverages (e.g. 3 min). |
| **Faculty Boost** | Evaluates `profiles.role = 'faculty'` | Subtracts 5 minutes, giving teachers priority during short breaks. |
| **Anti-Starvation** | Orders waiting $> 15\text{ min}$ in queue | Subtracts 10 minutes to prevent complex orders from being perpetually delayed. |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16 (App Router)](https://nextjs.org) + [React 19](https://react.dev) |
| **Language** | [TypeScript](https://www.typescriptlang.org) (`strict: true`) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) + CSS Variables (WCAG AA) |
| **Typography** | `Fraunces` (Headings), `Inter` (UI/Body), `JetBrains Mono` (OTPs, Codes, Prices) |
| **Database** | [Supabase](https://supabase.com) (PostgreSQL + RLS + Realtime + Private Storage) |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) (Persistent Cart & Session Store) |
| **Validation** | [Zod](https://zod.dev) v3 |
| **Animations & 3D** | [Framer Motion](https://www.framer.com/motion) + [React Three Fiber](https://r3f.docs.pmnd.rs) + Three.js |
| **PDF Processing** | [pdf-lib](https://pdf-lib.js.org) (Active code stripping & sanitization) |
| **QR Code Engine** | [qrcode](https://www.npmjs.com/package/qrcode) (HMAC-SHA256 signed tokens) |
| **Notifications** | [Sonner](https://sonner.emilkowal.ski) + In-App Simulated SMS Popups |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** 20.x or higher
- **npm** or **pnpm**
- A free **Supabase** project

### 2. Clone and Install
```bash
git clone https://github.com/asterhyphen/ai-vibex-1.git
cd ai-vibex-1
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file in the project root:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
QR_SIGNING_SECRET=mite-secret-qr-signing-key
ALLOWED_EMAIL_DOMAIN=mite.ac.in
```

### 4. Database Setup
Open your **Supabase Dashboard $\rightarrow$ SQL Editor** and execute:
- [`supabase/final_setup.sql`](supabase/final_setup.sql): Creates all 13 tables, custom triggers, RLS policies, Storage buckets (`print-jobs` and `menu-images`), and seed accounts.

### 5. Run Local Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🎭 Demo Credentials

> [!TIP]
> Student and Faculty accounts use the demo OTP **`1234`** for passwordless login. Staff and Admin accounts use secure passwords with lockout protection.

| Portal | Email | Role | Authentication Method |
|---|---|---|---|
| **Student** | `4mt21cs001@mite.ac.in` | Student | Email OTP (`1234`) |
| **Student** | `4mt22ec042@mite.ac.in` | Student | Email OTP (`1234`) |
| **Faculty** | `john.doe@mite.ac.in` | Faculty (Priority) | Email OTP (`1234`) |
| **Faculty** | `priya.sharma@mite.ac.in` | Faculty (Priority) | Email OTP (`1234`) |
| **Kitchen Staff** | `canteen@mite.ac.in` | Kitchen Counter | Password: `Canteen@123` |
| **Print Staff** | `print@mite.ac.in` | Print Hub | Password: `Print@456` |
| **Administrator** | `admin@mite.ac.in` | Superadmin | Password: `Admin@789` |

---

## 🎨 Design System

SkipQ features an intentional **Ivory & Burgundy** editorial aesthetic designed for legibility and campus heritage:

```
Light Theme (Warm Ivory & Deep Burgundy)
├── Background:   #FAF7F4 (Warm Sand/Ivory)
├── Surface:      #FFFFFF (Clean White)
├── Primary:      #7A1F3D (Royal Burgundy)
├── Accent:       #835B14 (Campus Ochre / Gold)
└── Text:         #2B1117 (Deep Espresso)

Dark Theme (Burgundy Night)
├── Background:   #14080C (Deep Velvet Night)
├── Surface:      #1E0E14 (Rich Wine Plum)
├── Primary:      #A83060 (Luminous Berry)
├── Accent:       #D4A855 (Warm Amber Gold)
└── Text:         #F6ECEC (Soft Ivory)
```

- **Typography:** `Fraunces` for display headings, `Inter` for interfaces, and `JetBrains Mono` for tabular prices, OTPs, and codes.
- **Accessibility:** 100% WCAG AA contrast compliant with smooth circular clip-path theme transitions.

---

## 🔒 Security Architecture

1. **Multi-Layer Domain Enforcement:**
   - Client input with non-editable `@mite.ac.in` suffix.
   - Server-side regex validation rejecting non-MITE addresses.
   - PostgreSQL trigger rejecting unauthorized domains directly at database layer.
2. **Server-Derived RBAC:**
   - Emails matching `4mt*` are assigned `student` role; all other MITE emails are assigned `faculty`.
   - Role updates are protected by database triggers to block client privilege escalation.
3. **Cryptographically Signed QR Tokens:**
   - Single-use HMAC-SHA256 signatures (`orderId:orderCode`) verified at counter scan with a 6-digit order OTP fallback.
4. **PDF Document Sanitization:**
   - PDF uploads validate magic bytes (`%PDF-`), strip `/OpenAction`, `/Launch`, `/JavaScript`, and active annotations, copying safe pages into clean storage.
5. **Integer Currency Architecture:**
   - All prices and balances stored in integer paise (`₹1.00 = 100 paise`), preventing floating-point rounding exploits.

---

## ☁️ Deployment on Vercel

SkipQ is optimized for one-click deployment on [Vercel](https://vercel.com):

1. Push your repository to GitHub.
2. Import the project in Vercel.
3. Configure your Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `QR_SIGNING_SECRET`
   - `ALLOWED_EMAIL_DOMAIN=mite.ac.in`
4. Deploy! Next.js 16 dynamic route handlers and edge middleware configure automatically.

---

## 📁 Directory Structure

```text
vibex/
├── app/
│   ├── (public)/              # Landing page (3D hero, footer reveal), /login, /onboarding
│   ├── (student)/             # /home, /checkout, /orders/[code], /history, /print, /profile
│   ├── staff/                 # /staff (Kitchen Kanban), /staff/stock, /staff/print, /staff/login
│   ├── admin/                 # /admin (Dashboard, DataGrids, Settings, Danger Zone), /admin/login
│   ├── api/                   # Auth, orders, print upload, staff board, and admin CRUD routes
│   └── layout.tsx             # Root layout with fonts, theme, and realtime alerts
├── components/
│   ├── 3d/                    # Three.js / React Three Fiber interactive hero scene
│   ├── ui/                    # BrandQMark, Preloader, ThemeToggle, NotificationBell, SmsPopup
│   ├── auth/                  # OtpInput, PortalLoginForm
│   ├── menu/ & cart/          # MenuCard, CategoryChips, PlainLanguageModal, CartBar
│   ├── staff/                 # OrderCard, Kanban boards, CashModal, QrScannerModal, SlotHeatmap
│   └── admin/                 # AdminShell, DataGrid, Hourly throughput charts
├── lib/
│   ├── supabase/              # Browser, server, middleware clients
│   ├── stores/                # Zustand stores (cart, session)
│   ├── utils/                 # Formatting, motion, nlp parser, qr generator
│   └── validators/            # Zod schemas (auth, orders, print, admin)
└── supabase/
    ├── final_setup.sql        # Complete schema, triggers, RLS, storage & seeds
    └── README.md              # Supabase setup guide
```

---

## 🧪 90-Second Demo Walkthrough

1. **Landing & Brand Reveal:** Visit [localhost:3000](http://localhost:3000) to observe the plate + spoon **`Q`** preloader, explore the 3D food hero, and scroll down to experience the curved burgundy footer reveal.
2. **Student Authentication:** Click *"Sign In"* $\rightarrow$ note the locked `@mite.ac.in` suffix $\rightarrow$ type `4mt21cs001` $\rightarrow$ enter demo OTP `1234`.
3. **Natural Language Order:** In `/home`, click *"Order in plain words"* and type *"one masala dosa and cold coffee"* $\rightarrow$ verify parsed items added to cart.
4. **Scheduled Checkout:** Proceed to `/checkout` $\rightarrow$ choose a 10-minute pickup slot $\rightarrow$ click *"Pay via UPI (Simulated)"*.
5. **Live Tracker & Signed QR:** View your order code and flip the pass card on `/orders/[code]` to inspect the collection QR code.
6. **Kitchen Kanban In Action:** In an incognito tab, sign in to `/staff/login` with `canteen@mite.ac.in` (`Canteen@123`) $\rightarrow$ see the order auto-prioritized by cook start time.
7. **Kitchen Progression:** Click **Accept** $\rightarrow$ **Start Cooking** $\rightarrow$ **Mark Ready** $\rightarrow$ observe instant realtime toast and SMS notification popup in the student tab.
8. **QR Counter Pickup:** Scan the student's QR pass using the staff scanner modal to mark the order **Collected**.
9. **Print Hub Verification:** Log in with `print@mite.ac.in` (`Print@456`) at `/staff/login` $\rightarrow$ verify automatic redirection to `/staff/print` with active print queues.
10. **Operations Dashboard:** Log in to `/admin` (`admin@mite.ac.in` / `Admin@789`) to view live throughput charts, slot heatmaps, and database grids.

---

<div align="center">

Winners for the event
</div>
