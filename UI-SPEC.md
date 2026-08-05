# Menuva — Complete UI Build Spec

**For: Claude Design.** Build the end-to-end UI for Menuva, a multi-tenant WebAR restaurant
ordering SaaS. The backend is **finished and live** — every endpoint below exists, is tested
(80/80 green), and the JSON shapes shown are **real captured responses**, not invented.

Your job: design and build the screens. Do **not** build API logic — leave a clean data layer
with typed stubs and I will wire it to the real backend.

---

## 0. What Menuva is

Diners scan a QR code on their restaurant table → join a shared **table session** → browse the
menu (with 3D/AR dish previews) → build a **collaborative cart** with everyone at the table →
place orders in "rounds" → watch the kitchen progress in realtime → split and pay.

Restaurant staff get a kitchen display, menu management, and analytics. The platform owner
(us) gets a SaaS admin surface.

### Four separate surfaces to build

| # | Surface | Users | Device | Auth |
|---|---------|-------|--------|------|
| **A** | **Diner PWA** | Guests at a table | Mobile-first, 390×844 | Diner token (Bearer) |
| **B** | **Kitchen Display (KDS)** | Kitchen staff | Tablet/desktop landscape, always-on | Staff cookie |
| **C** | **Restaurant Admin** | Owner, managers, editors | Desktop, responsive to tablet | Staff cookie |
| **D** | **Platform Admin** | Us (Menuva staff) | Desktop | Service key |

Brand accent: **`#C8760A`** (amber/orange). Mobile diner app should feel closer to a premium
food-delivery app than a POS. Kitchen must be glanceable from 2 metres away.

---

## 1. Global conventions — apply everywhere

### Money
**All money is an integer in paisa (minor units). Never a float.**
`150000` → display as **`PKR 1,500.00`**. Always divide by 100 for display, never do math on
the displayed value. Currency is per-restaurant (`PKR` for now).

### Ratios
Tax, service charge, and discounts are **basis points (bps)**. `1600` = 16%. `2000` = 20%.

### Response envelope
Every endpoint returns one of:
```jsonc
{ "ok": true,  "data": { ... } }
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { … } } }
```
Design a single toast/banner component driven by `error.code`. Codes you must handle:

| Code | HTTP | What the UI should do |
|---|---|---|
| `MISSING_TOKEN` / `INVALID_TOKEN` | 401 | Bounce to login (staff) or QR re-scan screen (diner) |
| `TOKEN_EXPIRED` | 401 | Silent refresh (staff), then retry |
| `SESSION_EXPIRED` | 401 | **Diner:** full-screen "This table session has ended — scan the QR code again" |
| `INSUFFICIENT_ROLE` | 403 | Hide the control entirely if role is known; toast if it slips through |
| `VALIDATION_ERROR` | 400 | Inline field errors — `error.details` is a Zod flatten: `{ fieldErrors: { price: ["..."] } }` |
| `RATE_LIMITED` | 429 | "Slow down" toast, disable the button ~5s |
| `NOT_FOUND` | 404 | Empty state |
| `INTERNAL_ERROR` | 500 | Generic error state + retry button |

### Auth — two completely different mechanisms

**Diner (Surface A):** `POST /api/auth/diner/join` returns a token in the body. Store it in
memory/localStorage and send `Authorization: Bearer <token>` on every request.

**Staff (Surfaces B & C):** `POST /api/auth/staff/login` sets **httpOnly cookies** and returns
**only** `{ role, restaurantId, branchId }` — **no token is readable by JS.** So:
- Every staff request must use `credentials: 'include'`.
- Store `role` in app state — **the entire admin nav is driven by it.**
- On 401, call `POST /api/auth/staff/refresh` once, then retry; if that fails → login screen.

**Platform (Surface D):** a service key pasted into a settings field, sent as Bearer. This
surface is internal-only, never public.

### Roles (drives all navigation and button visibility)
`owner` · `branch_manager` · `manager` · `kitchen` · `editor`

Design **one nav component** that filters items by role. Never render a control the role can't
use — the API will 403 it.

### Realtime (Supabase Realtime broadcast channels)
Two channels. Subscribe on mount, unsubscribe on unmount.

