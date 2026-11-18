# Batloung Farm — Distribution Management System

A web-based distribution management system for **Batloung Farm**, a fruit distribution business in Maseru, Lesotho that buys fruit from South African suppliers and sells it to street vendors and small retailers in three packaging sizes.

Built for the DIWA2110 Web Application Development take-home test.

---

---

## 0. Quick start in VS Code

### Prerequisites
- Node.js 18 or newer (20 LTS recommended)
- npm 9 or newer

### Steps

1. **Unzip** the archive and open the folder in VS Code: `File -> Open Folder...`
2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Confirm the environment file.** `.env` ships with the project and already points at the live Supabase database:

   ```
   VITE_SUPABASE_URL=https://ahzzdvnzpglfhayyossu.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```

   To use your own Supabase project instead, copy `.env.example` to `.env` and paste your project's URL and anon key.

4. **Start the dev server**

   ```bash
   npm run dev
   ```

   Then open the URL Vite prints (default `http://localhost:5173`).

5. **Create your account.** No users are pre-seeded. On the sign-in screen choose *Create account* and pick any username and password. The app maps the username to `<username>@miaoda.com` internally and stores the profile in the `profiles` table.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript check only |
| `npm run lint` | Biome lint |

### Rebuilding the database (optional)

The hosted database is already provisioned and seeded. To recreate it in a fresh Supabase project, open the Supabase SQL editor and run the files in `supabase/migrations/` in numeric order (`00001` through `00007`). `database/schema.sql` contains the same schema in a single file for reference.

### Folder map

```
src/
  components/     UI building blocks (layout, shadcn primitives, receipts)
  contexts/       Auth context (username/password -> Supabase Auth)
  db/             Supabase client initialisation
  lib/            Formatting helpers, receipt numbering
  pages/          Dashboard, Fruits, Stock, Suppliers, Purchases, Vendors,
                  Vendor Map, Sales, Payments, Reports
  services/       api.ts - every database call in one place
  types/          Shared TypeScript types
database/         schema.sql - full relational schema
supabase/         migrations/ - ordered SQL migrations
docs/             prd.md and DESIGN.md
server/           Optional Node/Express reference API (not required to run the app)
```

---

## 1. Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| Routing | React Router |
| Database | PostgreSQL (Supabase) |
| Data access | Supabase JS client + PostgreSQL functions (`plpgsql`) |
| Validation | Client-side form validation + database `CHECK` constraints + server-side function guards |

> **Note on MySQL → PostgreSQL.** The brief specifies MySQL. The deployment target for this build is Supabase, which runs PostgreSQL. The relational design, constraints, transaction semantics (`BEGIN` / `COMMIT` / `ROLLBACK`) and reporting SQL are preserved exactly; `plpgsql` functions replace the Node/Express controller layer and provide the same atomic transaction guarantees.

---

## 2. Database design

Database: `postgres` (Supabase project). All tables live in the `public` schema.

### 2.1 Core tables (the eight required tables)

| # | Table | Key attributes |
| --- | --- | --- |
| 1 | `suppliers` | `supplier_id` PK, `business_name` UNIQUE, `contact_person`, `phone`, `province`, `address` |
| 2 | `fruits` | `fruit_id` PK, `fruit_name` UNIQUE, `description`, `status` |
| 3 | `vendors` | `vendor_id` PK, `vendor_name`, `phone` UNIQUE, `location`, `registration_date` |
| 4 | `purchases` | `purchase_id` PK, `supplier_id` FK, `purchase_date`, `total_amount` |
| 5 | `purchase_details` | `purchase_detail_id` PK, `purchase_id` FK, `fruit_id` FK, `quantity`, `unit_cost`, `packaging_size` |
| 6 | `sales` | `sale_id` PK, `vendor_id` FK, `sale_date`, `payment_status`, `payment_method`, `total_amount`, `amount_paid` |
| 7 | `sale_details` | `sale_detail_id` PK, `sale_id` FK, `fruit_id` FK, `packaging_size`, `quantity`, `unit_price` |
| 8 | `stock` | `stock_id` PK, `fruit_id` FK, `packaging_size`, `available_quantity`, `low_stock_threshold`, UNIQUE (`fruit_id`, `packaging_size`) |

### 2.2 Supporting tables

| Table | Purpose |
| --- | --- |
| `fruit_prices` | Selling price per fruit **per packaging size** — enforces the requirement that small, medium and large carry different prices. UNIQUE (`fruit_id`, `packaging_size`). |
| `payments` | Individual settlement records against a sale (cash / mobile money), used to derive `PAID`, `PARTIALLY_PAID` and `UNPAID`. |

