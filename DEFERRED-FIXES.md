# Menuva — Deferred Fixes & Tech Debt

Things known to need attention but **deliberately not fixed yet** — either they're
user actions, deployment-time decisions, or lower-priority cleanup. Everything that
was an *active bug in a verified flow* has already been fixed (see "Already fixed"
at the bottom).

Last updated: 2026-07-26. Priority: 🔴 do before pilot · 🟠 do before real users ·
🟡 cleanup / correctness · 🟢 scale / later.

---

## 🔴 1. Rotate the exposed Supabase credentials  *(USER ACTION)*

`menuva-backend/.env.test` contains **live** secrets for project
`jmmtajrnpmcivkndagnq` — anon key, **service-role key**, and JWT secret — and they
were read into working sessions during development. The service-role key bypasses
RLS entirely.

**Action:** Supabase dashboard → Settings → API → rotate the service-role key and
JWT secret; update `.env` / `.env.test`. Do this before the repo is shared or
deployed. (Not something code can fix.)

Also review `menuva-frontend/.env.local` — it holds the anon key + URL (public, so
lower risk, but should not be committed to a public repo).

---

## 🟠 2. Production cookie / CORS topology

Staff auth uses httpOnly cookies with `sameSite: 'strict'`. In dev this works
because the Next frontend proxies `/api` → backend, so everything is same-origin.

**In production**, if the frontend and API are served from **different origins**,
`sameSite: 'strict'` cookies will NOT be sent on those requests and staff login
will silently fail. Decide at deploy time:
- keep a same-origin proxy (simplest), **or**
- switch to `sameSite: 'none'` + `secure: true` + CORS `credentials` + an explicit
  allowlist that includes the frontend origin.

Files: `src/controllers/auth.controller.ts` (`COOKIE_OPTIONS`),
`src/middleware/security.ts` (CORS allowlist).

---

## 🟡 3. Signup tests flake on Supabase's email-send rate limit

The owner-signup tests create real Supabase auth users, which trigger confirmation
emails. Under rapid repeated `npm test` runs, Supabase's email-send rate limit
(`over_email_send_rate_limit`) kicks in and a signup can return 500 instead of 200.
The signup service already special-cases that code, but the happy-path test can still
flake. Low priority; only bites when hammering the suite. Consider stubbing the email
send or asserting a 200-or-rate-limited outcome.

## ✅ ~~3b. Real staff-auth integration test~~ — DONE

Was: the suite minted HS256 tokens directly and never did a real Supabase login, so
the ES256 P0 passed 80/80 while broken. **Fixed:** `tests/auth.test.ts` now has a
regression test that does a real `POST /auth/staff/login` and calls a staff-only
endpoint using *only* the returned httpOnly cookie — exercising verifyToken's ES256 →
JWKS path. If auth ever reverts to HS256-only, this test fails. (81/81 green.)

---

## 🟡 4. Regenerate `database.types.ts` and drop `as any` casts

`src/models/analytics.model.ts` still has ~7 `as any` casts because the generated
types predate the analytics RPCs/columns (`get_kitchen_item_timings`,
`get_order_heatmap`, `item_performance.category_id`, etc.), and after the
`20260719` RPC changes the `place_order` / `get_upsell_suggestions` shapes changed too.

**Action:** regenerate types from the live DB (`supabase gen types typescript`),
then remove the casts.

---

## 🟡 5. Migration ↔ live-DB drift (reproducibility)

`place_order` alone accumulated **7** fix migrations (`fix_place_order` →
`real_fix_5`) plus the final `20260719...`. That much iteration means the migration
history and the live DB drifted apart at points (same root issue as the analytics
matviews earlier). The `20260719` migration re-asserted the correct `place_order`
and `get_upsell_suggestions` via `CREATE OR REPLACE`, and both were verified live —
but the rest hasn't been audited.