| Channel | Who subscribes | Events |
|---|---|---|
| `session:<sessionId>` | Diner app | `cart_updated`, `order_placed`, `order_status_changed` |
| `kitchen:<branchId>` | Kitchen display | `new_order`, `order_status_changed` |

**Design implication:** the cart is *collaborative* — another diner adding an item must appear
on your screen within ~1s, with a subtle highlight animation on the changed row. The kitchen
board must slide in new orders without a refresh, ideally with a sound cue.

### Order lifecycle (a state machine — show it consistently everywhere)
```
placed  →  preparing  →  ready  →  served
```
Use the same colour token per status across diner, kitchen, and admin.

### "Rounds" — an important domain concept
A table session has many orders, numbered `round: 1, 2, 3…`. If diners place again within
5 minutes, it merges into the current round instead of creating a new one. The bill groups
by round. Show "Round 2" as a visible grouping label in the bill and kitchen ticket.

---

## SURFACE A — Diner PWA (mobile-first, 390×844)

The flagship. Should feel fast, tactile, and slightly playful.

### A1. QR Landing / Join
**Route:** `/t/:qrToken` (from the physical QR code)
**API:** `POST /api/auth/diner/join`
```jsonc
// request
{ "qrToken": "…", "deviceId": "<generated, persisted>", "dinerName": "Sabih", "initials": "SK" }
```
**UI:** Restaurant name/logo, table code ("Table 7"), a single name input, optional avatar-colour
picker, big **"Join table"** button. Auto-derive initials from the name.
**States:** loading · invalid/expired QR (→ "Ask staff for a new code") · already joined (skip to menu).

### A2. Menu Browse — *primary screen*
**API:** `GET /api/menu` → **real shape:**
```jsonc
{ "categories": [ {
    "id": "…", "name": "Mains", "sortOrder": 1,
    "items": [ {
      "id": "…", "name": "Signature Burger", "description": null,
      "price": 150000, "emoji": null, "tag": "bestseller",
      "isSpicy": false, "isGlutenFree": false, "available": true,
      "has3d": false, "images": [],
      "modifierGroups": [ {
        "id": "…", "name": "Extras", "groupType": "add_on",
        "isRequired": false, "maxSelections": 2,
        "modifiers": [ { "id": "…", "name": "Extra Cheese", "priceDelta": 20000 } ]
      } ]
    } ] } ] }
```
**UI:** sticky category tab bar (horizontal scroll) · search · item cards with image, name,
price, and badges (`tag`, `isSpicy` 🌶, `isGlutenFree`, **`has3d` → a "View in 3D/AR" badge**).
`available: false` → greyed out, "Unavailable" chip, not tappable.
**Persistent bottom bar:** cart item count + running total + **"View cart"**.
**Empty state:** a category with `items: []` (this happens — handle it).

### A3. Item Detail / Modifier Sheet
**UI:** bottom sheet or full screen. Hero image, description, price.
**Modifier groups:** `isRequired: true` blocks the add button until chosen; `maxSelections`
caps checkbox selection; `groupType` is `variant` (radio, e.g. size) or `add_on` (checkbox).
Each modifier shows `priceDelta` as `+PKR 200.00`. Live-updating total at the bottom.
Quantity stepper, notes field ("no onions").
**Button:** **"Add to cart"** → `POST /api/cart/items`
```jsonc
{ "menuItemId": "…", "quantity": 2, "notes": "no onions",
  "modifiers": [ { "groupId": "…", "modifierId": "…" } ] }
```

### A4. 3D / AR Dish Viewer
Shown when `has3d: true`. **API:** `GET /api/menu/items/:itemId/images` plus the 3D model URLs
on the item.
**UI:** full-screen `<model-viewer>` with orbit controls, a studio backdrop, and a **"View on
your table (AR)"** button (uses `.glb` on Android, `.usdz` on iOS). Loading spinner with
progress — models are large. Fallback to a poster image if WebGL/AR is unsupported.
**Button:** "Add to cart" persists here too.

### A5. Upsell Prompt (overlay — appears after adding to cart)
**API:** `POST /api/upsell/suggestions`
```jsonc
{ "trigger": "add_to_cart", "triggerItemId": "…", "cartItemIds": ["…"],
  "declinedItemIds": [], "impressionsThisRound": 0 }
```
`trigger` ∈ `add_to_cart` | `cart` | `checkout`.
**UI:** a small non-blocking card — "Goes great with…" — 1–2 items, each with an **"Add"**
button and a dismiss ✕. Must auto-dismiss on a timer (backend config `autoDismissSeconds`).
**Every** show/accept/decline/ignore must fire `POST /api/upsell/events` with
`eventType` ∈ `upsell_shown` | `upsell_accepted` | `upsell_declined` | `upsell_ignored` —
this powers the upsell analytics, so don't skip it.