### 2.3 Constraints and referential integrity

- **Primary keys** on all ten tables (`SERIAL`).
- **Foreign keys** with explicit delete behaviour:
  - `purchases.supplier_id → suppliers` `ON DELETE RESTRICT`
  - `purchase_details.purchase_id → purchases` `ON DELETE CASCADE`
  - `purchase_details.fruit_id → fruits` `ON DELETE RESTRICT`
  - `sales.vendor_id → vendors` `ON DELETE RESTRICT`
  - `sale_details.sale_id → sales` `ON DELETE CASCADE`
  - `sale_details.fruit_id → fruits` `ON DELETE RESTRICT`
  - `stock.fruit_id → fruits` `ON DELETE CASCADE`
- **NOT NULL** on every business-critical column.
- **UNIQUE**: `suppliers.business_name`, `fruits.fruit_name`, `vendors.phone`, `stock(fruit_id, packaging_size)`, `fruit_prices(fruit_id, packaging_size)`.
- **CHECK** constraints:
  - `suppliers.province IN ('Gauteng','Free State','KwaZulu-Natal','Western Cape','Eastern Cape','Limpopo','Mpumalanga','North West')`
  - `fruits.status IN ('ACTIVE','INACTIVE')`
  - `packaging_size IN ('SMALL','MEDIUM','LARGE')` on `purchase_details`, `sale_details`, `stock`, `fruit_prices`
  - `quantity > 0`, `unit_cost > 0`, `unit_price > 0`, `selling_price > 0`
  - `stock.available_quantity >= 0` — **negative stock is impossible at the schema level**
  - `sales.payment_status IN ('PAID','PARTIALLY_PAID','UNPAID')`
  - `sales.payment_method IN ('CASH','MOBILE_MONEY','CREDIT')`
  - `sales.amount_paid <= sales.total_amount`
- **Row Level Security** is enabled on every table with explicit `SELECT` / `INSERT` / `UPDATE` / `DELETE` policies for the `anon` and `authenticated` roles (single-administrator internal tool).

### 2.4 Packaging-specific stock

`stock` holds **one row per fruit × packaging size** — 5 fruits produce 15 stock rows. A purchase of 10 large apple boxes increments only the `(Apples, LARGE)` row; a sale of 4 medium banana boxes decrements only `(Bananas, MEDIUM)`. Registering a new fruit automatically creates its three stock rows.

---

## 3. Business logic layer

All multi-row writes run inside a single PostgreSQL function, which is one implicit transaction — any `RAISE EXCEPTION` rolls the whole operation back.

| Function | Responsibility |
| --- | --- |
| `record_purchase(supplier_id, purchase_date, items jsonb)` | Validates the supplier and every line, inserts the purchase + all detail rows, increments the matching stock rows, computes `total_amount`. |
| `record_sale(vendor_id, sale_date, items jsonb, payment_method)` | Three-pass algorithm: (1) validate every line and aggregate requested quantities per fruit+size, (2) verify aggregated demand against stock, (3) write the sale, its lines, decrement stock and settle cash/mobile money. |
| `record_payment(sale_id, amount, method, date)` | Locks the sale row, rejects overpayment, inserts the payment and recalculates `amount_paid` + `payment_status`. |
| `delete_supplier_checked(id)` | Blocks deletion when purchase records exist. |
| `delete_vendor_checked(id)` | Blocks deletion when sales records exist. |
| `delete_fruit_checked(id)` | Blocks deletion when purchase or sales history exists. |

### 3.1 Atomic multi-item sale

`record_sale` aggregates demand **before** touching stock, so duplicate lines for the same fruit and size cannot slip through individually. If any combination is short, the function raises:

```
Insufficient stock for Apples - Large packaging. Available: 10 boxes, Requested: 999 boxes. Transaction cancelled.
```

No sale row, no detail rows and no stock movement survive the rollback. Verified: after a rejected 2-line sale, `sales` count, both stock balances and total revenue were unchanged.

### 3.2 Automatic calculations

- `purchases.total_amount = Σ (quantity × unit_cost)`
- `sales.total_amount = Σ (quantity × unit_price)`
- `sales.amount_paid = Σ payments for that sale`
- `vendor outstanding = Σ total_amount − Σ amount_paid`

Totals are never entered by the administrator.

### 3.3 Payment status lifecycle

