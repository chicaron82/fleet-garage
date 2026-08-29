// Key-tag read endpoint. READ-ONLY: it reads a photo of a printed Hertz vehicle key tag
// and returns the structured fields on it (KeytagRead) — it writes nothing and does NOT
// look anything up in the fleet. Sibling to fg-schedule-parse; same key/JWT/allowlist gate,
// same forced-tool structured output. make/model are DERIVED from the class code downstream
// (a fleet class lookup), so this raw read leaves them empty and returns the class code.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { shouldEscalate, corroborates, hasIdentityKey, plateKey, unitDigits } from './_lib/keytagEscalation.js';
import { normalizeOwning } from './_lib/owningArea.js';
import { normalizeVinLast9 } from './_lib/vinLast9.js';
import { isAllowed } from './_lib/assistantAccess.js';
import { parseImageDataUrl } from './_lib/imageData.js';
import { lookupVehicleClass, normalizeClassCode, hybridFromRentalClass } from './_lib/vehicleClassCodex.js';
import { resolveRentalClass } from './_lib/classPin.js';
import type { KeytagRead } from './_lib/keytagRead.js';
import { priceUsage } from './_lib/apiSpend.js';
import { recordSpend } from './_lib/recordSpend.js';

interface FgRequest {
  method?: string;
  headers: { authorization?: string };
  body?: { image?: unknown };
}
interface FgResponse {
  setHeader(name: string, value: string): void;
  status(code: number): FgResponse;
  json(body: unknown): void;
}

// ── Two-tier reading ────────────────────────────────────────────────────────────────────────────
// FIRST pass is cheap. Only a read FG can't check against the fleet pays for the strong model.
// Measured on 40 of Aaron's real tags (2026-08-18, see api/_lib/keytagEscalation.ts for the full
// numbers): haiku resolves to the right car 97.5% of the time, but is only 87.5% on the plate —
// and opus was perfect on all 13 tags haiku found hard, 13-0. So the strong model IS better; it
// just isn't worth 5.4x on a scan whose answer the fleet already knows.
const FAST_MODEL   = 'claude-haiku-4-5';
const STRONG_MODEL = 'claude-opus-4-8'; // a smudged/angled tag → the strong vision model.

// ⭐ AVAILABILITY IS A DIFFERENT REASON TO CHANGE MODEL THAN QUALITY, and FG only had the second one.
// Aaron, 2026-08-27, after a shift of it: *"the scanner was down… that was happening a lot for me
// today"* — and the message he named was "the scanner is busy right now", which has exactly one
// source: this file returning 503 on a transient Anthropic failure. Not a bad photo, not his network.
// The fast model was saturated.
//
// ⚠️ AND HE HAD ALREADY BEEN RETRIED FIFTEEN TIMES. The SDK does 4 with backoff, the client does 3 on
// top. More retrying was never the fix — it would only make him wait longer for the same answer. But
// a DIFFERENT MODEL IS A DIFFERENT CAPACITY POOL, and the escalation path was sitting in this very
// file, gated on whether the read corroborated against the fleet — a branch a thrown call never
// reaches.
//
// ⚠️ NOT the strong model for this. Opus on the availability path puts the most expensive model on
// the branch that fires most often, which is [[feedback_shared_budget_is_a_shared_resource]] waiting
// to happen. Sonnet is what this codebase already names FALLBACK_VISION_MODEL in
// api/_lib/scheduleVisionRequest.ts, for precisely this job.
const FALLBACK_MODEL = 'claude-sonnet-5';

/** Is this the model being unavailable, rather than the photo being unreadable? */
function isTransient(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = err instanceof Error ? err.message : String(err);
  return status === 529 || status === 503 || status === 429 || /overload/i.test(msg);
}