### A6. Collaborative Cart — *the differentiator*
**API:** `GET /api/cart` → **real shape:**
```jsonc
{ "members": [ {
    "memberId": "…", "name": "Dev Diner", "initials": "DD", "isCurrentUser": true,
    "items": [ { "id": "…", "menuItemId": "…", "name": "Signature Burger",
                 "quantity": 1, "modifiers": [], "unitPrice": 150000, "lineTotal": 150000 } ] } ],
  "summary": { "subtotal": 150000, "tax": 24000, "serviceCharge": 7500, "total": 181500 } }
```
**UI:** items **grouped by member**, each with an avatar chip + initials. Your own group is
labelled "You" and is editable; other members' items are **read-only** (view but don't touch).
Summary rows: Subtotal · Tax · Service charge · **Total** (bold).
**Buttons:** qty stepper → `PATCH /api/cart/items/:id`; swipe/trash → `DELETE /api/cart/items/:id`;
**"Place order"** (primary, sticky bottom).
**Realtime:** subscribe `session:<sessionId>` → on `cart_updated`, refetch and **highlight the
changed row** for ~1.5s. This is the screen where realtime matters most.
**Empty state:** "Nothing here yet — add something from the menu."

### A7. Place Order Confirmation
**API:** `POST /api/orders/place`
```jsonc
{ "idempotencyKey": "<fresh UUID generated client-side>", "kitchenNotes": "…" }
```
**⚠️ Critical:** generate the UUID **once** when the screen mounts and reuse it for retries.
Double-tap or a network retry must NOT create two orders. Disable the button after first tap.
**Response** includes `{ order: { id, round, status, subtotal, tax, total, lineItems: [...] } }`.
**UI:** a confirmation moment — order number, round badge, ETA, "Your food is on the way".

### A8. Order Status / Live Tracking
**API:** `GET /api/orders` (all rounds for this session)
**UI:** a stepper per round: `placed → preparing → ready → served` with the active step animated.
Show each round as a card with its line items and elapsed time.
**Realtime:** `session:<sessionId>` → `order_status_changed` updates the stepper live; consider
a haptic/toast when a round hits `ready`.

### A9. Bill & Split Payment
**API:** `GET /api/payments/bill` → **real shape:**
```jsonc
{ "rounds": [ { "id": "…", "round": 1, "status": "ready",
                "subtotal": 300000, "tax": 48000, "total": 348000 } ],
  "byMember": [ { "memberId": "…", "name": "Dev Diner", "subtotal": 760000 } ],
  "subtotal": 760000, "tax": 121600, "serviceCharge": 38000,
  "discounts": [], "total": 919600,
  "applicableOffers": [], "cardDiscounts": [] }
```
**UI:** rounds listed as collapsible groups, then a totals block. Two toggle views:
**"By round"** and **"By person"** (`byMember`).
**Offers:** render `applicableOffers` and `cardDiscounts` as selectable chips ("HBL Credit −15%").
**Split selector:** segmented control — **Full · Equal · By person · Custom**.
- `custom` reveals a per-member amount input; the sum must equal the total (validate live).
**Payment method:** Cash · Card · Wallet.
**Button:** **"Pay"** → `POST /api/payments`
```jsonc
{ "splitMethod": "custom", "method": "wallet",
  "allocations": [ { "memberId": "…", "amount": 250000 } ], "offerId": "…" }
```
`splitMethod` ∈ `full` | `equal` | `by_person` | `custom`; `method` ∈ `cash` | `card` | `wallet`.
> **Note:** no Stripe yet — this is a "request payment / mark paid" flow for the pilot. Design
> it so a real card-entry step can slot in later without a redesign.

### A10. Review
**API:** `POST /api/reviews` → `{ "rating": 5, "comment": "…" }`
**UI:** 5-star selector + optional comment, shown after payment. Skippable.