**Action:** introspect every RPC / matview on the live DB
(`pg_get_functiondef`, `pg_matviews`) and confirm each matches a migration file, so a
fresh project rebuilds identically. Consider squashing the `place_order` fix chain
into one authoritative definition.

---

## 🔴 5b. Pending migration: `20260804000000_branch_menu_items_optional.sql`  *(USER ACTION)*

Written but **not yet applied** — the CLI push was blocked in the session that
wrote it. Until it runs, `place_order` still silently drops any dish that has no
`branch_menu_items` row (i.e. anything an owner created through the admin
console): the line vanishes from the ticket, the kitchen never sees it, and the
table is under-charged with no error. The API-layer half of the same bug
(`cart.model.getMenuItemsForCart`, add-to-cart 404 + cart totals) is already
fixed in TypeScript and live.

```bash
cd menuva-backend && npx supabase db push --yes
```

Note `db push` will also re-apply `20260719000000` (pure `CREATE OR REPLACE`,
already live — harmless). The two `20260712*` analytics migrations sort *before*
the last remote migration and need `--include-all`; they were applied ad hoc, so
the bookkeeping is still drifted (see item 5).

---

## 🟠 5c. `POST /menu/items` doesn't create `branch_menu_items` rows

Only dev seeding and onboarding create them. Everything downstream now tolerates
a missing row ("available at base price"), so diners are unblocked — but the
**owner** side still can't manage such an item per branch:
`menu.model.updateBranchMenuItemAvailability` / `...PriceOverride` use `.update()`,
so the admin console's 86 toggle and price override return 404 for any dish the
owner created themselves.

**Action (owner-side write path — deliberately not changed yet):** insert a
`branch_menu_items` row per live branch on item create, and backfill existing
orphans. Alternatively switch those two model functions to upsert.

---

## 🔴 5d. Owner signup cannot complete end-to-end  *(USER ACTION)*

Found by driving the admin portal from scratch. Two separate blockers:

1. **The project's confirmation-email quota is exhausted.** Supabase returns
   `429 over_email_send_rate_limit`, so `signUp` creates **no user at all**.
   (The service used to swallow this and return `{needsEmailConfirm: true}` —
   see "Already fixed" — so owners were told to check an inbox that would never
   receive anything, and no restaurant was ever provisioned. It now returns 503.)
   The quota is exhausted because the project has **832 auth users** from past
   test runs, each having triggered a confirmation email.
2. **"Confirm email" is ON and nothing in the app handles confirmation.** Even
   with quota available, a new owner receives a link, and there is no route that
   completes the flow and lands them in the console.

**Action (pick one):**
- Turn **Auth → Providers → Email → "Confirm email" OFF** on the test project.
  Signup then returns a session immediately and the owner can log straight in.
  Simplest for pilot; revisit before public launch.
- Or configure **custom SMTP** (Auth → Settings) to lift the quota, and build a
  confirmation landing route.

Note the provisioning itself is fine: a trigger keyed off
`user_metadata.signup_role = 'owner'` creates the `restaurants` row and stamps
`app_metadata.restaurant_id` / `role`. Verified working. **That trigger is not
in any migration file** — more drift, see item 5.

Also: Supabase rejects `@example.com` (and other MX-less domains) with
`email_address_invalid`. Seeds/tests that use it must switch to a deliverable
domain; the signup service now maps that to a clean 400 instead of a 500.

---

## ✅ ~~5e. Staff invite creates no login~~ — FIXED

`staffInvite` now creates the Supabase auth user itself (with `email_confirm:
true`, a generated one-time password, and `app_metadata` carrying
restaurant/role/branch/employee) and links `employees.user_id` to the real id,
instead of calling `inviteUserByEmail` and swallowing the failure. The response
returns `{ employeeId, email, temporaryPassword }`, and the Staff section shows
the credentials once with a Copy button. Verified live: invite → worker logs in
→ gets `role: kitchen` + correct branch → reaches `/kitchen/board` → is
correctly refused owner-only endpoints (403).

Was:

## 🔴 5e-old. Staff invite creates no login — invited workers can never sign in

