-- 136 — which KIND of departure a sale car is.
--
-- Aaron, 2026-09-02, while specifying the closing inventory: three kinds of car are never written
-- up — sale, turnback and buy-back — and FG could only see one of them, so any exclusion it
-- performed was one third complete while looking total. His fix: *"what about putting turn back and
-- buy backs as a type under sale car when flagging"*.
--
-- ⭐⭐ A SUB-TYPE, NOT TWO NEW HOLD TYPES. All three behave identically (don't clean, don't record —
-- the Flag Issue card already calls it "a disposition flag, not a damage record"). As siblings of
-- `sale_car` every consumer would have to learn three values and the inventory rule would grow a
-- list to fall out of date. As a sub-type nothing branches: one hold type, one rule, three labels.
--
-- ⭐ And that is the point rather than a convenience. He does not know the turnback/buyback
-- distinction himself — *"I don't know the difference between the two. they're leased from the
-- dealership I think."* If FG made them behave differently he would have to know before he could
-- file one. As a pure LABEL he records what the paperwork says and the behaviour is identical
-- either way; the distinction is captured now and can mean something later if it ever needs to.
--
-- ⚠️ NOTHING READS THIS TO DECIDE ANYTHING. If a future reader is about to branch on it, that is
-- the moment to go and ask what the difference actually is — not to guess one.
--
-- NULL on every hold filed before today, and on every hold that is not `sale_car`. A `sale_car`
-- hold with a NULL disposition reads as a plain sale, so nothing already on file changes meaning.
alter table public.holds add column if not exists disposition text;

comment on column public.holds.disposition is
  'Which kind of departure a sale_car hold is: sale | turnback | buyback. A LABEL ONLY — all three behave identically (do not clean, do not write up in the closing inventory), so NOTHING branches on this value. It exists so the operator can record what the paperwork says without needing to know why they differ. NULL on every hold filed before migration 136, and on any hold that is not sale_car; a sale_car hold with a NULL disposition reads as a plain sale.';
