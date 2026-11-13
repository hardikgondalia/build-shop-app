# Server-Side vs. Client-Side Rendering Architecture

This document provides an in-depth breakdown of the rendering strategy used in **Shop Counter**, explaining which pages and components run on the server versus the client, along with the technical and architectural rationale for each decision.

---

## 1. Architectural Philosophy: Server by Default

In modern Next.js App Router (React 19), components are **Server Components by default**. We adopt a strict boundary philosophy:

1. **Server Components (RSC)** handle data fetching, inventory cache interactions, database/in-memory store access, initial HTML rendering, search engine metadata, and security-sensitive computations (such as catalog pricing).
2. **Client Components (`"use client"`)** are pushed to the leaves of the component tree, used solely where interactive DOM behavior, event listeners, form state management (`react-hook-form`), or browser history manipulation are strictly necessary.

---

## 2. Route-by-Route Breakdown

### Summary Table

| Route | Primary Component | Render Mode | Leaf Interactive Components | Primary Reason |
| :--- | :--- | :--- | :--- | :--- |
| **`/` (Root)** | `src/app/page.tsx` | **Server** | None | Instant HTTP 307/308 redirect to `/shop` without client hydration. |
| **`/shop` (Catalogue)** | `src/app/shop/page.tsx` | **Server** (`force-dynamic`) | `SearchSort` (`"use client"`) | Fast initial paint, SEO-indexed catalogue, URL-driven filtering, and in-memory process memoization (`getCatalog()`). |
| **`/shop/[sku]` (Detail)** | `src/app/shop/[sku]/page.tsx` | **Server** (`force-dynamic`, `dynamicParams = false`) | None (Pure RSC) | Dynamic metadata (title/meta description), early HTTP 404 before streaming, zero client JS needed. |
| **`/desk` (Staff Desk)** | `src/app/desk/page.tsx` | **Server** (`force-dynamic`) | `DeskClient` (`"use client"`) | Server seeds initial recorded payments; Client handles complex form validation, preview, and queue state. |
| **`/checkout` (Checkout)** | `src/app/checkout/page.tsx` | **Server** (`force-dynamic`) | `CheckoutClient` (`"use client"`) | Server seeds available products; Client manages live editable cart, snapshot comparison, and multi-step payment. |
| **`/_not-found`** | `src/app/not-found.tsx` | **Server** (Static) | None | Standard HTTP 404 fallback page rendered on server. |
| **`/api/*` (Route Handlers)** | `src/app/api/.../route.ts` | **Server** (Node.js runtime) | None | Backend API endpoints (JSON only). Direct access to in-memory store. |

---

## 3. Deep Dive into Each Route

### A. `/shop` — Product Catalogue

- **Server-Side Work (`src/app/shop/page.tsx`)**:
  - Reads catalogue data via the memoized `getCatalog()` function.
  - Awaits `searchParams` (`q` and `sort`).
  - Filters matching products by name (case-insensitive) and sorts them (`name`, `price-asc`, `price-desc`) on the server.
  - Generates the complete HTML list with semantic markup (`<ul aria-label="Catalogue items">`, product names, formatted dollar prices, and inventory counts).
- **Client-Side Work (`src/components/search-sort.tsx`)**:
  - Mounts `<input type="search">` and `<select>`.
  - Maintains debounced input state (350ms) so rapid keystrokes don't trigger excessive server navigations or pollute the browser Back stack.
  - Calls `router.push()` to update the URL query string (`?q=...&sort=...`).
- **Why this split?**
  - **Direct URL & Back/Forward Support**: Navigating to `/shop?q=sto&sort=price-desc` directly delivers fully rendered HTML with *only* the Cedar Stool. Reloading preserves the view; hitting the browser Back button smoothly restores the previous server-rendered filter.
  - **Caching Efficiency**: Server-side filtering avoids shipping the entire unpaginated product catalog to the client. The data layer uses in-memory memoization (`getCatalog()`), ensuring repeat page requests do not trigger repeated store reads until an invalidating payment occurs.
  - **Lean Client Bundle**: The product cards, titles, prices, and links require zero client-side React state or event listeners.

---

### B. `/shop/[sku]` — Product Detail Page

- **Server-Side Work (`src/app/shop/[sku]/page.tsx`)**:
  - Pure Server Component (`"use client"` is not used anywhere on this page).
  - Implements `generateMetadata()`: Dynamically inspects the SKU and sets `<title><name> | Shop counter</title>` and a descriptive meta tag.
  - Uses `generateStaticParams()` with `export const dynamicParams = false`: Next.js validates the SKU parameter against the known catalog. Any unrecognized SKU immediately triggers `notFound()` and returns an HTTP 404 response header **before** response streaming begins.
  - Reads `getCatalog()`, formats price as whole USD, lists extras (or "None").
- **Client-Side Work**:
  - None. Only browser-native navigation and Next.js `<Link>` handling.