`POST /auth/staff/invite` returns 201 and the Staff section lists the person as
**Active**, but no Supabase auth user is created. The `invite_staff` RPC writes
a random UUID into `employees.user_id` that references nothing:

```
employees.user_id 3bac93b6-bb60-4631-8df2-487b18b2a40d -> NO AUTH USER (404)
```

So kitchen/manager staff have a row, a role and a branch membership, but no
account, no password, and no way to reach the KDS or the console. Whole
"set up access for workers" path is non-functional past the invite call.

**Action:** create the auth user in `authService.staffInvite` *before* calling
the RPC, and pass the real id in. Two shapes, pick one:
- `supabaseAdmin.auth.admin.inviteUserByEmail(...)` — proper invite email, but
  it is subject to the same email quota as 5d.
- `supabaseAdmin.auth.admin.createUser({ email_confirm: true, password })` and
  surface a one-time password to the owner — no email dependency.

`invite_staff` also needs to stop inventing a `user_id` when none is supplied.

---

## ✅ ~~5f. Admin console has no modifier / variant / add-on editor~~ — DONE

Built. Menu management → **Modifiers** (per item, with a count badge) opens an
editor for groups and options: variant vs add-on, required, max selections, and
per-option price deltas entered in rupees. `getManageMenu` now returns
`modifierGroups` (the per-item `GET /menu/items/:id` is diner-only, so the
console previously had no way to read them at all), and `useStaffMutation`
returns the response body so callers can use it.

Verified end-to-end: owner adds a required "Size" variant (Regular / Large +80)
alongside the existing add-ons → diner menu shows both groups with the right
type/required/max → ordering Large + Extra Ice Cream priced at 59000 paisa
(390 branch-override + 80 + 120), matching the order line snapshot exactly.

Was:

## 🟠 5f-old. Admin console has no modifier / variant / add-on editor

The item editor covers category, name, description, price, cost, tag, emoji,
spicy and gluten-free — but nothing for modifier groups. There is no API
wrapper, no type, and no UI anywhere in `menuva-frontend/src/components/admin`.

The backend endpoint exists and now works (`PATCH /menu/items/:itemId/modifier-groups`
— it was 500ing on a wrong column name, see "Already fixed"), and the diner
item screen already renders variants and add-ons. So the capability is live on
both ends with no way for an owner to actually configure it: sizes, extras and
paid add-ons can only be created by direct API calls.

**Action:** add a modifier-groups editor to `MenuSection`'s item modal, backed
by a new `replaceModifierGroups(itemId, groups)` wrapper. Read the current
groups from `GET /menu/items/:itemId` (the `menu/manage` payload does not
include them).

---

## 🟡 5g. Upsell rules: BPS fields are labelled BPS but rendered as percentages

In Upsell rules, `MIN SUPPORT (BPS)` shows `1%` and `MIN LIFT (BPS)` shows
`100%` (from `100` and `10000` bps). The label and the value disagree, so an
owner editing these will enter the wrong magnitude. Pick one unit and make the
label, the input and the display agree.

---

## 🟡 6. Menu endpoint doesn't expose 3D/AR model URLs

`getAssembledMenu` (`src/services/menu.service.ts`) returns only `has3d: boolean`,
not the actual `.glb` / `.usdz` / poster URLs. The diner AR viewer
(`menuva-frontend/.../ArScreen.tsx`) therefore falls back to a placeholder GLB.

**Diner half — ✅ DONE.** `getAssembledMenu` now returns
`models3d: { glbUrl, usdzUrl, posterUrl } | null` alongside `has3d`, and
`ArScreen.tsx` renders the real model (verified live with an owner-uploaded
`.glb`). `PLACEHOLDER_GLB` is gone. The viewer also gained a camera-anchored
"view on your table" mode and an emoji fallback for items with no model.

