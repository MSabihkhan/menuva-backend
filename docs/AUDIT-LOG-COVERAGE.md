# Audit log — what is actually recorded

Requested as part of the QA pass (issue #6: "coverage looks incomplete"). It is
incomplete. This documents the current state rather than changing behaviour —
deciding which actions must be auditable is a product/compliance call, not a bug
fix.

## Table shape

`audit_log` columns, as used today:

| Column | Notes |
|---|---|
| `id` | uuid |
| `restaurant_id` | tenant scope |
| `actor_type` | `'staff'` or `'diner'` |
| `actor_id` | **unreliable — see below** |
| `action` | free text, no enum or check constraint |
| `entity_type` | free text, **inconsistent between writers** |
| `entity_id` | the affected row |
| `old_value` | jsonb, **never written by any current caller** |
| `new_value` | jsonb, written by 2 of 3 callers |
| `occurred_at` | timestamptz |

## Everything that writes to it

There are exactly three writers in the whole backend.

| Action | Written by | `entity_type` | `old_value` | `new_value` | `actor_id` |
|---|---|---|---|---|---|
| `item_added` | `services/menu.service.ts` (`createMenuItem`) | `menu_items` | — | — | **wrong** |
| `price_change_queued` | `models/menu.model.ts` (`queuePriceChange`) | `menu_items` | — | `{ price }` | correct |
| `status_advanced` | `models/kitchen.model.ts` (`advanceOrder`) | `order` | — | `{ status }` | correct |

Plus one more, only inside a function nothing currently calls:

| `price_changed` | `run_end_of_day()` SQL function | `menu_item` | — | `{ new_price }` | requester |

## Confirmed defects

1. **`actor_id` on `item_added` is the restaurant id, not the user id.**
   `menu.service.ts` passes `restaurant_id` in the `actor_id` column with the
   comment *"assuming auth context in controller can pass real user"* — the
   controller has `req.auth.userId` and simply never passes it. So the single
   most common audit event cannot answer "who added this dish". Verified live:
   every `item_added` row on the probe restaurant has `actor_id` equal to
   `restaurant_id`.

2. **`old_value` is never populated, anywhere.** Nothing records what a value
   was before it changed, so the log cannot answer "what did this used to be" —
   which is most of what an audit log is for.

3. **`entity_type` is not consistent.** `menu_items` (plural, table name) from
   two writers, `order` (singular) from the kitchen, `menu_item` (singular) from
   `run_end_of_day`. Any filter by `entity_type` has to know all three spellings.
   The read endpoint `GET /api/audit-log` filters on `entity_type` directly, so
   filtering by "order" silently misses nothing today only because there is one
   writer per spelling.

4. **`item_added` writes are best-effort and silent.** `menu.service.ts` logs to
   `console.error` and continues if the insert fails, so audit gaps are
   invisible. The kitchen writer does the same.

## What is NOT audited at all

None of the following produce an audit row today:

- Menu items: update, delete, price change applied directly (not via the queue)
- Categories: create, update, delete
- Modifier groups and modifiers: any change
- Branches and tables: create, update, delete, QR regeneration
- Staff: invite, role change, removal
- Offers, card discounts, upsell rules, pairings, affinity: any change
- Restaurant settings: tax rate, service charge, name
- **Payments: any payment recorded** — the money path has no audit trail
- Session close / table close by staff
- Any authentication event: staff login, failed login, logout, diner join

## Recommendation

The gaps that matter most for a restaurant SaaS, in order:

1. Payments — recording who took a payment and how much was discounted.
2. Price and menu changes, with `old_value` populated.
3. Staff access changes — invites and role changes.
4. Settings changes — tax and service charge especially.

Doing this properly means a shared `writeAudit()` helper (one place that fills
`actor_id` from `req.auth`, normalises `entity_type`, and captures both old and
new values), plus a decision on whether audit failures should be fatal. That is
a deliberate piece of work, not a QA patch, so it is written up here rather than
half-implemented.