| Condition | Status |
| --- | --- |
| `amount_paid = 0` | `UNPAID` |
| `0 < amount_paid < total_amount` | `PARTIALLY_PAID` |
| `amount_paid = total_amount` | `PAID` |

Cash and mobile money sales are settled at the point of sale (`PAID`); credit sales start `UNPAID`.

---

## 4. Reporting queries

| Function | Report |
| --- | --- |
| `report_top_fruits(limit)` | The five most frequently sold fruits by total boxes, with revenue and order count. |
| `report_revenue(start, end)` | Total sales revenue for a specified date range, broken down per trading day. |
| `report_top_vendors()` | Vendors ranked by the highest number of boxes purchased. |
| `report_stock_levels()` | Current stock level for each fruit and packaging size, with a low-stock flag. |
| `vendor_balances()` | Billed, paid and outstanding balance per vendor. |
| `dashboard_metrics()` | Aggregate KPIs for the dashboard. |

---

## 5. Application pages

| Route | Page |
| --- | --- |
| `/` | Dashboard — revenue, purchase spend, stock on hand, low-stock alerts, outstanding balances, recent sales, best sellers |
| `/suppliers` | Supplier CRUD with province selection and deletion guards |
| `/fruits` | Fruit CRUD with per-packaging selling prices |
| `/stock` | Stock matrix (fruit × packaging size) with low-stock highlighting and threshold editing |
| `/vendors` | Vendor CRUD with search by name or phone |
| `/purchases` | Purchase register, multi-line purchase entry, line-item detail |
| `/sales` | Sales register, multi-line sale entry with live stock availability, line-item detail |
| `/payments` | Vendor balances, sales awaiting settlement, payment history, record payment |
| `/reports` | All four required reports with a date-range filter |

---

## 6. Environment configuration

Database credentials are read from environment variables — never hardcoded.

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

The client is created in `src/db/supabase.ts`. Database failures surface as readable messages in the UI rather than terminating the application.

---

## 7. Project structure

```
database/
└── schema.sql           # MySQL DDL, constraints, sample data, 4 report queries

server/                  # Node.js + Express + mysql2 REST API (Parts B & C)
├── .env.example
└── src/
    ├── app.js           # Express app, CORS, JSON parsing
    ├── server.js        # bootstrap, graceful database-failure handling
    ├── config/db.js     # mysql2 pool, testConnection, withTransaction
    ├── middleware/      # errorHandler (ApiError, asyncHandler), validate
    ├── models/          # SQL queries only
    ├── controllers/     # request handling + business rules
    └── routes/          # endpoint definitions

src/                     # React admin dashboard (live demo)
├── components/
│   ├── common/          # PageHeader, StatCard, StatusStamp, EmptyState
│   ├── layouts/         # AppLayout (sidebar + mobile sheet navigation)
│   └── ui/              # shadcn/ui primitives
├── db/supabase.ts       # database connection
├── lib/format.ts        # currency, date and label formatting
├── pages/               # one module per business area
├── services/api.ts      # data access layer (queries + RPC calls)
├── types/types.ts       # schema-aligned TypeScript types
├── routes.tsx           # route table
└── App.tsx              # router + layout composition
```

### Two runnable layers

| Layer | Stack | Purpose |
| --- | --- | --- |
| `server/` | Node.js + Express + mysql2 | The REST API required by Parts B and C, running against MySQL using `database/schema.sql`. Full endpoint reference in [`server/README.md`](server/README.md). |
| `src/` | React + Vite + Supabase | The deployed admin dashboard. It talks to PostgreSQL through the same business rules, expressed as `plpgsql` functions so the live demo works without a Node host. |

Both layers implement identical validation, identical atomicity guarantees and identical reporting output.

---

## 8. Sample data

Seeded through the same functions the UI uses, so stock balances are internally consistent:

- 8 suppliers across all eight South African provinces
- 5 fruits (apples, bananas, oranges, mangoes, grapes) × 3 packaging sizes = 15 stock rows
- 8 vendors across Lesotho
- 5 purchases / 12 purchase lines
- 8 sales / 18 sale lines
- 6 payments (2 point-of-sale settlements + 2 part payments + 2 cash/mobile settlements)

Resulting position: **M 11,335.00** revenue, **M 18,770.00** purchase spend, **M 4,240.00** outstanding, **4** low-stock combinations.

---

## 9. Running the project

```bash
pnpm install
pnpm dev      # local development
pnpm lint     # type check + biome + tailwind + build verification
```
