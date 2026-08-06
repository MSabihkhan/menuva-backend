# What "affinity" means in Menuva

Requested as context for the diner-flow upsell bug (issues #5 and #9).

## Data model

```
upsell_category_affinity
  id                  uuid
  restaurant_id       uuid
  source_category_id  uuid  -- "when the diner adds something from HERE..."
  target_category_id  uuid  -- "...suggest something from HERE"
  priority            int   -- lower wins; ties broken arbitrarily
```

One row is one directional rule: *Mains → Drinks* does **not** imply
*Drinks → Mains*. A source category may have several target categories; they are
ranked by `priority` ascending.

This is distinct from the two other suggestion inputs:

- **`upselling_combinations`** — item-to-item pairings (*this burger → this
  cola*). Explicit, hand-picked, narrower than affinity.
- **`item_pair_scores`** — a materialized view of observed co-occurrence, with
  `lift_bps` and `support_bps`. Data-driven, no human input.

## How suggestions are chosen

All of it happens in the `get_upsell_suggestions` Postgres function. The
diner-facing endpoint is `POST /api/upsell/suggestions`.

The candidate pool starts as every active, non-deleted menu item for the
restaurant that is not 86'd at this branch, minus anything already in the cart,
already declined this round, or the trigger item itself.

Sources are then blended in strict precedence — an item already contributed by a
higher source is not repeated:

| # | Source | `source` value | Meaning |
|---|---|---|---|
| 1 | `upselling_combinations` | `curated` | An explicit pairing for this exact item. Most specific, so it wins. |
| 2 | `upsell_category_affinity` | `affinity` | The owner's category rule. |
| 3 | `item_pair_scores` | `co_occurrence` | Ordered together often enough to clear the lift/support thresholds. |
| 4 | margin fallback | `margin` | Anything with a known cost price, best margin first. |

The blended list is ordered by priority and truncated to the remaining
impressions allowed for the round (`upsell_rules.max_impressions_per_round`
minus impressions already shown).

## The rule that was missing (issue #9)

Affinity was **never read**. The table, the REST API (`GET/POST
/api/upsell/affinity`) and the admin screen all worked and stored rules
correctly — `get_upsell_suggestions` simply had no reference to the table. Sources
were curated → co-occurrence → margin.

So configuring *Mains → Drinks* changed nothing, and since a new restaurant has
no curated pairings and no co-occurrence history, **every** suggestion came from
the margin fallback: the highest-margin item on the menu, which for a burger
restaurant is another burger.

Two things were needed, not one:

1. Add affinity as a source (so drinks can be suggested at all).
2. **Treat affinity as a filter, not just an extra source.** When a rule exists
   for the trigger's category, the co-occurrence and margin fallbacks are
   restricted to the affinity target categories. Without this the fallback stays
   free to propose another burger and the owner's instruction is advice rather
   than configuration — which is exactly the reported symptom.

Curated item pairings deliberately still outrank affinity: an owner who pairs a
specific dish with a specific side has said something more precise than "mains go
with drinks".

## Verified

Against a restaurant with Mains (4 burgers, all high margin) and Drinks (cola,
water), affinity Mains → Drinks configured:

- Adding a burger with no curated pairing now suggests **Cola, Water** only —
  previously it suggested other burgers via the margin fallback.
- A burger that *does* have a curated pairing still returns that pairing first,
  with `source: "curated"`.

## Known limitation

`priority` has no uniqueness constraint, so two rules with the same priority for
one source category are ordered arbitrarily. Fine today; worth a tiebreak (e.g.
category sort order) if owners start configuring many rules.