// ⭐ EXPORTED so a probe can measure the REAL read. A script that copies this prompt measures a
// copy, and the first time the two drift the measurement quietly becomes fiction — which is the
// whole reason Aaron's "how much API would this cost" question needed a number from the ledger
// rather than an estimate.
export const PROMPT = `You are reading a photo of a Hertz vehicle KEY TAG. It may be PRINTED or HANDWRITTEN — read whichever fields are present and report them exactly as shown. Never guess or invent; leave a field empty if it isn't there or isn't legible. Handwritten tags vary a lot and often carry FEWER fields, in any order or style — read the ones you find and blank the rest. A missing field is normal, not a failure.

Fields the tag MAY carry (read the ones present):
- OWNING CITY + OWNING AREA + RENTAL CLASS — the top line carries all three, report them separately:
  • OWNING CITY: the branch's CITY NAME printed above or beside the number ("WINNIPEG", "CALGARY", "HALIFAX", "VAN DTG"). Report it exactly as shown, even partially — if it is cropped or cut off, report the letters you can actually see and nothing more. Never complete it from the number, and never infer a city you cannot read.
  • OWNING AREA: the 4–5 digit branch number that owns the vehicle ("08199", "8193"). Report the digits.
  • RENTAL CLASS: the short 1–3 char size/type group beside it ("Q4", "P4", "T", "L2", "B").
  Printed: "WINNIPEG / 08199  Q4" → owningCity "WINNIPEG", owningArea "08199", rentalClass "Q4". Handwritten: "8199  B" → owningArea "8199", rentalClass "B", owningCity "". Do NOT put the branch number in rentalClass, and do NOT put the city in either.
- UNIT NUMBER: the vehicle number. Printed labels it "Veh #"; handwritten is often a bare ~7-digit number in digit groups. Join the groups (e.g. "542 4882" → "5424882").
- LAST 9 OF THE VIN: printed tags label it "Last9vin:" and print exactly NINE characters (shaped like "0XX111111" — a check digit, a year letter, then seven more). Report those nine EXACTLY as shown, with no spaces. It is the last nine of the VIN, never the whole VIN — do not pad it, extend it, or infer the missing characters. VINs never contain the letters I, O or Q, so a character that looks like one is a 1 or a 0. Handwritten tags rarely carry it; leave it empty when absent. ⚠️ The shape above is an ILLUSTRATION, never a value to output. If you cannot read the nine characters on THIS tag, return an empty string. An empty field is correct; a remembered example is a fabricated vehicle identity.
- LICENSE PLATE: printed as "Lic Plate"; handwritten is often just the plate itself (letters+digits, e.g. "LUR243").
- MAKE / MODEL — the ONE real difference between the two formats:
  • PRINTED tags do NOT write the make/model — they print a 4-char CLASS CODE ("CCVL", "CVRS") resolved to a model elsewhere. Report it as classCode; leave make/model empty.
  • HANDWRITTEN tags usually write the MODEL directly ("versa", "Elantra") with NO 4-char code. Report model as written, and make only when it's unambiguous from that model (Versa→Nissan, Elantra→Hyundai, Camry→Toyota); leave classCode empty.
- MODEL YEAR: printed on the class line ("CCVL 25" → 2025); handwritten a 2-digit year by the model ("25 versa" → 2025).
- COLOUR: a code on printed tags (WHI→White, BLK→Black, SIL→Silver, GRY→Gray, BLU→Blue, RED→Red — else your best full-word reading); a plain word on handwritten ("Blue"). Report the colour name.
- BODY STYLE: e.g. "4DR", if present. Ignore other scribbles (options like "AC L1", stall/location notes).

Push through an angled, low-contrast, handwritten, or partial tag and read what you can. Only if the image is NOT a key tag at all, call report_keytag with everything empty. Call report_keytag with what you read.`;