**Still open:** the staff `GET /menu/manage` payload carries only `has3d`, so the
admin media UI can't show an already-uploaded model. Add the URLs there too, plus
`GET .../3d-models` and `GET .../videos` list endpoints (see the Media-upload
note below).

---

## 🟡 7. `place_order` swallows modifier-lookup errors

The `EXCEPTION WHEN OTHERS` fallback in `place_order` (migration `20260719...`)
snapshots the **base price** if the modifier join throws. Correct as a safety net,
but it fails *silently* — a future schema change could reintroduce modifier
under-charging with no signal.

**Action:** log a warning (or write an audit/event row) when the fallback fires,
so silent under-charging can't recur unnoticed.

---

## 🟡 8. Rewrite / delete `API-REFERENCE.md`

It's auto-generated and has wrong paths (banner added pointing to the real sources).
Either regenerate it from `src/routes/*` or delete it in favour of `requests.http` +
`UI-SPEC.md`.

---

## 🟢 9. Rate limiters are in-memory (single-instance only)

`src/middleware/security.ts` limiters (`globalRateLimiter`, `authLimiter`,
`dinerLimiter`, `writeLimiter`) store counters in process memory — they won't share
state across instances. Already marked `TODO(scale): Redis store` in code. Move to a
Redis store before running more than one backend instance.

---

## 🟢 10. Explicitly deferred to post-pilot

- **Stripe / payments** — the bill flow currently "requests payment / marks paid";
  card entry is stubbed to slot in later (`BillScreen.tsx`).
- **Push notifications** — sending not implemented.
- **Swagger / OpenAPI** and **CI/CD** — not set up.

---

## 🟠 11. Platform admin holds the service-role key in the browser

The Platform surface (`menuva-frontend/.../platform`) authenticates to `/saas/*`
by sending the **Supabase service-role key** as a Bearer token — because that's
what the backend's `requireServiceKey` expects. The frontend keeps the key in
**sessionStorage** (tab-lifetime only, never localStorage) and shows a warning on
the gate, but this is still the RLS-bypassing key living in a browser.

**Acceptable only as an internal-operator tool on a trusted machine.** Before this
surface is exposed beyond the founders, replace it with a proper control-plane
auth: a separate platform-admin login (its own Supabase project or an allow-listed
staff role) that mints a short-lived platform token server-side, so the raw
service key never reaches any browser. Files: `src/lib/api/platform.ts`,
`src/lib/platform-session.tsx`, backend `src/routes/saas.routes.ts`.

---

## Frontend — remaining build (not bugs, just not built yet)

- **Admin console** — ✅ **DONE.** All 13 sections built & verified live:
  Dashboard, Live orders (read-only status board, 5s poll), Menu management
  (working item editor), Branch overrides (86 + per-branch price), Analytics
  (menu-performance / kitchen-timing / upsell tabs + heatmap), Branches & tables
  (CRUD + **QR posters**, print), Staff, Offers & card discounts (CRUD),
  Upsell rules (engine settings + manual pairings + category affinity), Reviews,
  Settings, Audit log, Notifications. `StubSection.tsx` is now unused (safe to
  delete).
- **Platform admin** — ✅ **DONE.** 6 sections built & verified: Overview
  (GMV / active clients / churn), Tenants, Plans (CRUD), Subscriptions (status
  transitions), Billing, Ops costs (CRUD). Service-key gate — see item #11.
- **Onboarding wizard** — ✅ **DONE.** First-run wizard (branch → tables → sample
  menu → success with table list) shown automatically to an owner with no live
  branch; runs `POST /onboarding/bootstrap`. Verified live end-to-end (including
  the empty-branch gate and the completion guard that prevents a re-loop).
