# Ultimate Tech Distributors — Order System

A modern, mobile-first replacement for the legacy Ultimate Tech Distributors order
management app. React + Vite + TypeScript + Firebase (Auth + Firestore) + Tailwind,
deployable to Vercel.

> **Delivery status:** Complete (Batches 1–4). Auth, dashboard, the full order
> workflow, customers, products, reports, import/backup, and admin users are all live,
> plus the validated migration of your real database.

---

## What your data actually looked like

The migration was built against your real `database.db` (not assumptions). Key facts:

| Table | Rows | Notes |
|------|------|-------|
| customers | 379 | Customer **name** is stored in the `customer_id` column. No duplicate names. |
| products | 1,013 | Prices like `$23.00`; 5 duplicate-UPC pairs; 0 empty UPCs. |
| orders | 7,935 | IDs 68–8013. **Line items live in the `output` text field**, not `product`. |
| users | 9 | Plaintext passwords — **not migrated** (app is Google-only). |

The single most important finding: **only 103 orders use the structured
`[aisle] / NAME - $price x qty` format; 7,830 are free-form handwritten lists**
(brand headers, flavor sub-lines, shorthand quantities, embedded notes). So the
migration **preserves every order's raw text verbatim** and only *additionally*
extracts clean `items[]` for the 103 that genuinely support it. Nothing is dropped.

Migration result: 379 customers, 1,013 products, 7,935 orders (103 structured /
7,830 freeform / 2 empty), **0 orphans, 0 date-parse failures**, next order #8014.

---

## Project setup

```bash
npm install
cp .env.example .env.local   # fill in Firebase values
npm run dev                  # http://localhost:5173
```

`npm run dev` runs today against the scaffold router. Pages are placeholders until
the UI batches land.

## Firebase setup

1. Create a Firebase project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method → Google → Enable.**
3. **Firestore Database → Create database** (production mode).
4. **Project settings → Your apps → Web app** → copy the config into `.env.local`
   (see `.env.example`). Set `VITE_BOOTSTRAP_ADMIN_EMAIL` to your Google email so
   you are auto-promoted to admin on first sign-in.
5. Deploy rules + indexes (requires `npm i -g firebase-tools` then `firebase login`):

   ```bash
   firebase use --add           # select your project
   firebase deploy --only firestore:rules,firestore:indexes
   ```

## Migration: load your old data into Firestore

The converted, Firestore-ready JSON is already in `migration-output/`. To regenerate
from a fresh SQLite export:

```bash
npm i -D better-sqlite3
node scripts/migrate.mjs ./database.db ./migration-output
```

Each record carries a deterministic `_docId` (`cust_*`, `prod_*`, `order_*`), so
importing is idempotent — re-running never creates duplicates. Old order numbers are
preserved (#8012 stays #8012). Also create the order counter so new orders continue
in sequence:

```
counters/orders  →  { current: 8013 }
```

The in-app **Import / Backup** page uploads these JSON files directly: choose the
matching type, pick the file, review the preview (validation + duplicate flags +
optional column mapping), then import. Deterministic doc IDs mean re-importing never
duplicates, and ISO date fields are converted to Firestore Timestamps automatically
so imported orders behave identically to ones created in-app. Seed the counter too:

## Import CSV/JSON formats

See [`docs/IMPORT_FORMATS.md`](docs/IMPORT_FORMATS.md) for column layouts and
examples for customers, products, and orders.

## Deploy to Vercel

1. Push to GitHub (below).
2. Import the repo at <https://vercel.com/new>. Framework preset: **Vite**.
3. Add the `VITE_*` environment variables (same as `.env.local`).
4. Add your Vercel domain to Firebase **Authentication → Settings → Authorized
   domains**.
5. Deploy. Build command `npm run build`, output `dist`.

## Push to GitHub

```bash
git init
git add .
git commit -m "Ultimate Tech Distributors order system — foundation + migration"
git branch -M main
git remote add origin https://github.com/<you>/ultimate-tech-orders.git
git push -u origin main
```

> `migration-output/orders.json` (~12 MB) is gitignored by default. Remove that line
> from `.gitignore` if you want it in the repo.

---

## Firestore structure

Collections: `users`, `customers`, `products`, `orders`, `orderHistory`,
`importLogs`, `counters`. Full typed shapes are in
[`src/types/index.ts`](src/types/index.ts). Highlights:

- **orders** keep `legacyFormat` (`structured|freeform|empty`), `legacyOutputText`
  (verbatim), and `items[]` (structured only). The detail/print view renders the
  parsed table when items exist, otherwise the faithful raw text.
- **customers** use `normalizedName` (UPPERCASE, collapsed whitespace) as the join +
  duplicate key.
- **products** flag `duplicateUpc` on the 5 colliding UPCs.

## Roles & security

Role-based rules in [`firestore.rules`](firestore.rules):

| Role | Orders | Customers/Products | Delete | Admin Users |
|------|--------|--------------------|--------|-------------|
| admin | full | full | yes | yes |
| manager | create/edit | create/edit | no | no |
| worker | create/edit | read | no | no |
| viewer | read | read | no | no |

New sign-ins create a pending profile; an admin approves and assigns the role. The
bootstrap-admin email is auto-promoted so you cannot lock yourself out.

---

## Folder structure

```
src/
  components/   reusable UI kit            (Batch 2)
  pages/        route screens              (Batches 2–4)
  layouts/      app shell, nav             (Batch 2)
  hooks/        auth, data hooks           (Batch 2)
  services/     Firestore data access      (Batch 2)
  firebase/     SDK init                   ✓
  types/        data model                 ✓
  utils/        normalize, parsing         ✓
scripts/        migrate.mjs                ✓
migration-output/  converted JSON          ✓
```

## Roadmap

- **Batch 1 (this package)** — scaffold, config, data model, security rules, indexes,
  migration script, and your fully migrated data. ✓
- **Batch 2** — Google auth + protected routes, app shell, reusable UI kit,
  Firestore services, Login + Dashboard. ✓
- **Batch 3** — Create Order (fast search, scanner auto-focus, Enter-to-add, camera
  scanner, sequential numbering from #8014), Orders list (all filters, bulk actions,
  mobile cards), Order detail + print sheet, Edit Order with audit log. ✓
- **Batch 4** — Customers, Products (inline edit), Reports (CSV export),
  Import/Backup (CSV/JSON upload with preview + dup detection), Admin Users.