### A11. Session Ended
Triggered by a `SESSION_EXPIRED` 401 (staff closed the table). Full-screen, friendly, with a
"Scan again" prompt. **Every diner screen must be able to enter this state at any time.**

---

## SURFACE B — Kitchen Display (KDS)

Landscape tablet, always-on, high contrast, large type. **Glanceable from 2 metres.** Assume
greasy fingers and no mouse — touch targets ≥ 56px.

### B1. Kitchen Board — *the only screen that really matters*
**API:** `GET /api/kitchen/board` → **real shape:**
```jsonc
{ "orders": [ {
    "id": "…", "tableCode": "T1", "tableLabel": null, "round": 2,
    "status": "placed", "placedAt": "2026-07-24T08:05:24Z",
    "ageSeconds": 1422, "kitchenNotes": "table by the window",
    "lineItems": [ { "name": "Signature Burger", "quantity": 2,
                     "modifiers": [], "byMemberName": "Dev Diner" } ] } ] }
```
**Layout:** kanban columns — **Placed · Preparing · Ready** (served orders drop off).
**Ticket card:** big table code `T1`, `Round 2` badge, **live-counting age timer**, line items
with quantity ×, modifiers as sub-lines, `byMemberName` small, `kitchenNotes` highlighted.
**Age colour-coding (design these thresholds):** < 5 min neutral · 5–10 min amber ·
> 10 min red + pulse. This is the single most useful feature for a real kitchen.
**Button per ticket:** one big **"Advance →"** → `POST /api/orders/:orderId/advance`
with `{ "to": "preparing" }` (or omit `to` to auto-advance).
**Filters:** branch selector (multi-branch staff), status filter.
**Realtime:** `kitchen:<branchId>` → `new_order` slides a card in + optional sound;
`order_status_changed` moves cards between columns.
**Empty state:** "No active orders" — calm, not alarming.

---

## SURFACE C — Restaurant Admin (desktop)

Left sidebar nav, filtered by role. Sections below are marked with who can see them.

### C1. Login
**API:** `POST /api/auth/staff/login` → `{ email, password }`
Returns `{ role, restaurantId, branchId }` + httpOnly cookies. Store role → drive nav.
**Also design:** owner signup (`POST /api/auth/owner/signup` — name, email, password,
restaurantName, restaurantSlug) for self-serve onboarding.

### C2. Onboarding Wizard *(owner, first run)*
**API:** `POST /api/onboarding/bootstrap`
```jsonc
{ "branchName": "Main Branch", "branchSlug": "main", "tableCount": 8, "seedSampleMenu": true }
```
**UI:** 3 steps — restaurant details → first branch + table count → "seed a sample menu?"
Ends on a **QR codes ready to print** screen.

### C3. Dashboard / Home *(owner, branch_manager)*
**API:** `GET /api/analytics/sales?from=&to=`
```jsonc
{ "revenuePerDay": [], "aov": 0, "covers": 0, "topItems": [], "revenueByCategory": [] }
```
**UI:** KPI tiles (Revenue · AOV · Covers), a revenue line chart, top-items list,
category donut. Date-range picker + branch selector.
**⚠️ Empty arrays are the normal state for a new restaurant — design real empty states, not
spinners.** Copy: "No sales yet — your first order will show up here."

### C4. Live Orders *(all staff roles)*
Same data as the kitchen board but in a desktop table view, with an order detail drawer.

