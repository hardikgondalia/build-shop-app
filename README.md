# Shop counter

A full-stack Next.js App Router application featuring a server-rendered searchable catalogue with deliberate in-process caching, an idempotent staff payment desk with shared validation, and an immutable snapshot checkout system. Styled with the bespoke **Warm Atelier** design system.

**Stack:** Next.js 16.4.6, React 19, TypeScript, Tailwind CSS 4, React Hook Form, Zod, Vitest + React Testing Library, Playwright.

**Node:** 22.x or newer (tested on Node 22.16.0). **Package manager:** npm.

---

## Quick Start

### 1. Development Mode

```bash
npm install
npm run dev
# Visit http://localhost:3000
```

### 2. Production Build & Start

```bash
npm run build
npm run start
# Visit http://localhost:3000
```

### 3. Automated Tests

```bash
# Unit & Component tests (Vitest + React Testing Library)
npm test

# Static type check (strict TypeScript)
npm run typecheck

# Playwright E2E tests (runs full catalogue, staff desk, checkout, and caching scenarios)
npm run test:e2e
```

> **Note on E2E testing:** `npm run test:e2e` will run against an existing server on `http://127.0.0.1:3000` (or `PLAYWRIGHT_BASE_URL`), or launch a production server automatically using 1 worker to ensure atomic in-memory state testing.

---

## Architectural Highlights

For complete technical documentation, refer to:
- [**ARCHITECTURE.md**](ARCHITECTURE.md) — Comprehensive technical design, cache invalidation strategy, serverless failure modes, and accessibility audit.
- [**SERVER_VS_CLIENT.md**](SERVER_VS_CLIENT.md) — Route-by-route breakdown of server vs. client rendering choices.
- [**TASKS_TODO.md**](TASKS_TODO.md) — Specification compliance audit and feature tracking.

### Endpoints

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/catalog` | Uncached live catalogue read (does not increment cache reads) |
| `GET` | `/api/debug/reads` | `{ "catalogReads": n }` (miss counter for `getCatalog()`) |
| `GET` | `/api/payments` | Current process's recorded payment queue |
| `POST` | `/api/payments/preview` | Validates & previews payment without changing inventory |
| `POST` | `/api/payments` | Records payment once per charge ID, decrements stock, invalidates cached catalogue |
| `POST` | `/api/checkout/begin` | Prices lines from catalogue and stores frozen attempt snapshot |
| `POST` | `/api/checkout/complete` | Builds order from frozen attempt ID; ignores client price/line submissions |

### Shared Validation

The **shared `validatePayment` function** is exported from:
```
src/lib/payment-validation.ts
```
Both `POST /api/payments/preview` and `POST /api/payments` call this identical function directly. It trims and lowercases email, validates SKU and charge ID format (`^ch_[A-Za-z0-9]{8,}$`), and enforces that Cushion can only be purchased with Cedar stool.

---

## Manual Smoke Check

1. **Catalogue (`/shop`)**:
   - Type `lamp` into Search: URL updates to `?q=lamp` and filters to Maple lamp.
   - Change Sort to `price-desc`: URL updates to `?sort=price-desc`.
   - Reload the page: filter and sort persist.
   - Click browser Back: restores previous search state.
   - Click into `/shop/stool`: verify page title is `Cedar stool | Shop counter` and meta description is present.
2. **Staff Desk (`/desk`)**:
   - Enter `Ada@Example.com`, select `Maple lamp`, and enter `ch_12345678`.
   - Click **Preview**: email normalizes to `ada@example.com`, total is `$80`, remaining after shows `4 left`, and catalog stock remains unchanged.
   - Click **Record payment**: records payment (HTTP 201), prepends to Payment queue, and decrements stock.
   - Visit `/shop`: shows `4 left` on Maple lamp.
   - Re-submit the same `ch_12345678`: returns HTTP 200 with `"replayed": true` without taking another unit off.
3. **Checkout (`/checkout`)**:
   - Add 1 `Field notebook` ($15) and click **Pay**: Payment in progress snapshot locks at `$15`.
   - Add 1 `Gel pen` ($4): `Cart total` updates to `$19`, `Amount due` remains `$15`, and the divergence banner appears:
     > *"Your cart changed after payment started. You will be charged the amount below."*
   - Click **Complete payment**: Order placed confirmation shows `$15` with only the Field notebook.

---

---

## Time Spent & Verification

- **Time spent:** Approximately **7.5 hours** total:
  - 1.5 hour: App Router architecture, route handlers, folder structures and Design.
  - 1.5 hour: Service creations.
  - 1 hour: In-memory shop page, Catelog Detail page
  - 2 hour: Desk and Checkout page development
  - 0.5 hours: Automated unit tests (Vitest + RTL) and end-to-end tests (Playwright).
  - 0.5 Deployment on Shared Hosting.
  - 0.5 hours: Multi-scenario test verification, documentation (`ARCHITECTURE.md`, `SERVER_VS_CLIENT.md`), and smoke checks.
- **Verification status:**
  - `npm test`: **6 / 6 passed** (100%)
  - `npm run test:e2e`: **7 / 7 passed** (100%)
  - `npm run typecheck`: **0 errors**

---

## AI Tools

- **ChatGPT / Claude / Gemini** — Used for Designing pages, writing test-cases, code improvisations, creating .md files and code commits.

- **Where I disagreed with the tool output:**
  1. *Caching mechanism:* An AI model suggested using Next.js `revalidateTag('catalog', 'max')`. I rejected this because Next's tag revalidation operates on a stale-while-revalidate model where the immediate next request can still serve stale data. Instead, I implemented an explicit process-local cached catalogue that is synchronously invalidated (`catalogCache = null`) on a successful payment, guaranteeing that the very next request is fresh.
  2. *Form clearing logic:* An AI draft cleared the extra dropdown only upon form submission. I adjusted this to reactive clearing: when the user selects `Maple lamp` in the dropdown, the form immediately resets and disables `Cushion`, preventing invalid configurations before submission.
