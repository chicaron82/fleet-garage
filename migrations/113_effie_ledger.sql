-- Effie credit tracker (2026-08-15). Aaron tops his Anthropic credit up MANUALLY, one fixed
-- load at a time ($10, no auto-reload), and the only way to see what's left is the Console.
-- He wants it in FG so Effie never goes dark mid-shift without warning.
--
-- WHY A LEDGER AND NOT THE ADMIN COST API: the original plan was Anthropic's Admin Usage &
-- Cost API, which needs an `sk-ant-admin01-…` key. That key is UNAVAILABLE on an individual
-- account (verified live 2026-08-15: /settings/admin-keys 404s), and creating a whole Console
-- *organization* to unlock it is account surgery for a convenience readout. But FG's key is
-- DEDICATED (`fg-api-key`) — every dollar it spends is Effie — and every Anthropic response
-- hands us a `usage` block. So FG accounts for itself: log tokens per call, price them, and
-- derive the remainder. No credential, no lag, no org.
--
--   remaining = (latest topup.amount_usd) − SUM(spend since that topup)
--
-- One table, two kinds of row, so that subtraction is a single ordered read.
CREATE TABLE IF NOT EXISTS effie_ledger (
  id               BIGSERIAL PRIMARY KEY,
  at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  kind             TEXT         NOT NULL CHECK (kind IN ('spend', 'topup')),
  -- Dollars. Always POSITIVE; `kind` carries the direction (a topup adds, spend subtracts).
  -- numeric(12,6) because a single cheap text turn costs fractions of a cent and rounding
  -- each row to 2dp would lose most of the bill across a shift's worth of calls.
  amount_usd       NUMERIC(12,6) NOT NULL CHECK (amount_usd >= 0),
  -- Spend rows only — kept for auditing a surprising number and for re-pricing history if a
  -- rate table entry was ever wrong. NULL on topup rows.
  model            TEXT,
  input_tokens     INTEGER,
  output_tokens    INTEGER,
  cache_read_tokens INTEGER,
  cache_write_tokens INTEGER,
  -- Which endpoint spent it (fg-chat / keytag-read / fg-schedule-parse) — so a cost spike
  -- can be traced to a surface rather than just "Effie".
  source           TEXT
);

-- The only query this table serves: "the latest topup, then everything since it."
CREATE INDEX IF NOT EXISTS effie_ledger_at_idx ON effie_ledger (at DESC);
CREATE INDEX IF NOT EXISTS effie_ledger_kind_at_idx ON effie_ledger (kind, at DESC);

-- FG's standard posture: RLS on + allow-all (trusted-crew PoC). A table shipped without this
-- deviates from the other 38 AND trips Supabase's rls_disabled_in_public advisory (bit FG
-- 2026-07-28 on ev_asset_loans + fuel_pump_readings, fixed by migration 110).
ALTER TABLE effie_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS effie_ledger_all ON effie_ledger;
CREATE POLICY effie_ledger_all ON effie_ledger FOR ALL TO public USING (true) WITH CHECK (true);
