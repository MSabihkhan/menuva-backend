# Menuva Backend — Read & Test Guide

A short walkthrough to **read** each API and then **test** it, in the order a real
diner+kitchen session actually happens. Work top to bottom.

---

## The fast way: the API dashboard

```bash
npm run dev
```
Then open **<http://localhost:4000/dev>** and click **Seed fresh tenant**.

That's it — no copy-paste, no tokens, no UUIDs. The dashboard seeds a throwaway
restaurant (menu, 5 tables, an open diner session), mints a token for every role, and
gives you a clickable button for every endpoint in the backend. Menu items appear as
dropdowns by name; IDs like `orderId` and `cartItemId` are captured from responses
automatically and reused by later calls.

- **▶ Run full flow** walks the whole diner → kitchen → analytics journey and prints a
  pass/fail line per endpoint, including an RBAC check that must return 403.
- Click any endpoint to inspect it individually: editable request body, live response,
  status code and timing.

It's dev-only — `app.ts` mounts `/dev` only when `NODE_ENV !== 'production'`.

---

## The manual way: start it up

```bash
npm run dev          # Terminal 1 — server on http://localhost:4000
npm run seed:dev     # Terminal 2 — seeds a throwaway tenant, prints tokens + IDs
```

`seed:dev` prints a copy-paste block: **owner login**, a **diner token**, **editor/kitchen
tokens**, **table QR tokens**, and the restaurant/table UUIDs. Keep that block open — every
request below uses something from it.

Base URL for everything: `http://localhost:4000/api`

> **[requests.http](requests.http)** has a ready-to-run request for every endpoint in the
> backend — correct paths, correct headers, and a real JSON body pulled straight from each
> route's Zod schema. Open it in VS Code (REST Client extension) and click "Send Request" on
> any block, or `File > Import` it into Thunder Client / Postman. Paste your `seed:dev` output
> into the `@variables` at the top once, then every request below is one click.

---

## How to read the code (the one pattern that repeats everywhere)

Every endpoint flows through the same 5 hops. To understand any API, open these 5 files
for it in order:

```
routes/*.routes.ts   → which path + which middleware (auth, validate)
schemas/*.schema.ts  → the exact request body/query (Zod = source of truth)
controllers/*.ts     → reads req.auth / req.db, calls the service, shapes the response
services/*.ts        → orchestration (usually thin)
models/*.ts          → the actual Supabase calls / SQL RPCs
```

The route map is [src/routes/index.ts](src/routes/index.ts). Auth + the tenant-scoped DB
client (`req.db`) are attached by middleware — read [src/middleware](src/middleware) once and
it applies to every route.

**Response envelope:** success `{ ok: true, data }`, error `{ ok: false, error: { code, message } }`.
Money is always integer **paisa** (e.g. `150000` = PKR 1,500.00).

---

## Test each API — in demo-flow order

For each: **read** the 5 files, then **fire** the request and check the expectation.

### 1. Health — `GET /health`
- **Read:** `health.routes.ts` → `health.controller.ts`
- **Test:** [requests.http #16a](requests.http) → `200`. Stop the server, hit it again → `503`.
  That proves the DB probe, not just "server up".

### 2. Menu (diner) — `GET /menu`
- **Read:** `menu.routes.ts` → `menu.controller.ts` → `menu.model.ts`
- **Test:** [requests.http #2a](requests.http) (diner token) → `200`, categories + items.
  The token scopes the restaurant — no ID in the URL. Section 2 also has every menu-editing
  endpoint (create/update item, price, categories, modifiers, branch availability/overrides).

### 3. Diner join (mint a fresh session) — `POST /auth/diner/join`
- **Read:** `auth.routes.ts` → `schemas/auth.schema.ts` (`dinerJoinSchema`) → `auth.controller.ts`
- **Test:** [requests.http #1e](requests.http) → `200` with a `sessionToken`. (You can also
  just reuse the diner token the seed already printed — this endpoint is for testing the join
  itself.)

### 4. Cart — `GET /cart`, `POST /cart/items`
- **Read:** `cart.routes.ts` → `schemas/cart.schema.ts` (`addToCartSchema`) → `cart.controller.ts` → `cart.service.ts`
- **Test:** [requests.http #3a–3d](requests.http) (diner token) — add, view, update qty/notes,
  remove. Totals are in paisa; modifiers/quantity change them.

### 5. Place order — `POST /orders/place`
- **Read:** `orders.routes.ts` → `schemas/orders.schema.ts` (`placeOrderSchema`) → `orders.controller.ts` → `orders.service.ts`
- **Test:** [requests.http #4a](requests.http) (diner token) → `200`, an order is created from
  the cart. **Re-send the exact same body** (same `idempotencyKey`) → must NOT create a second
  order (idempotency). Sending again within 5 min → round-merge behavior. This is the endpoint
  most worth reading.

### 6. Kitchen — `GET /kitchen/board`, `POST /orders/:orderId/advance`
- **Read:** `kitchen.routes.ts` → `kitchen.controller.ts`
- **Test:** [requests.http #5a](requests.http) (kitchen token) → your order shows as `placed`.
  Then [#5b](requests.http) → status steps `placed → preparing → ready → served`.

### 7. Analytics — owner only
- **Read:** `analytics.routes.ts` → `schemas/analytics.schema.ts` → `analytics.controller.ts` → `analytics.model.ts`
- **First get an OWNER token** (the seed only prints editor/kitchen, which correctly get **403**
  here): [requests.http #1b](requests.http) with the printed owner email/password — paste the
  returned token into `@ownerToken`.
- **Test:** [requests.http #6a–6e](requests.http) (owner token) — sales, menu-performance,
  kitchen-timing, upsell, per-branch. All → `200`. **Empty arrays are correct** until orders
  exist. After step 5–6, run `select run_end_of_day();` in the Supabase SQL Editor to
  repopulate the matviews, then re-hit these to see real numbers. Same endpoints with the
  kitchen token → **403** (RBAC).

### 8. SaaS platform — `GET /saas/analytics`
- **Read:** `saas.routes.ts` → `saas.controller.ts` → `saas.model.ts`
- **Test:** [requests.http #15k](requests.http) → `200` with `totalGmv`, `activeClients`,
  `churnAlerts`. **Not a staff token** — this whole section uses your Supabase
  `SUPABASE_SERVICE_ROLE_KEY` as the Bearer token instead (see `@serviceRoleKey` at the top of
  section 15).

### 9. Everything else
Sections 7–14 of `requests.http` cover the rest of the surface not in the core demo flow:
upsell engine, payments/bill-splitting, reviews, offers & card discounts, restaurant/branch/
table CRUD, staff management, onboarding bootstrap, and media (image/video/3D-model) uploads.
Same pattern applies — read the matching `routes.ts` → `schema.ts` → `controller.ts`, then fire
the request.

---

## Gotchas (each of these looks like a bug but isn't)

1. **Port is 4000**, not 3000 (3000 is the frontend demo).
2. **403 on analytics with the seed's tokens is correct** — they're editor/kitchen. Use an
   owner token (step 7).
3. **Empty analytics = no orders yet.** Place orders, then `run_end_of_day()` to refresh.
4. **Every request needs `Authorization: Bearer <token>`** except `/health`.
5. `seed:clean` removes throwaway tenants when you're done.

---

## When something's off

The error envelope tells you where to look: `AUTH_*`/`403` → middleware or the RPC role check;
`VALIDATION_*` → the Zod schema; `INTERNAL_ERROR`/`500` → the model's Supabase call. Read the
matching layer from the 5-hop list above.