- **Media-upload UI** — ✅ **DONE.** Per-item "Media" modal in Menu management,
  three tabs: **Images** (upload/list/delete, primary badge — fully backed by
  `GET /menu/items/:id/images`), **Video** (upload/replace/delete), **3D/AR**
  (glb required + optional usdz + poster). Multipart verified through the Next
  `/api` proxy (201 + real Supabase Storage URL, staff cookies forwarded).
  - **Known limitation (backend gap):** there is no *list* endpoint for videos or
    3D models — the manage-menu payload only exposes `has3d: boolean`. So the
    Video/3D tabs can only show/remove an asset uploaded **in the current
    session**. To make these fully manageable, add `GET /menu/items/:id/videos`
    and `GET /menu/items/:id/3d-models` (or include their rows/URLs in
    `getManageMenu`). Ties into item #6 below.
- Note the QR poster derives the join URL from `qr_token` when `qr_code_url` is
  null (seeded tables) — matching the backend's `https://menuva.app/t/<token>`
  scheme; see also item #6 (3D model URLs on the menu).
- Minor: `KitchenBoard.tsx` `load()` shows an empty board on non-auth fetch errors
  (network blips) rather than an error state — acceptable, but could be nicer.
- Added the `qrcode` dependency to `menuva-frontend` for poster generation
  (`npm audit` reports transitive advisories in its deep deps — low priority, dev
  tooling; revisit if it ships to end users).

---

## 🟡 12. Upsell has no data to work with

`POST /upsell/suggestions` returns `{"suggestions": []}` on a fresh tenant: the
engine needs owner-configured pairings (`upselling_combinations`), enough order
history for `item_pair_scores`, or `cost_price` set on items for the margin
fallback. Nothing is broken — the diner overlay simply never appears. Seeding a
couple of pairings during onboarding would make the feature visible from day one.
`UpsellSuggestion.reason` is also returned but not rendered in the overlay.

---

## ✅ Already fixed this cycle (for reference)

- Analytics reproducibility — captured ad-hoc SQL into `20260712200000_analytics_completions.sql`; matviews populated; CI refreshes them.
- **Modifier price bug** — `place_order` now sums real `modifiers.price_delta` (was snapshotting base price, under-charging every order with paid modifiers).
- **Upsell 500** — `get_upsell_suggestions` used non-existent `item_pair_scores` columns; now uses `item_a`/`item_b`.
- **Staff auth P0** — real Supabase tokens are ES256; backend only did HS256. Now verifies ES256/RS256 against Supabase JWKS via Node `crypto` (no ESM dep).
- Login cookie `secure` is prod-only (was blocking dev login over http).
- `auth.test.ts` used a hardcoded email → non-idempotent; now unique per run.
- Diner `restaurantName` now returned by `GET /menu` for the header.
- **Staff menu-list gap** — the diner `GET /menu` is diner-only *and* branch-scoped
  (owners have no branchId), so admin had no way to list the menu. Added
  `GET /menu/manage` (staff, restaurant-level, includes `costPrice`/`categoryId`).
- **Onboarding resurrected soft-deleted branches** — `bootstrapTenant`'s
  "does a branch exist?" check didn't filter `deleted_at`, so re-onboarding after a
  branch deletion reused the dead row (leaving `deleted_at` set) and the tenant
  ended up with **no visible branch**. Now filters `deleted_at is null` so a
  deleted branch means "start fresh". (`src/models/onboarding.model.ts`)
- **Owner signup silently faked success** — when Supabase returned
  `429 over_email_send_rate_limit`, `ownerSignup` logged "Pretending success"
  and returned `{needsEmailConfirm: true}`. No auth user was created, no
  restaurant was provisioned, and the owner was told to check their email. Now
  returns 503 with a retry message; `email_address_invalid` maps to a 400
  instead of a 500; and a 2xx with no `user` is treated as failure rather than
  success. (`auth.test.ts` had been asserting the faked-success behaviour and
  was updated to match.)
- **Menu modifiers could never be saved** — `replaceModifierGroups` inserted
  `modifier_group_id`, but the `modifiers` column is `group_id`. Every attempt
  to attach variants or add-ons to a dish failed with
  `Could not find the 'modifier_group_id' column of 'modifiers' in the schema
  cache`. (`src/models/menu.model.ts`)
