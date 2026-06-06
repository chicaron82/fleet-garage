# Data Model — Semantic Notes

The numbered `.sql` files in this directory are the **structural** truth: every
table and column, applied in order. This file is the **semantic** truth — the
relationships, write-ownership, and invariants that the migrations encode but
can't explain. Column-level types live in
[`../src/types/database.types.ts`](../src/types/database.types.ts); don't
duplicate them here.

Read this when "what does this column mean / who writes it / why" can't be
answered by reading one migration in isolation.

---

## The washbay queue triangle

Three tables describe the same physical thing — the line of cars waiting to be
washed — recorded by **different actors at different times**. They are not
redundant; they are three views of one queue as it crosses a shift boundary.

| Table | Actor | When | Records |
|---|---|---|---|
| `washbay_logs` | Closing (evening) VSA | End of a live shift | The night's gas sheet + what was left in queue |
| `handoff_notes` | Morning crew | Start of next day | How much of last night's queue they cleared |
| `washbay_backfill_logs` | Anyone, retroactively | After the fact | A past day's closing data, reconstructed |

### How the queue flows across a day boundary

```
Day D evening          washbay_logs(D).cars_remaining   = N left in the wash queue at close
Day D+1 morning        handoff_notes(D+1).carry_over_cleared = how many of those N the AM crew washed
Day D+1 evening        washbay_logs(D+1).carry_over      = how many the closing shift inherited at open
```

`cars_remaining` (day D), `carry_over_cleared` (day D+1 AM), and `carry_over`
(day D+1 PM) are **three measurements of the same inherited debt**, from the
crew that created it, the crew that cleared it, and the crew that inherited it.

- **`carry_over`** (migration 074, `washbay_logs` + `washbay_backfill_logs`) is
  purely **informational**. It annotates the starting condition so a 24-car
  session that opened with 11 in the queue doesn't read identical to one that
  opened clean. It does **not** enter any throughput math (see `sentToFleet`
  below).
- **`carry_over_cleared`** (migration 072, `handoff_notes`) is the morning
  crew's **credit** for clearing the queue. Different table, different actor,
  different question. Don't conflate the two.

`washbay_backfill_logs` mirrors `washbay_logs` (minus the live shift-report
fields) so retroactive reconstruction preserves the queue lineage — it carries
both `carry_over` and `cars_remaining`.

---

## The gas sheet measures labor, not output

When a car is fuelled at intake (the night it arrives) it lands on **that
night's** gas sheet, regardless of when it's eventually washed and shipped.
`full_pages` + `last_page_entries` → the page counter → cars fuelled
(`gasSheet`). The throughput surfaces don't read `gasSheet` directly; they read
what actually **shipped to fleet**:

```
sentToFleet = max(0,  gasSheet
                    − carsRemaining        still in the wash queue at close (didn't ship)
                    − nonRentablesFuelled  fuelled but parked: damage-held / new, no plates
                    + deferredCompletions) shipped today but fuelled a PRIOR day (plate install)
```

Source of truth: [`../src/lib/washbay-throughput.ts`](../src/lib/washbay-throughput.ts)
(`sentToFleet` / `sentToFleetFromCount`). All three rate call sites go through
it so they can't drift. Same-day fuel-and-ship needs no adjustment; only
**cross-day deferral** is corrected — held day subtracts via `nonRentablesFuelled`,
ship day adds via `deferredCompletions`. The ledger balances per day with no
retroactive edits.

---

## Off-standard fleeting: one preset encodes the invariant

Plate-install / fleeting work is logged as **off-standard time** (it pulls from
the rate denominator). But fleeting work whose cars *shipped* is already counted
in `sentToFleet` — crediting it on both sides would double-count one piece of
work. The distinction is carried by a **free-text `preset_reason`** (no boolean
column, no migration), arbitrated in one place:

| `preset_reason` | Meaning | Denominator |
|---|---|---|
| `fleeting_sent` | Cars went up to fleet | **Exempt** (already in `sentToFleet`) |
| `fleeting_cars` | Prepped, stayed on lot | **Reduces** it (prep that took time but didn't ship) |

```ts
// src/lib/shift-metrics.ts — the single arbiter
reducesDenominator(e) = e.presetReason !== 'fleeting_sent'
```

The rule, in plain terms: **credited once per day.** Output if it shipped,
time-relief if it didn't, gated on whether the car left the lot. This invariant
came off the shop floor, not the code — see the blog post
*What the Gas Sheet Actually Counts*.

---

## High-signal washbay migrations

If you need the lineage, these are the ones that shaped the model above
(read in order):

- `063_washbay_lot_status` — lot status on the closing log
- `064_normalize_queue_at_departure` — queue accounting cleanup
- `070_washbay_backfill_rls_fix` — backfill path RLS
- `071_washbay_sent_to_fleet` — the `sentToFleet` numerator fields
- `072_handoff_carry_over` — `carry_over_cleared` (morning crew's credit)
- `073_edv_plate_condition` — EDV plate/condition capture
- `074_washbay_carryover` — `carry_over` (closing shift's inherited-debt annotation)

---

_Scope note: this digest currently covers the washbay throughput domain — the
densest, most cross-referenced corner of the schema. Extend it as other domains
(holds, PTO, shift checkpoints) accumulate the same "can't-read-it-from-one-
migration" complexity._