- **Why this split?**
  - **Search Engine Optimization & Social Sharing**: Dynamic metadata tags (`<title>`, `<meta name="description">`) must be present in the initial HTTP response for crawlers.
  - **Strict HTTP 404 Contract**: Returning an HTTP 404 status code (rather than a 200 with a client-rendered "Item not found" banner) is a hard architectural requirement. Doing this on the server guarantees standard HTTP semantics for monitoring and web spiders.
  - **Zero Hydration Overhead**: The product detail view is purely informative; there are no cart buttons or forms on this page. Sending zero client JavaScript for this page optimizes performance.

---

### C. `/desk` — Staff Payment Desk

- **Server-Side Work (`src/app/desk/page.tsx`)**:
  - Calls `getPayments()` from the store to retrieve initial recorded payments for this Node process.
  - Passes `initialPayments` as props to `<DeskClient />`.
- **Client-Side Work (`src/components/desk-client.tsx`)**:
  - Uses `react-hook-form` to track form state (`email`, `sku`, `extraCode`, `externalChargeId`).
  - Implements reactive form logic: When "Maple lamp" is selected, automatically clears and disables the "Cushion" extra option.
  - Manages submit button actions: Differentiates whether the staff clicked **Preview** or **Record payment**.
  - Renders inline field errors mapped from `validatePayment` (`role="alert"`, `aria-invalid`, `aria-describedby`).
  - Manages optimistic UI updates: Previews do not modify the queue; successful records prepend to the live payment list.
- **Why this split?**
  - **Instant Interactive Validation**: Staff members need instant feedback while typing and toggling items without full-page reloads.
  - **Initial SSR Payload**: Pre-populating the payment queue on the server ensures that on page refresh or direct navigation, existing transactions are immediately visible in the initial HTML.

---

### D. `/checkout` — Customer Checkout & Cart Snapshot

- **Server-Side Work (`src/app/checkout/page.tsx`)**:
  - Server Component reads `getLiveCatalog()` filtered for checkout-eligible SKUs (`notebook`, `pen`, `case`).
  - Passes official product names and prices to `<CheckoutClient products={products} />`.
- **Client-Side Work (`src/components/checkout-client.tsx`)**:
  - Manages live interactive cart state: Adding items, incrementing/decrementing quantities, removing line items, and computing the live `Cart total`.
  - Coordinates payment lifecycle:
    1. **Pre-Pay Validation**: Prevents opening an attempt if cart is empty.
    2. **Begin Attempt (`POST /api/checkout/begin`)**: Submits cart lines to server, receives frozen server attempt (`attemptId`, snapshot lines, snapshot amount).
    3. **Divergence Detection**: Compares live cart SKU/quantity tuples against the frozen snapshot lines. If they differ, displays the exact status message:
       > *"Your cart changed after payment started. You will be charged the amount below."*
    4. **Complete Payment (`POST /api/checkout/complete`)**: Completes the order using only `attemptId`.
    5. **Order Confirmation**: Displays "Order placed" with immutable snapshot lines and amount charged.
- **Why this split?**
  - **Client Needs High Fluidity**: Manipulating cart quantities requires instant, lag-free UI updates that would be sluggish if bounced through server actions.
  - **Server Controls Authoritative Pricing**: While the cart is edited on the client, pricing authority resides 100% on the server. The client cannot forge `unitPriceCents`. The snapshot frozen on the server at the moment "Pay" is pressed guarantees financial integrity.

---

### E. `/api/*` — Backend Route Handlers

- **Runtime**: Node.js Server Runtime (Next.js Route Handlers).
- **Files**:
  - `/api/catalog`: Uncached live store read.
  - `/api/debug/reads`: Returns current `catalogReads` cache-miss counter.
  - `/api/payments/preview`: Runs `validatePayment`; returns 200 preview or 400 validation error; zero side effects.
  - `/api/payments`: Runs `validatePayment`; idempotent charge handling (201 on new, 200 on replay); decrements stock; invalidates catalogue cache.
  - `/api/checkout/begin`: Validates cart, prices from catalogue, creates immutable frozen attempt.
  - `/api/checkout/complete`: Completes or replays order from stored attempt ID.
- **Why Server-Only?**
  - API routes represent the backend boundaries. They access `globalThis.__shopCounterStore` directly, enforce business constraints, and ensure data mutations are never exposed to client tampering.

---

## 4. Key Architectural Tradeoffs

### 1. `dynamic = 'force-dynamic'` vs. Static Prerendering with Tags
- **The Challenge**: The specification requires that `/shop` preserves URL search queries (`?q=`) and sorting (`?sort=`), while also requiring that requesting the same shop pages again while nothing has changed **does not increment `catalogReads`**.
- **Solution**: We force dynamic rendering for the page route so Next.js does not serve a stale pre-baked HTML snapshot for query strings, but we place explicit, versioned in-memory data memoization inside `getCatalog()`.
- **Result**: The HTML is freshly rendered per request to honor `searchParams`, but data fetching runs in $O(1)$ cached time without redundant store reads.

### 2. Live Cart vs. Server Attempt Snapshot
- A common flaw in naive checkout systems is charging `cart.total` at the end of a multi-step flow.
- By separating the **Live Client Cart** from the **Server Attempt Snapshot**, the customer can continue browsing and editing their cart without corrupting the active transaction amount.