- **Branch 86 toggle / price override 404'd for owner-created dishes** — both
  writers did a bare UPDATE on `branch_menu_items`, but no row exists for
  anything added through the admin console (only seeding and onboarding create
  them), so the admin console returned "Branch menu item not found". They now
  upsert, creating the override row on first write. Verified end-to-end: owner
  86s a dish, the diner menu flips to unavailable and add-to-cart is refused.
- **`GET /orders` leaked every table's orders to every diner** — the model query
  had no `session_id` filter at all and fell through to RLS, which scopes by
  restaurant/branch, not by session. Reproduced live: a diner at table T2 saw
  T1's 6 rounds (including line items) on their own tracking screen. Also
  hardened `getOrderById` the same way for diner callers (staff still need
  cross-table lookup, so their calls are left unscoped). Both now
  `.eq('session_id', ...)`. This was also silently breaking the "auto-advance
  to review once done" logic below, since a table's own rounds could never all
  read as "served" while unrelated tables' open rounds were mixed in.
- **Bill/payment screen stayed interactive after paying** — `BillScreen` kept
  rendering the full split → payment flow even once `bill.paid` was true, so
  navigating back into it after paying looked like payment was still pending.
  Now short-circuits to a plain "Bill paid" confirmation. `TrackingScreen`'s
  "View bill & pay" button also didn't change once paid; it now reads "View
  receipt" (paid, round still open) or "Leave a review" (paid + fully served).
- **Review screen had no exit** — submitting or skipping a review just bounced
  the diner back to `/orders`, with nothing marking their visit as finished.
  Both actions now call `signOut()`, ending this device's local session (same
  as scanning out) so `SessionGuard` shows the "scan again" screen. Deliberately
  scoped to this browser only — it clears local state, it does NOT close the
  backend `table_sessions` row, so other diners at the same table (who may
  still be eating/paying) are unaffected. Verified live: T2's diner reviewed →
  saw "This table session has ended"; T1's session was completely untouched.
  Closing the table for everyone stays a staff-only action
  (`RestaurantModel.closeSession`) — there is still no diner-permitted
  whole-table close endpoint, and deliberately so (a diner shouldn't be able to
  end the session for other people at their table).
- **No hand-off once a round finished** — a fully served, paid table had
  nothing to do but sit on the tracking screen. `TrackingScreen` now fetches
  bill status alongside orders and auto-navigates to `/review` the first time
  every round is `served`/`cancelled` AND the bill is paid (gated by a
  session-scoped `sessionStorage` flag so it only fires once, not every time
  the diner comes back to check on things).
- **Owner-created dishes were un-orderable** — `POST /menu/items` never creates a
  `branch_menu_items` row, but `cart.model.getMenuItemsForCart` inner-joined that
  table. Result: the dish showed on the diner menu as available, then add-to-cart
  returned 404 `Item not available on this branch`. `cart.service.getCart` also
  `continue`d past such a line, dropping it from the cart *and* the subtotal
  silently. Both now treat a missing row as "available at base price", matching
  `getAssembledMenu`. The 86 toggle and price override still work where a row
  exists (verified live). The `place_order` half needs migration 5b applied.
- **Bill pre-selected the wrong payer** — `GET /payments/bill` `byMember` had no
  `isCurrentUser`, so the split screen defaulted to whoever was first in the list.
  Verified live: logged in as one diner, pre-selected another's share.
- **Menu refetched on every navigation** — `useMenu` had no cache, so every
  menu→item→menu hop refetched and flashed a full-page skeleton. Now cached per
  session in `menu-cache.ts` (cleared on join / sign-out / session end).
- **Onboarding slug collision** — `branches.slug` is **globally** unique but
  onboarding defaulted the slug to `"main"`, so the *second* tenant to onboard with
  defaults hit `duplicate key … branches_slug_key` (500) and first-run failed.
  Bootstrap now retries the insert with a short random slug suffix
  (`main-ab12cd`) on a 23505. Verified: fresh branch + correct table count.