### C5. Menu Management *(owner, editor)*
**API:** `GET /api/menu` · `POST/PATCH/DELETE /api/menu/items` · `/api/menu/categories`
**UI:** two-pane — categories list (drag to reorder) | items table.
**Item editor (modal/drawer):**
`categoryId` (select) · `name` · `description` · **`price` (paisa — show a formatted PKR input
that converts)** · `costPrice` (used for margin analytics) · `tag` · `emoji` picker ·
`isSpicy` · `isGlutenFree` · `sortOrder`.
**Separate control:** price has its own endpoint `PATCH /api/menu/items/:id/price` — design it
as a distinct "Change price" action (it's audit-logged separately).
**Modifier group builder:** `PATCH /api/menu/items/:id/modifier-groups` — **full replace, not a
patch.** Nested repeater: groups (name, `groupType`: variant|add_on, isRequired, maxSelections)
→ modifiers (name, priceDelta). Drag to reorder.
**Media uploads:** multipart —
`POST /api/menu/items/:id/images` (field `file` + `altText`, `isPrimary`),
`/videos` (field `file` + `durationSec`),
`/3d-models` (fields **`glb` required**, `usdz` optional for iOS AR, `poster` optional).
Show upload progress; 50MB cap per file. Delete needs owner/branch_manager.

### C6. Branch Menu Overrides *(owner, branch_manager, kitchen)*
**API:** `PATCH /api/branches/:branchId/menu/:itemId/availability` `{ "available": false }`
`PATCH …/price-override` `{ "priceOverride": 135000 }` (null clears)
**UI:** per-branch matrix — item rows × branch columns, with an availability toggle ("86 this
item") and an optional override price. Kitchen staff need a **fast** "86 it" toggle.

### C7. Analytics *(owner; some branch_manager)*
Four tabs, all real endpoints:
- **Sales** — `GET /api/analytics/sales`
- **Menu performance** *(owner)* — `GET /api/analytics/menu-performance` →
  `{ matrix: [{ itemId, name, popularity, margin }], conversionLiftBps }` — design as a
  **popularity × margin quadrant chart** (stars / plowhorses / puzzles / dogs) + a
  **"3D viewing lift"** stat from `conversionLiftBps`.
- **Kitchen timing** — `GET /api/analytics/kitchen-timing` →
  `{ avgDeltas: { placedToPreparing, preparingToReady, readyToServed }, perItemTimes: [], peakHeatmap: [] }`
  → funnel of the three deltas, a slowest-items table, and a **dow × hour heatmap**.
- **Upsell** *(owner)* — `GET /api/analytics/upsell` →
  `{ acceptanceRateByTrigger: {}, upsellRevenue, sourceEffectiveness: {}, ignoreRate }`
  → acceptance rate per trigger, revenue attributed, ignore rate.
All four return **zeros/empty** on a fresh tenant — empty states are mandatory.

### C8. Branches & Tables *(owner, branch_manager)*
**API:** `/api/branches` CRUD · `/api/branches/:branchId/tables` CRUD ·
`POST /api/branches/:branchId/tables/:tableId/regenerate-qr` ·
`POST /api/tables/:tableId/close-session`
**Branch form:** name, slug, address, `opensAt`/`closesAt` (**strict `HH:MM`**), timezone, isActive.
**Tables:** grid of table cards (code, label, capacity, live/idle status).
**Buttons:** **"Show / print QR"** (big printable QR sheet — this is a real operational need),
**"Regenerate QR"** (destructive-ish: warns that the old printed code stops working),
**"Close session"** (force-ends diners' session → they get the A11 screen).

### C9. Staff Management *(owner)*
**API:** `GET /api/staff` · `PATCH /api/staff/:employeeId` · `DELETE /api/staff/:employeeId` ·
`POST /api/auth/staff/invite` `{ email, name, branchId, role }`
`role` ∈ `branch_manager` | `manager` | `kitchen` | `editor` (**owner is not invitable**).
**UI:** staff table (name, email, role badge, branch, active toggle) + invite modal.

### C10. Offers & Card Discounts *(owner, branch_manager)*
**API:** `/api/offers` CRUD · `/api/card-discounts` CRUD
**Offer form:** name, `discountType` ∈ **`percentage` | `fixed`**, `discountValue`
(**bps if percentage — `2000` = 20%; paisa if fixed**), validFrom/validUntil, isActive.
Design the input so the user types "20%" or "PKR 200" and the UI converts.
**Card discount form:** bankName, cardType, `discountBps`, validity, isActive.

### C11. Upsell Rules *(owner)*
**API:** `GET/PATCH /api/upsell/rules` · `/api/upsell/pairings` · `/api/upsell/affinity`
**Rules:** toggles + numeric steppers — isEnabled, maxSuggestionsAddCart/Cart/Checkout,
maxImpressionsPerRound, autoDismissSeconds, suppressAfterDecline, minimumSupportBps,
minimumLiftBps.
**Pairings:** "when they order **X**, suggest **Y, Z**" builder.
**Affinity:** category→category rules with priority.

### C12. Reviews *(owner, branch_manager, manager)*
**API:** `GET /api/reviews?rating=&dateFrom=&dateTo=&branchId=`
Rating distribution bar, filterable list.

### C13. Settings *(owner)*
**API:** `GET/PATCH /api/restaurant` → name, slug, `taxRateBps`, `serviceChargeBps`.
Show a live worked example: "On a PKR 1,000 order: tax PKR 160, service PKR 50, total PKR 1,210."

### C14. Audit Log *(owner)* & C15. Notifications *(owner, branch_manager)*
`GET /api/audit-log` — filterable timeline (who / what / when / old → new value).
`GET /api/notifications` — notification list + unread badge in the top bar.

---

## SURFACE D — Platform Admin (internal)

**Auth:** service role key. **API:** all under `/api/saas/*`.

- **D1. Tenants** — `GET /api/saas/tenants`, `/tenants/:id` — list every restaurant, drill in.
- **D2. Plans** — `GET/POST /api/saas/plans`, `PATCH /plans/:id` — name, price (paisa),
  `features` (freeform JSON — design a key/value editor), isActive.
- **D3. Subscriptions** — `GET /api/saas/subscriptions`, `PATCH /subscriptions/:id`
  → status ∈ `active` `past_due` `canceled` `trialing` `unpaid` `incomplete`
  `incomplete_expired` `paused`.
- **D4. Billing** — `GET /api/saas/billing`.
- **D5. Costs** — `GET/POST /api/saas/costs` — costType, amount, periodStart/End, optional
  restaurantId (omit = platform-wide).
- **D6. Platform Analytics** — `GET /api/saas/analytics` → **real shape:**
  `{ "analytics": { "totalGmv": 696000, "activeClients": 1, "churnAlerts": [] } }`
  → GMV tile, active clients tile, churn alert list.

---

## 2. Shared component inventory

Build these once and reuse:
`<Money>` (paisa→PKR) · `<StatusBadge>` (the 4 order states, one colour map) ·
`<RoleGate>` · `<EmptyState>` (icon + copy + optional CTA) · `<ErrorBanner>` (code-driven) ·
`<Toast>` · `<DataTable>` (sort/filter/paginate) · `<DateRangePicker>` ·
`<BranchSelector>` · `<ConfirmDialog>` (destructive actions) · `<FileUpload>` (progress, 50MB) ·
`<QRPoster>` (printable) · `<Stepper>` (order progress) · `<MemberAvatar>` (initials + colour) ·
`<PriceInput>` (PKR ↔ paisa) · `<BpsInput>` (% ↔ bps) · `<Skeleton>`.

---

## 3. Non-negotiables

1. **Every list has a designed empty state.** A fresh restaurant has zero of everything and
   analytics return `[]` / `0`. This is the *default* first-run experience, not an edge case.
2. **Every screen has loading + error states.** Skeletons over spinners.
3. **Role-driven nav.** Never show a control the role will get 403 on.
4. **Money and bps never rendered raw.** Always through `<Money>` / `<BpsInput>`.
5. **Diner app is a PWA** — installable, offline shell, works on mid-range Android.
6. **Accessibility:** ≥4.5:1 contrast (kitchen especially), 44px+ targets, keyboard nav on admin.
7. **Optimistic UI on cart mutations**, reconciled by the realtime `cart_updated` event.

---

## 4. What I need back

- Screen designs / components for all four surfaces.
- A **typed data layer with stubbed functions** — one function per endpoint, correct
  TypeScript types matching the shapes above, returning mock data. I'll swap the mocks for
  real `fetch` calls.
- Realtime subscriptions as **stubbed hooks** (`useSessionChannel`, `useKitchenChannel`) that
  I can point at Supabase Realtime.
- Auth handled as **two separate strategies** (Bearer for diner, `credentials: 'include'` for
  staff) — please don't unify them, the backend genuinely differs.

## 5. Out of scope (don't build)

Stripe/card entry · push notifications · multi-language/i18n · offline order queueing ·
printed-receipt formatting.

---

## 6. Reference

Backend repo: `menuva-backend`. Every endpoint above is live and testable right now via the
dev dashboard at **`http://localhost:4000/dev`** (click "Seed fresh tenant" → any endpoint).

> ⚠️ There is an `API-REFERENCE.md` in the backend repo — **it is stale and has wrong paths**
> (`/auth/session`, `/api/orders`, `/api/kitchen/orders`). **This document is the source of
> truth.** Ignore that file.