export const REPORT_TOOL: Anthropic.Tool = {
  name: 'report_keytag',
  description: 'Report the fields read off the vehicle key tag.',
  input_schema: {
    type: 'object',
    properties: {
      plate: { type: 'string', description: 'License plate ("Lic Plate"), exactly as printed. "" if not legible.' },
      unitNumber: { type: 'string', description: 'Unit number ("Veh #"), digit groups joined. "" if not legible.' },
      vinLast9: { type: 'string', description: 'The NINE characters printed after "Last9vin:", exactly as shown, no spaces. Never the full VIN and never padded. "" if not present or not legible.' },
      classCode: { type: 'string', description: 'The class-line letters, e.g. "CCVL". "" if not legible.' },
      rentalClass: { type: 'string', description: 'The rental class beside the branch number up top, e.g. "Q4", "P4", "T", "B". "" if not legible.' },
      owningArea: { type: 'string', description: 'The 4–5 digit OWNING branch number on that same top line, e.g. "08199", "8193". Digits only. "" if not legible.' },
      owningCity: { type: 'string', description: 'The branch CITY printed on that same top line, e.g. "WINNIPEG", "CALGARY", "HALIFAX", "VAN DTG". Exactly as shown — report a partial reading if it is cropped, and never complete or infer it from the number. "" if absent or not legible.' },
      make: { type: 'string', description: 'Make — ONLY when written on the tag (handwritten) or unambiguous from a written model (Versa→Nissan). "" on a printed tag (make is derived from the class code downstream).' },
      model: { type: 'string', description: 'Model — when written DIRECTLY on the tag (handwritten, e.g. "Versa"). "" on a printed tag (derived from the class code).' },
      year: { type: 'integer', description: 'Model year from the class line (e.g. 2025). 0 if not legible.' },
      color: { type: 'string', description: 'Colour name mapped from the code (WHI→White…). "" if not legible.' },
      bodyStyle: { type: 'string', description: 'Body style from the colour/body line (e.g. "4DR"). "" if none.' },
    },
    required: [],
  },
};

interface RawKeytag {
  plate?: string;
  owningArea?: string;
  owningCity?: string;
  unitNumber?: string;
  vinLast9?: string;
  classCode?: string;
  rentalClass?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  bodyStyle?: string;
}

/** Normalize the tool output → KeytagRead: empty strings → undefined, 2-digit year → 4-digit. */
/**
 * ⚠️⚠️ EVERY LITERAL THIS PROMPT SHOWS THE MODEL AS AN EXAMPLE.
 *
 * On 2026-08-29 a 158-photo VIN backfill wrote `9TR289777` onto THREE different cars, and a check
 * for duplicate VINs is the only reason anyone noticed. That string is the sample value printed in
 * this file's own LAST 9 OF THE VIN instruction: when the model could not read the field, it echoed
 * the example. `8NF258345` — the other sample — had been sitting on LJF679 since 2026-08-25 from an
 * earlier backfill, so the pathway had been writing fiction into the fleet for four days.
 *
 * ⭐ The prompt now says not to echo an example, and that instruction is a WISH. This set is the
 * MECHANISM: a read equal to a documented sample is treated as unread, whatever the prompt says and
 * whatever a future model does with it. A value that appears in the instructions can never be
 * evidence, because the model was shown it.
 *
 * ⚠️ VIN values only, deliberately. The other examples are drawn from REAL cars — unit `5424882` is
 * LUR243's actual number — so blanking those would discard true readings. That is also precisely why
 * an echoed example is so hard to spot: it looks exactly like fleet data.
 */
const PROMPT_EXAMPLE_VINS: ReadonlySet<string> = new Set(['9TR289777', '8NF258345']);

function toKeytagRead(input: unknown): KeytagRead {
  const r = (input ?? {}) as RawKeytag;
  const s = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);
  let year: number | undefined;
  if (typeof r.year === 'number' && r.year > 0) year = r.year < 100 ? 2000 + r.year : r.year;
  const classCode = s(r.classCode);
  // Resolve the class code → make/model here (the codex is server-side). An unknown code
  // leaves make/model empty — the caller then asks, exactly as Effie does in chat.
  const vc = lookupVehicleClass(classCode);
  return {
    plate: s(r.plate),
    unitNumber: s(r.unitNumber),
    // Normalized to the write's own rule, so an unusable partial never leaves this function
    // wearing the shape of an identity key. '' → undefined.
    // ⚠️ An echoed example is not a reading — see PROMPT_EXAMPLE_VINS above.
    vinLast9: (() => {
      const v = normalizeVinLast9(r.vinLast9) || undefined;
      return v && PROMPT_EXAMPLE_VINS.has(v) ? undefined : v;
    })(),
    classCode,
    rentalClass: s(r.rentalClass)?.toUpperCase(),
    // Normalized here (leading zero stripped) so the stored value is one shape regardless of
    // whether the tag printed "08199" or "8199".
    owningArea: normalizeOwning(r.owningArea) || undefined,
    // ⚠️ RAW, and deliberately NOT normalised against the number. The city's whole job is to be
    // INDEPENDENT evidence for the owning area — reconciling them here would destroy the one thing
    // that makes it useful. `checkOwningCity` compares them and a person decides.
    owningCity: s(r.owningCity),
    // Printed tag: make/model DERIVED from the class code (codex wins). Handwritten tag: no code,
    // but the model is written directly — fall back to the read's own make/model.
    make: vc?.make ?? s(r.make),
    model: vc?.model ?? s(r.model),
    // Codex hint first (it names the exact variant); rental class as the fallback that catches a
    // code the codex doesn't know AND a tag printed with the wrong code. One-way: never un-checks.
    isHybrid: vc?.isHybrid ?? hybridFromRentalClass(s(r.rentalClass)),
    year,
    color: s(r.color),
    bodyStyle: s(r.bodyStyle),
  };
}

