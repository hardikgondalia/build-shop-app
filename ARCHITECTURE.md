# Architecture — shop counter

This is deliberately a **single-Node-process exercise**. There is no database,
login, external payment provider, or durability guarantee. Prices are stored as
integer cents and formatted as whole US dollars only in the presentation layer.

## 1. Server/Client Split

| Route | Server work | Client work | Rationale |
| --- | --- | --- | --- |
| `/shop` | Server Component reads `getCatalog()`, parses `searchParams` (`q`, `sort`), filters/sorts, and renders semantic cards, prices, and stock badges. | `SearchSort` owns only input interaction: debounced `router.push` (350ms) for `q` and immediate navigation for `sort`. | Instant first paint, crawlable HTML, URL-driven filtering, and zero client hydration bundle for catalogue cards. |
| `/shop/[sku]` | Server Component reads the catalogue, renders product/extra details; `generateStaticParams` with `dynamicParams = false` guarantees unknown SKUs receive HTTP 404 before response streaming; `generateMetadata` supplies dynamic title and meta description. | Standard browser navigation only. | Strict HTTP 404 contract, search engine optimization, and zero client JavaScript. |
| `/desk` | Server Component reads the in-memory payment queue to pre-render initial rows into the HTML payload. | `DeskClient` uses `react-hook-form` to validate fields, auto-clear Cushion when Lamp is selected, toggle preview/record, display inline field errors, and optimistically update the queue. | Immediate interactive form feedback, client-side validation, and instant queue rendering without page refreshes. |
| `/checkout` | Server Component supplies the three saleable products and current catalogue prices. | `CheckoutClient` manages the live editable cart (+/- quantity steppers), requests frozen attempt snapshot, detects cart divergence, and triggers order completion. | Fluid client-side cart manipulation combined with strict server-authoritative financial calculation. |
| `/api/*` | Route handlers enforce business logic, shared validation via `validatePayment`, in-memory store mutations, and atomic attempt/order creation. | None (Backend JSON boundaries). | Prevents client tampering; centralizes data access and state transitions. |

## 2. Cache Choice and URL Search

I chose **explicit process-local, on-demand-invalidated data memoization**, rather
than Next.js page output caching or time-based/SWR revalidation. Both shop pages
export `dynamic = 'force-dynamic'` so URL-specific HTML is rendered per request.
Their one read function, `getCatalog()`, holds the immutable-by-convention
catalogue snapshot in a process-global store.

- **Cache Miss**: On the initial request, or after invalidation, `s.catalogCache === null`. The function fills it from live inventory and increments `catalogReads` once.
- **Cache Hit**: Subsequent requests reuse `s.catalogCache` in $O(1)$ time and do *not* increment `catalogReads`.
- **Payment Invalidation**: A successful *new* staff payment synchronously decrements inventory and resets `s.catalogCache = null`. The very next request to `/shop` or `/shop/[sku]` refills the cache, showing the updated remaining stock and incrementing `catalogReads` by 1.
- **Preview & Replays**: Preview reads without mutating; payment replays recognize the existing `externalChargeId` and return the original payment without deducting stock or invalidating the cache.

This intentionally uses no Next data-cache tag: `revalidateTag('catalog', 'max')`
can serve stale data while it revalidates, contradicting the next-request
freshness requirement. Rendering the entire search-specific HTML as a static
route would also conflict with server-side filtering by `?q=`. A URL update is
made after a short typing debounce so one search edit produces one useful Back
history entry. Sort is applied on the server; direct URLs and reloads work.

## 3. Checkout Guarantee: Server Snapshot vs. Live Cart

`/api/checkout/begin` inspects SKUs and positive integer quantities and **does not
read the client's `unitPriceCents`**. It prices each line strictly from the live
server catalogue, generates an immutable attempt ID, and freezes the attempt:

```typescript
const attempt: Attempt = Object.freeze({
  attemptId: randomUUID(),
  lines: Object.freeze(snapshotLines),
  amountCents,
});
```

The cart remains editable after "Pay" is pressed, but the frozen attempt does not
change. When the client detects divergence between the live cart and the snapshot
tuples, it renders the exact required notification:
> *"Your cart changed after payment started. You will be charged the amount below."*

When the user clicks "Complete payment", `/api/checkout/complete` accepts only the
`attemptId`. Any client-submitted line items or amounts in that body are completely
ignored. The resulting order is constructed directly from the stored attempt snapshot.
A replay returns the identical order ID and total. Charging the live cart instead
would introduce severe race conditions, allowing prices or quantities added after
payment began to be charged unexpectedly.

## 4. Failure Modes in Multi-Instance Serverless

The global store lives in `globalThis.__shopCounterStore` and is shared only
**within one single Node process**. In a serverless environment (such as Vercel):
1. **Isolated State**: Sequential requests may land on distinct serverless instances, each holding its own independent initial inventory, miss counter, payment queue, and attempt map.
2. **Missing Attempts**: An attempt created via `/api/checkout/begin` on Instance A will not exist on Instance B, causing `/api/checkout/complete` to return a 404 `unknown_attempt`.
3. **Double Spending**: Concurrent requests on separate instances can each claim the last remaining stock unit or accept the same `externalChargeId`.
4. **Cold Starts**: When instances scale to zero, all recorded payments and checkout histories are lost.

### Production Replacement Architecture
In a production deployment, this in-memory singleton would be replaced with:
- **Durable Relational Database (PostgreSQL)**: Storing inventory, payments, and checkout attempts with `SERIALIZABLE` or `READ COMMITTED` transactions and row-level locks (`SELECT ... FOR UPDATE`) to prevent overselling.
- **Unique Constraints**: Unique database indices on `external_charge_id` and `attempt_id` to guarantee idempotency across all cluster nodes.
- **Shared Invalidation Cache (Redis)**: Storing the serialized catalogue with atomic invalidation pub/sub across all server nodes upon payment capture.
- **Idempotency Keys & Webhooks**: Reconciling payments with an actual payment provider (e.g., Stripe) using cryptographically verified webhooks.

## 5. Accessibility (a11y) Checks

The application markup was engineered for WCAG AA compliance:
- **Landmarks & Hierarchy**: `<header>`, `<nav aria-label="Main navigation">`, `<main>`, `<footer>`, with exactly one logical `<h1>` per view.
- **Forms & Error Associations**: All input fields have explicit `<label htmlFor="...">` associations. Validation errors are linked programmatically via `aria-invalid` and `aria-describedby` pointing to `<p id="..." role="alert">`.
- **Live Announcements**: `role="status"` is applied to search empty states, payment notices, and cart divergence callouts so screen readers announce dynamic updates.
- **Interactive Controls**: Stepper buttons in checkout specify accessible names (`aria-label="Increase Field notebook"`, `aria-label="Decrease Field notebook"`, `aria-label="Remove Field notebook"`).
- **Focus Rings & Contrast**: All interactive elements feature high-visibility `:focus-visible` outline rings with 2px offset. Color contrast ratios between text (`#2c1a12`, `#1f1b18`, `#6e655d`) and surfaces (`#ffffff`, `#faf8f5`) exceed the 4.5:1 WCAG AA threshold for body text and 3:1 for components.
- **Automated Test Assertions**: React Testing Library and Playwright suites assert against semantic roles (`getByRole("list")`, `getByRole("searchbox")`, `getByRole("region")`, `getByRole("status")`, `getByRole("alert")`) rather than fragile CSS selectors.