export default async function handler(req: FgRequest, res: FgResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!apiKey || !supabaseUrl || !supabaseAnonKey) {
      res.status(500).json({ error: 'Assistant is not configured.' });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.slice(7));
    if (userErr || !userData.user) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const employeeId = (userData.user.email ?? '').split('@')[0];
    if (!isAllowed(employeeId, process.env.VITE_FG_ASSISTANT_ALLOWED_EMPLOYEE_IDS)) {
      res.status(403).json({ error: "The assistant isn't enabled for this account." });
      return;
    }

    const image = parseImageDataUrl(req.body?.image);
    if (!image) {
      res.status(400).json({ error: 'A key-tag photo is required.' });
      return;
    }

    // maxRetries: the SDK backs off + retries transient failures (429 / 500+ / 529 "Overloaded",
    // connection blips) with jitter before giving up — so a busy-Anthropic moment self-heals here
    // instead of bubbling a scary error onto Aaron's shift screen. 4 tries covers a real spike.
    const anthropic = new Anthropic({ apiKey, maxRetries: 4 });
    const askModel = (model: string) => anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: PROMPT,
      tools: [REPORT_TOOL],
      tool_choice: { type: 'tool', name: 'report_keytag' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Read this key tag.' },
            { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
          ],
        },
      ],
    });
    const toolInput = (m: Anthropic.Message) =>
      m.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')?.input;

    // ── Pass 1: the cheap read ──
    // ⚠️ Wrapped, because an OVERLOADED fast model is not an unreadable tag. A throw here used to
    // fall straight to the catch and tell him the scanner was busy, without the other model ever
    // being asked. If the fallback also fails, the original error is re-thrown so the catch below
    // still reports honestly — "busy" stays exactly right when everything really is busy.
    let usedFallback = false;
    let fast: Anthropic.Message;
    try {
      fast = await askModel(FAST_MODEL);
    } catch (err) {
      if (!isTransient(err)) throw err;
      console.warn('[keytag-read] fast model unavailable — falling over to', FALLBACK_MODEL);
      fast = await askModel(FALLBACK_MODEL);   // a throw here reaches the catch, as it should
      usedFallback = true;
    }
    // Every call is logged the moment it returns, escalation or not — a failed parse still burned
    // the tokens, and the ledger has to be honest about spend the operator got nothing for.
    // ⚠️ Priced against the model that ACTUALLY ran. A fallback that spends invisibly is the exact
    // defect that drained the account and broke his scanner mid-shift once already; the ledger has to
    // name what it cost, not what it meant to cost.
    const firstModel = usedFallback ? FALLBACK_MODEL : FAST_MODEL;
    const spend = [priceUsage(firstModel, fast.usage)];
    let usedModel = firstModel;
    let input = toolInput(fast);
    let read = input ? toKeytagRead(input) : null;

    // ── Can the fleet confirm it? ──
    // Not a confidence score — just "does this land on a car we already have". A matched read is
    // corroborated by an independent record, which beats a second opinion from a bigger model.
    // An unmatched one is a new car (where the read BECOMES the record) or a misread, and both
    // want the strong model. The lookup is one indexed query on keys FG already resolves scans by.
    let matched = false;
    if (hasIdentityKey(read)) {
      const plate = plateKey(read?.plate);
      const unit = unitDigits(read?.unitNumber);
      const ors = [plate && `license_plate.eq.${plate}`, unit && `unit_number.eq.${unit}`].filter(Boolean).join(',');
      // Bring back the keys themselves, not just a row count — `corroborates` has to check that
      // the plate and the unit landed on the SAME car. A plate is unique and a unit is shared by
      // at most two live vehicles today, so 4 rows is headroom, not a guess.
      const { data: hits } = await supabase
        .from('vehicles').select('id, license_plate, unit_number').is('archived_at', null).or(ors).limit(4);
      matched = corroborates(read, hits ?? []);
    }

    // ── Pass 2, only when nothing corroborates it ──
    if (shouldEscalate(read, matched)) {
      const strong = await askModel(STRONG_MODEL);
      spend.push(priceUsage(STRONG_MODEL, strong.usage));
      usedModel = STRONG_MODEL;
      const strongInput = toolInput(strong);
      // Keep the cheap read only if the strong one returned nothing usable — never downgrade.
      if (strongInput) { input = strongInput; read = toKeytagRead(strongInput); }
    }

    void recordSpend(supabase, 'keytag-read', spend);
    void usedModel;

    if (!read) {
      res.status(502).json({ error: "Couldn't read a key tag from that photo." });
      return;
    }
    // The curated codex is tried first (in toKeytagRead). Only when it MISSES do we consult the
    // codes Aaron has taught — so a taught row fills a gap and can never silently override a
    // vetted mapping. One cheap keyed lookup, and only on the codes that would otherwise fail.
    if (!read.make && read.classCode) {
      const key = normalizeClassCode(read.classCode);
      const { data: taught } = await supabase
        .from('vehicle_class_codex')
        .select('make, model')
        .eq('code', key)
        .maybeSingle();
      if (taught?.make) { read.make = taught.make; read.model = taught.model; }
    }
    // Rental-class LEARN + INFER (twin of the taught code->make/model codex above). A scan where BOTH
    // the class code and the rental class read clean TEACHES code->class; a scan with a readable code
    // but a BLANK class INFERS it from what was learned. Ground truth only -- the tags are the chart.
    // Best-effort: learning/inferring must never break the read.
    if (read.classCode) {
      const codeKey = normalizeClassCode(read.classCode);
      try {
        // ⭐⭐ A HUMAN PIN OUTRANKS THE TAG (migration 127, 2026-08-25). The rule itself lives in
        // api/_lib/classPin.ts as a pure function, because a rule that only exists inline in a
        // handler is a rule nothing can test — which is exactly how "the real class is E6" sat in
        // a code comment for five weeks while this endpoint re-taught Q4 on every scan.
        const { data: known } = codeKey
          ? await supabase
              .from('class_code_rental_class')
              .select('rental_class, pinned_at')
              .eq('code', codeKey)
              .maybeSingle()
          : { data: null };

        const decision = resolveRentalClass(known, read.rentalClass);
        if (decision.rentalClass) read.rentalClass = decision.rentalClass;
        if (decision.rentalClassOnTag) read.rentalClassOnTag = decision.rentalClassOnTag;
        if (decision.rentalClassPinned) read.rentalClassPinned = true;
        if (decision.rentalClassInferred) read.rentalClassInferred = true;

        if (codeKey && decision.teach && decision.rentalClass) {
          await supabase.from('class_code_rental_class').upsert(
            { code: codeKey, rental_class: decision.rentalClass, learned_by: userData.user.id, updated_at: new Date().toISOString() },
            { onConflict: 'code' },
          );
        }
      } catch { /* learning/inferring must never break the read */ }
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ read });
  } catch (err) {
    // Full detail stays in the server log (Vercel) for debugging; the CLIENT gets a clean,
    // human message — never the raw Anthropic error JSON, which used to leak straight onto the
    // shift screen (the "Overloaded" incident, 2026-07-29). Overload / rate-limit / upstream 5xx
    // are transient → flag them `retryable` so the client can auto-retry + say "busy, try again".
    console.error('[keytag-read] handler error:', err);
    const status = (err as { status?: number })?.status;
    const msg = err instanceof Error ? err.message : String(err);
    const transient = status === 529 || status === 503 || status === 429 || /overload/i.test(msg);
    if (transient) {
      res.status(503).json({ error: 'The scanner is busy right now — try again in a moment.', retryable: true });
      return;
    }
    res.status(500).json({ error: 'Could not read the key tag. Try again.' });
  }
}
