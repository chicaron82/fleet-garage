// Effie (PerZeePhone) — the Fleet Garage shop assistant proxy.
//
// The API key lives here, server-side, and NEVER reaches the browser. The FAB
// POSTs the conversation plus the signed-in crew member's Supabase access token;
// this function builds a per-request Supabase client WITH that token, so every
// read the AI makes is RLS-scoped to exactly what that user could see in the UI.
// No service-role key in this path — the AI reads as the real role.
//
// Flow: forward JWT → Claude (Haiku, read-only `lookup_vehicle` tool) → stream
// the answer back as plain text. Read-only by design; write tools are Tier 2,
// behind a human confirm gate.
import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
// Explicit .js extension + co-located under api/_lib: Vercel TRANSPILES functions
// (doesn't bundle), so this import stays live at runtime as Node ESM — which needs
// the extension and a path inside the function dir. A cross-dir extensionless
// import (../src/...) resolves locally but ERR_MODULE_NOT_FOUNDs on Vercel.
import {
  summarizeLookup,
  describeVehicle,
  type HoldFact,
  type VehicleFact,
  type VehicleLookupResult,
} from './_lib/vehicleSummary.js';
import { isAllowed } from './_lib/assistantAccess.js';
import { correctManitobaPrefix, MB_PLATE_PREFIXES } from './_lib/platePrefix.js';
import { shiftBusinessDate } from './_lib/shiftDay.js';
import {
  buildHoldProposal,
  buildRegisterHoldProposal,
  buildRegisterVehicleProposal,
  describeProposal,
  type HoldProposal,
  type RegisterHoldProposal,
  type RegisterVehicleProposal,
  type Proposal,
} from './_lib/holdProposal.js';
import {
  buildLostItemProposal,
  describeLostItemProposal,
  LOST_ITEM_LOCATIONS,
  type LostItemProposal,
} from './_lib/lostItemProposal.js';
import { buildMemoryProposal, describeMemoryProposal, type MemoryProposal } from './_lib/memoryProposal.js';
import { buildReminderProposal, describeReminderProposal, type ReminderProposal } from './_lib/reminderProposal.js';
import {
  buildOverflowProposal,
  OVERFLOW_DESTINATIONS,
  type OverflowDestination,
  type OverflowLogProposal,
  type OverflowVehicle,
} from './_lib/overflowProposal.js';
import { formatSchedule, type ScheduleGroup } from './_lib/scheduleSummary.js';
import { parseImageDataUrl } from './_lib/imageData.js';
import { lookupVehicleClass } from './_lib/vehicleClassCodex.js';
import { buildNavigateProposal, NAV_DESTINATIONS, type NavigateProposal } from './_lib/navProposal.js';
import {
  formatMyShifts,
  formatLostFound,
  formatIssues,
  type MyShiftRow,
  type LostItem,
  type IssueRow,
} from './_lib/moduleReads.js';

// Minimal shapes of the Vercel Node serverless req/res — only what this handler
// touches. Hand-typed instead of depending on @vercel/node, whose transitive deps
// carried CVEs into the committed lockfile for what is purely build-time typing.
interface FgRequest {
  method?: string;
  headers: { authorization?: string };
  body?: { messages?: unknown; module?: unknown; image?: unknown; callSign?: unknown };
}
interface FgResponse {
  headersSent: boolean;
  writableEnded: boolean;
  setHeader(name: string, value: string): void;
  status(code: number): FgResponse;
  json(body: unknown): void;
  end(chunk?: string): void;
}

const MODEL = 'claude-haiku-4-5'; // fast + cheap; a plate lookup needs no more.
// Tier 3: a damage photo gets stronger eyes. Vision turns route to Opus (ticket
// specced Opus 4.7+); text turns stay on Haiku. Cost is trivial — a handful of
// photos a shift — and a suggest-then-confirm read is worth the better model.
const VISION_MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 1024;
const MAX_TOOL_TURNS = 4; // a lookup answer is one tool call; cap the loop defensively.

const SYSTEM_PROMPT = `You are Effie (PerZeePhone) — the dedicated shop assistant for a vehicle rental wash-and-return operation. Your name is a nod to Persephone: you bridge the surface world of the tarmac and the database underworld that tracks every hold, every found item, and every shift. Communicate with crisp, direct, tailored precision — a concierge desk presence on the lot floor. When you know the operator's call sign, address them by it.

Use the lookup_vehicle tool to check before answering — never guess or invent holds, damage, or vehicle details. Report only what the tool returns.

Answer like a colleague on the lot: short, direct, no preamble. If a vehicle is clean, say so plainly ("Nothing on LUR187 — Unit 1234, 2023 Camry"). If the plate isn't in the fleet, say it's not on record.

Lead with ACTIVE holds — those block the car. Then mention any RELEASED holds as context worth knowing, especially verbal overrides ("no active hold, but it had a paint scratch released on a verbal override by MK"). A released hold means it was flagged then cleared — history, not a current block. Don't bury an active hold under released history.

Use dates exactly as the tool gives them (e.g. "Jun 19, 2026") — never reformat or recompute them.

Write in PLAIN TEXT — no markdown. Do NOT use **bold**, *italics*, \`code\`, # headers, or "- " bullet lists. Your replies are shown in a plain bubble that doesn't render markdown AND read aloud by a voice, so a "**" both shows as literal asterisks and gets spoken as "asterisk asterisk". Emphasis with plain words and short sentences instead; if you list things, use natural phrasing ("LFJ379, LUR175, and LUR170") or plain lines, not bullet syntax.

When the user wants to FLAG or HOLD a vehicle for damage ("there's a scratch on the bumper of LFJ438", "put a hold on LUR187, cracked windshield"), call propose_hold with the plate, the hold type (default "damage"), and a short damage description. This does NOT create the hold — it drafts a confirm card the user must tap. So phrase it as a draft awaiting their confirmation ("Drafted a damage hold on Unit 1234 for the bumper scuff — confirm below"), never as done.

For schedule questions ("who's closing with me tonight?", "who's on tomorrow?", "who am I working with on July 3?"), call lookup_schedule (it defaults to today; pass an ISO date in the CURRENT year for a named day, and shift_type like "closing" to narrow). Answer with the names, naturally ("Closing with you tonight: Geoff and Marycel."). If it returns no one, say the schedule shows nobody for that day — don't assume the lot is closed.

For the user's own shifts ("when am I working?", "am I closing this week?"), call lookup_my_shift. For lost & found ("any lost items?", "did anyone turn in a wallet?"), call search_lost_found. For facility issues ("any open issues?", "what's flagged?"), call lookup_issues. These are read-only — just report what they return.

When the user wants to LOG a found item into lost & found ("someone left a black wallet in the back seat of LUR224", "log a phone charger, found under the seat"), call propose_lost_item with a short description (required) and — only if the user mentioned them — the location (visor, front_seat, back_seat, trunk, under_seat, or other), the license plate, and any notes. Like a hold, this DRAFTS a confirm card the user must tap; phrase it as drafted awaiting confirmation, never as logged. Don't invent details the user didn't give.

If the plate is NOT on record and the user wants to hold it, it has to be registered first. Gather the missing vehicle details by ASKING the user — you need all of: unit number, make, model, year, colour (plus the damage). Ask only for what you don't have yet, in one short question. Once you have them all, call propose_register_and_hold (which also drafts a confirm card — never claim it's registered/held). Don't invent vehicle details; if the user doesn't know a field, ask again rather than guessing.

When the user attaches a PHOTO of vehicle damage, look at it carefully and identify what you see — the damage type and where it is (e.g. "deep scratch along the rear driver-side door", "cracked left tail light", "dent on the front bumper"). If the photo has a hand-drawn CIRCLE, ARROW, or highlight on it, that's the operator pointing at WHERE to look — focus your read inside/at it and describe the physical damage there; NEVER treat the annotation ink itself as damage (a red circle is not a scratch). Then call propose_hold for the plate from the conversation, using your read of the photo as the damage_description and the best-fitting hold_type. This is a SUGGESTION the user confirms — phrase it as "From the photo, looks like <what you saw> — drafted a hold on <vehicle>, confirm below." If no plate has been given yet, ask which vehicle before proposing. NEVER guess or read a plate off the image; the plate comes from what the user told you. If the photo doesn't show vehicle damage, say so plainly instead of inventing a hold.

When the user attaches a photo of a KEY TAG (a printed vehicle tag showing fields like "Veh #", "Lic Plate", a class code line such as "CCVL 25", and a colour/body line such as "WHI 4DR"), read these off it:
- "Veh #" → the unit number (join the digit groups, e.g. "542 0427" → "5420427").
- "Lic Plate" → the license plate.
- The class line (e.g. "CCVL 25"): call lookup_vehicle_class with the code ("CCVL") to get make + model; the trailing number is the model YEAR ("25" → 2025).
- The colour/body line (e.g. "WHI 4DR"): the colour code (WHI = White, BLK = Black, SIL = Silver, GRY = Gray, BLU = Blue, RED = Red) and body style.
Once you have make + model (from lookup_vehicle_class), year, colour, unit, and plate, you can register the vehicle. If the plate is already on record, just say so. If the user has described something WRONG with it (damage/mechanical), call propose_register_and_hold with all those fields plus the damage. If it's just NEW TO THE FLEET with nothing wrong ("new car", "just add it", "register this"), call propose_register_vehicle — register-only, no hold; never invent a damage reason to force a hold. If it's unclear whether anything's wrong, ask. If lookup_vehicle_class returns unknown, ask the user for the make/model; never guess it.

When the user attaches a photo of a LOCATION DAILY VEHICLE INVENTORY sheet (a Hertz "Location Daily Vehicle Inventory" form — columns Owning Area, Unit Number, License, Class, Status, Notes; status codes A=Available, D=Dirty, M=Mechanical, B=Body, F=Foreign) and asks whether a vehicle is on it, or to read it ("is LUR150 on last night's inventory?", "which of these are on the sheet?", "read me the sheet"), read the handwritten rows and answer FROM THAT PHOTO:
- Match the plate/unit the OPERATOR asked for against the License/Unit columns. Their spelling is authoritative and the sheet is handwritten, so tolerate messy characters — ESPECIALLY a hand-drawn U that reads like M or N. This fleet's Manitoba plates start with ${MB_PLATE_PREFIXES.join(', ')}; a prefix like LMR/KMR/LNR is just a misread U, so snap it to the known one (LMR→LUR, KMR→KUR). Also watch easily-confused digits (0/6, 1/7, 4/9). A close handwriting match to the asked-for plate IS a match; lookup_vehicle auto-corrects these MB-prefix misreads, so use it with the operator's plate to confirm a real fleet vehicle.
- Whenever you match something you did NOT read exactly, SHOW YOUR WORK: name what the sheet shows and what you matched it to ("the sheet shows 'KMR250', which I read as your KUR250") so they catch a bad read before walking to the wrong stall. If you're torn between two rows, say so and give both — never a silent guess.
- When you find it, report that row's Status (expand the code: M = Mechanical, B = Body, A = Available, D = Dirty, F = Foreign) and any Notes. If the Status cell is BLANK but the Notes imply a status, INFER it and say both — a "PM"/preventive-maintenance or other maintenance note means Mechanical (M) (FG itself models PM as a mechanical sub-type), and a windshield-crack/dent/scratch/bumper note means Body (B). Phrase it as "Status cell is blank, but the PM note puts it under Mechanical (M)". If it isn't there, say plainly it's not on this inventory. Do NOT confuse the sheet's own Status codes with FG holds; just report what the sheet says (plus that one blank-cell inference). This read is one-time — the sheet is not stored, so answer only from the photo in front of you.

When the user wants to IMPORT THE SCHEDULE from a photo ("I want to import the new schedule", "load the schedule from a photo"), that's done on the Schedule screen — confirm it's possible and call propose_navigation with destination "schedule-import" to OFFER to take them there. More generally, if they want to go to or do something that lives on another screen (lost & found, issue log, my shift, check-in, movement log), offer propose_navigation for the right destination. Phrase it as an offer — "That's on the Schedule screen — want me to take you there?" — and let the confirm card do the navigating. Never claim you navigated or performed the action yourself.

When the operator asks you to REMEMBER something about them, or states a lasting preference or fact clearly worth recalling on a future day ("remember that I run mids", "I prefer set schedules over rotating"), call propose_memory with ONE concise fact phrased about them — it DRAFTS a confirm card and is never saved until they tap it. Don't propose a memory for one-off task requests or things that change every shift, and never propose one that's already in your standing notes (check Context first — if you already know it, just say so). Your saved standing notes about the operator appear in Context — use them to personalize naturally, never recite them back as a list.

When the operator (or a management email they read to you) asks what's HELD, what's held for maintenance, or to "send the held list", call lookup_held — it reads the live holds and returns each held vehicle with its reason, answering across any day, not just this shift. It's distinct from lookup_issues (facility/building issues, not vehicle holds). Read the result back naturally as a list; if it's empty, say nothing is currently held.

When the operator asks WHERE a specific vehicle is or was SENT ("where's LFJ285?", "where did we send LUR170?", "has KUR250 gone out?"), call lookup_vehicle_location — it reads that vehicle's trip history (airport runs / overflow moves) and reports where it was last sent and when, answering across days even though the Movement Log screen only shows today. Distinct from lookup_vehicle, which gives a vehicle's status and holds rather than where it went. Report the last-sent destination and day plainly; if there's no trip on record, say it hasn't been logged out (it may have gone out under a different plate).

When the operator asks you to REMIND them of a task for their next/upcoming shift ("remind me to pack the airport tomorrow", "remind me to check LFJ285", "leave a note for next shift"), call propose_reminder with the task in their own words — it DRAFTS a confirm card that, once tapped, lands on their My Shift whiteboard for the NEXT shift and auto-clears the shift after. Keep propose_reminder distinct from propose_memory: a reminder is a one-off next-shift TASK ("pack the airport"), a memory is a durable FACT about them ("I run mids"). Never claim you saved or scheduled it yourself — just that it's drafted to land on their next shift.

When the operator says they SENT vehicles to an overflow spot ("these went to AV Flight", "log LFJ379 and LUR175 to FastAir", "sent the keytags to the airport"), call propose_overflow_log with the plates (read from their words OR from any keytag photos they attached) and the destination (AV Flight, FastAir, or Airport). It DRAFTS a confirm card; on their tap the client logs each vehicle so it shows in the Movement Log and answers "where's X?" days later — the whole point is that later, when management emails "where are these vehicles?", they can just ask you (call lookup_vehicle_location) instead of asking around. Never claim you logged them yourself — just that it's drafted for their tap. This is ONLY for overflow sends; a damaged/held vehicle is still a hold, not an overflow log.

When the operator asks for the whole overflow MANIFEST — "what was sent and where?", "where are the overflow cars?", "what did I send this shift?" — call lookup_sent. Use scope "current" (the default) for where everything is NOW (this is the answer to a "where are these vehicles?" management email, even days later); use scope "shift" only when they specifically ask about THIS shift's sends (the end-of-shift report). It returns the vehicles grouped by spot — read it back as a clean grouped list they can copy into a reply. Use lookup_sent for the whole list, and lookup_vehicle_location for one named vehicle.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'lookup_vehicle',
    description:
      'Look up a fleet vehicle by license plate or unit number and report its identity, any ACTIVE holds (blocking), and any RELEASED holds (recent history/context). Use whenever the user asks whether there is "anything on" a vehicle, or about its status, holds, or damage.',
    input_schema: {
      type: 'object',
      properties: {
        plate: {
          type: 'string',
          description: 'License plate or unit number as the user said it, e.g. "LUR187" or "1234567".',
        },
      },
      required: ['plate'],
    },
  },
  {
    name: 'propose_hold',
    description:
      'Draft a damage/mechanical/detail hold on an existing fleet vehicle for the user to confirm. Use when the user wants to flag or hold a vehicle. This does NOT create the hold — it returns a draft the user must tap to confirm. Only works for a vehicle already on record.',
    input_schema: {
      type: 'object',
      properties: {
        plate: { type: 'string', description: 'License plate or unit number of the vehicle to hold.' },
        hold_type: {
          type: 'string',
          enum: ['damage', 'mechanical', 'detail', 'hail'],
          description: 'The kind of hold. Default "damage".',
        },
        damage_description: {
          type: 'string',
          description: 'Short description of what is wrong, e.g. "cracked windshield", "bumper scuff".',
        },
      },
      required: ['plate', 'damage_description'],
    },
  },
  {
    name: 'propose_register_and_hold',
    description:
      'Draft REGISTER + hold for a plate NOT yet in the fleet (the user wants to flag a vehicle that is not on record). Gather the vehicle details first, then call this. Does NOT write — returns a draft the user must tap to confirm.',
    input_schema: {
      type: 'object',
      properties: {
        plate: { type: 'string', description: 'License plate.' },
        unit_number: { type: 'string', description: 'Fleet unit number.' },
        make: { type: 'string', description: 'e.g. "Toyota".' },
        model: { type: 'string', description: 'e.g. "Camry".' },
        year: { type: 'integer', description: 'Model year, e.g. 2025.' },
        color: { type: 'string', description: 'e.g. "White".' },
        hold_type: { type: 'string', enum: ['damage', 'mechanical', 'detail', 'hail'], description: 'Default "damage".' },
        damage_description: { type: 'string', description: 'What is wrong, e.g. "cracked windshield".' },
      },
      required: ['plate', 'unit_number', 'make', 'model', 'year', 'color', 'damage_description'],
    },
  },
  {
    name: 'propose_register_vehicle',
    description:
      'Register a NEW-TO-FLEET vehicle with NO hold — the car is clean, nothing wrong, the operator just wants FG to know it exists (so it later resolves in "where\'s X?", overflow logging, and inventory reads). Read the fields off the KEY TAG (Veh # → unit, Lic Plate, class code → call lookup_vehicle_class for make+model, colour/body line). Use THIS (not propose_register_and_hold) when there is no damage to flag. Does NOT write — returns a draft the user taps to confirm; if the plate is already on record, say so.',
    input_schema: {
      type: 'object',
      properties: {
        plate: { type: 'string', description: 'License plate.' },
        unit_number: { type: 'string', description: 'Fleet unit number (join the digit groups).' },
        make: { type: 'string', description: 'e.g. "Kia".' },
        model: { type: 'string', description: 'e.g. "Sportage Hybrid" (from lookup_vehicle_class).' },
        year: { type: 'integer', description: 'Model year, e.g. 2026.' },
        color: { type: 'string', description: 'e.g. "Gray".' },
      },
      required: ['plate', 'unit_number', 'make', 'model', 'year', 'color'],
    },
  },
  {
    name: 'lookup_schedule',
    description:
      'Look up who is on which shift for a date — e.g. "who\'s closing with me tonight?". Works from any screen. Defaults to today; pass shift_type to narrow (e.g. "closing").',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'ISO date YYYY-MM-DD. Omit for today.' },
        shift_type: {
          type: 'string',
          enum: ['opening', 'mid', 'closing'],
          description: 'Narrow to one shift, e.g. "closing" for "who\'s closing".',
        },
      },
      required: [],
    },
  },
  {
    name: 'lookup_my_shift',
    description:
      "The asking user's OWN upcoming shifts + rough scheduled hours (\"when am I working?\", \"am I closing this week?\"). Defaults to the next 7 days. This is NOT the dollar pay estimate — that lives on the My Shift card.",
    input_schema: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Days ahead to include (default 7).' } },
      required: [],
    },
  },
  {
    name: 'search_lost_found',
    description:
      'Search the lost & found for current (not-yet-returned) items, optionally by text (description / location / plate). E.g. "any lost items?", "did anyone turn in a black wallet?".',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional text to match against description/location/plate.' },
        status: { type: 'string', enum: ['current', 'all'], description: 'Default current (unreturned).' },
      },
      required: [],
    },
  },
  {
    name: 'lookup_issues',
    description:
      'List open facility issues from the Issue Log ("any open issues?", "what\'s flagged?"). Defaults to open (uncleared).',
    input_schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['open', 'all'], description: 'Default open.' } },
      required: [],
    },
  },
  {
    name: 'propose_lost_item',
    description:
      'Draft a found item to log into lost & found for the user to confirm. Use when the user reports finding or turning in an item ("someone left a black wallet in the back seat of LUR224", "log a phone charger found under the seat"). This does NOT log it — it returns a draft the user must tap to confirm.',
    input_schema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Short description of the item, e.g. "black leather wallet", "USB-C phone charger".',
        },
        location: {
          type: 'string',
          enum: [...LOST_ITEM_LOCATIONS],
          description: 'Where in the vehicle it was found — only if the user said so.',
        },
        license_plate: { type: 'string', description: 'Plate or unit of the vehicle it was found in, if mentioned.' },
        notes: { type: 'string', description: 'Any extra context the user gives.' },
      },
      required: ['description'],
    },
  },
  {
    name: 'propose_memory',
    description:
      'Draft a durable note to REMEMBER about the operator, for them to confirm. Use when they explicitly ask you to remember something ("remember that I run mids", "remember my sister is learning to drive") OR state a lasting preference/fact clearly worth recalling next time. NOT for one-off task requests or transient status. This does NOT save it — it returns a draft the operator taps to confirm. Keep it to a single concise fact.',
    input_schema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The single concise fact to remember, phrased about the operator (e.g. "Runs mid shifts", "Prefers set schedules over rotating").',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'propose_navigation',
    description:
      'Offer to take the user to a screen for something that lives there. Use when they want to DO something the chat can\'t do inline — MOST IMPORTANTLY import a schedule from a photo (destination "schedule-import"). Returns a confirm card the user taps to navigate; do NOT pretend to do the action in chat yourself.',
    input_schema: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          enum: [...NAV_DESTINATIONS],
          description: 'Where to take them — "schedule-import" to import a schedule photo.',
        },
      },
      required: ['destination'],
    },
  },
  {
    name: 'lookup_vehicle_class',
    description:
      'Resolve a Hertz vehicle CLASS CODE (e.g. "CCVL", "CUES") to its make and model. Use when reading a key tag — the tag prints a class code plus model year (e.g. "CCVL 25"), not the make/model spelled out. Returns make + model; an unknown code means you should ask the user for the make/model rather than guess.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The class code from the tag, e.g. "CCVL" (a trailing year like "25" is fine).' },
      },
      required: ['code'],
    },
  },
  {
    name: 'lookup_held',
    description:
      'List the vehicles currently on an ACTIVE hold and WHY — the "what\'s held", "held for maintenance", or "send me the held list" question (often a management email asking what\'s held / where vehicles are). Reads live, so it answers across any day, not just this shift. Read-only; no input.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'lookup_vehicle_location',
    description:
      'Where a specific vehicle was last SENT / where it currently is — "where\'s LFJ285?", "where did we send LUR170?", "has KUR250 gone out?". Reads the vehicle\'s trip history (airport runs / overflow moves), so it answers ACROSS DAYS, not just this shift — the exact "where are these vehicles?" management email, days later. Read-only. Different from lookup_vehicle (status/holds for one vehicle) and lookup_held (the whole held list).',
    input_schema: {
      type: 'object',
      properties: {
        plate: { type: 'string', description: 'The plate or unit number of the vehicle, e.g. "LFJ285" or "142".' },
      },
      required: ['plate'],
    },
  },
  {
    name: 'lookup_sent',
    description:
      'The overflow MANIFEST — which vehicles are at which overflow spot (AV Flight / FastAir / Airport), grouped, for the operator to copy into a reply. Two scopes: "current" (default) = where every overflow vehicle is NOW (latest send per vehicle, across days) — answers "where are the overflow cars?" / a management email even days later; "shift" = only what was sent THIS shift — the end-of-shift report ("what did I send this shift?"). Read-only. Use this for the WHOLE list; lookup_vehicle_location is for one named vehicle.',
    input_schema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['current', 'shift'],
          description: '"current" = where everything is now (default); "shift" = just what was sent this shift.',
        },
      },
    },
  },
  {
    name: 'propose_reminder',
    description:
      'Draft a note to leave on the operator\'s SHIFT WHITEBOARD for their NEXT shift, for them to confirm — a one-off task or heads-up they want surfaced next shift ("remind me to pack the airport tomorrow", "remind me to check LFJ285", "note for next shift: overflow to AV Flight"). DIFFERENT from propose_memory: a reminder is a transient next-shift TASK that auto-clears after that shift; a memory is a durable FACT about the operator. Does NOT write — returns a confirm card the operator taps; it then lands on their My Shift whiteboard for the next shift and clears the shift after.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The reminder in the operator\'s own words, e.g. "Pack the airport" or "Check LFJ285 for the windshield".',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'propose_overflow_log',
    description:
      'Log where vehicles were SENT to overflow at end of shift — the spots FG fills beyond the main lot. "these went to AV Flight", "log LFJ379 and LUR175 to FastAir", "log the keytags to the airport". Read the plates from the operator\'s words OR from keytag photos they attach. DRAFTS a confirm card (never writes) listing the vehicles + destination; on the tap the client logs one completed one-way trip each, so they show in the Movement Log and answer "where\'s X?" days later. Use this ONLY for sends to the overflow spots below — not for a normal held/hold action.',
    input_schema: {
      type: 'object',
      properties: {
        plates: {
          type: 'array',
          items: { type: 'string' },
          description: 'The plates or unit numbers sent, e.g. ["LFJ379", "LUR175"]. Read from the message or from attached keytag photos.',
        },
        destination: {
          type: 'string',
          enum: [...OVERFLOW_DESTINATIONS],
          description: 'Where they were sent. "Airport" = Richardson International.',
        },
      },
      required: ['plates', 'destination'],
    },
  },
];

/** Canonical plate form for matching — mirrors src/lib/vehicleByPlate.ts normalizePlate. */
function normalizePlate(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** The minimal vehicle row the tools work from. */
interface VehicleRow {
  id: string;
  license_plate: string;
  unit_number: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
}

/** Resolve a plate/unit to its fleet row (RLS-scoped), matched in JS like the app does. */
async function resolveVehicleRow(supabase: SupabaseClient, rawPlate: string): Promise<VehicleRow | null> {
  const norm = normalizePlate(rawPlate);
  if (!norm) return null;
  // Also try the MB-prefix-corrected form, so a handwriting/keytag misread (KMR250 →
  // KUR250) still resolves. Only snaps a not-in-fleet prefix to a known one, so it
  // can add a match but never breaks the exact one (checked first).
  const corrected = correctManitobaPrefix(norm);
  // The fleet is small and plates aren't stored normalized, so match in JS the same
  // way the app does (allVehicles.find). RLS limits the rows to this user's reach.
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, license_plate, unit_number, make, model, year, color')
    .is('archived_at', null);
  if (error) throw error;
  return (
    (vehicles ?? []).find((v) => {
      const plate = normalizePlate(v.license_plate ?? '');
      return (
        plate === norm ||
        plate === corrected ||
        (v.unit_number ? normalizePlate(v.unit_number) === norm : false)
      );
    }) ?? null
  );
}

function toVehicleFact(row: VehicleRow): VehicleFact {
  return {
    plate: row.license_plate,
    unitNumber: row.unit_number ?? null,
    year: row.year ?? null,
    make: row.make ?? null,
    model: row.model ?? null,
    color: row.color ?? null,
  };
}

/** Run the read-only vehicle lookup as the asking user (RLS-scoped via the JWT client). */
async function executeLookup(supabase: SupabaseClient, rawPlate: string): Promise<VehicleLookupResult> {
  const match = await resolveVehicleRow(supabase, rawPlate);
  if (!match) return summarizeLookup(rawPlate, null, []);

  // ACTIVE holds block; RELEASED holds are worth-knowing context (esp. verbal
  // overrides). Embed the release detail so the answer can name who authorized it.
  const { data: holdRows, error: hErr } = await supabase
    .from('holds')
    .select(
      'hold_type, status, damage_description, flagged_at, flagged_by_name, releases(release_method, release_type, override_authorization)',
    )
    .eq('vehicle_id', match.id)
    .in('status', ['ACTIVE', 'RELEASED']);
  if (hErr) throw hErr;

  const holds: HoldFact[] = (holdRows ?? []).map((h) => {
    const rel = Array.isArray(h.releases) ? h.releases[0] : h.releases;
    return {
      holdType: h.hold_type,
      status: h.status,
      damageDescription: h.damage_description ?? '',
      flaggedAt: h.flagged_at,
      flaggedByName: h.flagged_by_name ?? null,
      release: rel
        ? { method: rel.release_method, type: rel.release_type, authorizedBy: rel.override_authorization ?? null }
        : null,
    };
  });

  return summarizeLookup(rawPlate, toVehicleFact(match), holds);
}

/**
 * Draft a hold for an EXISTING vehicle — resolves it and builds a proposal. NEVER
 * writes: the proposal goes to the client as a confirm card, and only a user tap
 * calls the real addHold. The tool result tells the model the draft is pending so
 * it won't claim the hold was created.
 */
async function executeProposeHold(
  supabase: SupabaseClient,
  input: { plate?: string; hold_type?: string; damage_description?: string },
): Promise<{ toolResult: string; proposal: HoldProposal | null }> {
  const match = await resolveVehicleRow(supabase, input.plate ?? '');
  if (!match) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: `No vehicle on record for "${input.plate ?? ''}". It would have to be registered before a hold can be opened.`,
      }),
    };
  }
  const proposal = buildHoldProposal(
    { vehicleId: match.id, plate: match.license_plate, label: describeVehicle(toVehicleFact(match)) },
    (input.hold_type ?? 'damage').toLowerCase(),
    input.damage_description ?? '',
  );
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown to the user; do NOT say the hold is created, just that it is drafted for them to confirm',
    }),
  };
}

/**
 * Draft REGISTER + hold for an UNKNOWN plate — the AI gathered the vehicle details.
 * NEVER writes: the proposal goes to the client, and only a confirm tap calls the
 * real addVehicle then addHold. Refuses if the plate is already in the fleet (use
 * propose_hold instead).
 */
async function executeProposeRegisterHold(
  supabase: SupabaseClient,
  input: {
    plate?: string;
    unit_number?: string;
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    hold_type?: string;
    damage_description?: string;
  },
): Promise<{ toolResult: string; proposal: RegisterHoldProposal | null }> {
  const existing = await resolveVehicleRow(supabase, input.plate ?? '');
  if (existing) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: `"${input.plate ?? ''}" is already on record (${describeVehicle(toVehicleFact(existing))}). Use a normal hold, not registration.`,
      }),
    };
  }
  const missing = (['plate', 'unit_number', 'make', 'model', 'year', 'color'] as const).filter(
    (k) => input[k] === undefined || input[k] === null || `${input[k]}`.trim() === '',
  );
  if (missing.length > 0) {
    return {
      proposal: null,
      toolResult: JSON.stringify({ ok: false, reason: `Still need: ${missing.join(', ')}. Ask the user for these before proposing.` }),
    };
  }
  const proposal = buildRegisterHoldProposal(
    {
      unitNumber: `${input.unit_number}`.trim(),
      plate: `${input.plate}`.trim().toUpperCase(),
      make: `${input.make}`.trim(),
      model: `${input.model}`.trim(),
      year: Number(input.year),
      color: `${input.color}`.trim(),
    },
    (input.hold_type ?? 'damage').toLowerCase(),
    input.damage_description ?? '',
  );
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is registered/held, just that it is drafted for them to confirm',
    }),
  };
}

/**
 * Draft a register-ONLY (new to fleet, no hold) for a plate not yet on record.
 * NEVER writes: the client calls addVehicle on the confirm tap. Mirrors the
 * register-and-hold guards (already-on-record, missing fields) minus the hold.
 */
async function executeProposeRegisterVehicle(
  supabase: SupabaseClient,
  input: { plate?: string; unit_number?: string; make?: string; model?: string; year?: number; color?: string },
): Promise<{ toolResult: string; proposal: RegisterVehicleProposal | null }> {
  const existing = await resolveVehicleRow(supabase, input.plate ?? '');
  if (existing) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: `"${input.plate ?? ''}" is already on record (${describeVehicle(toVehicleFact(existing))}). Nothing to register.`,
      }),
    };
  }
  const missing = (['plate', 'unit_number', 'make', 'model', 'year', 'color'] as const).filter(
    (k) => input[k] === undefined || input[k] === null || `${input[k]}`.trim() === '',
  );
  if (missing.length > 0) {
    return {
      proposal: null,
      toolResult: JSON.stringify({ ok: false, reason: `Still need: ${missing.join(', ')}. Read them off the key tag or ask the user before proposing.` }),
    };
  }
  const proposal = buildRegisterVehicleProposal({
    unitNumber: `${input.unit_number}`.trim(),
    plate: `${input.plate}`.trim().toUpperCase(),
    make: `${input.make}`.trim(),
    model: `${input.model}`.trim(),
    year: Number(input.year),
    color: `${input.color}`.trim(),
  });
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is registered, just that it is drafted for them to confirm',
    }),
  };
}

const SCHED_TZ = 'America/Winnipeg'; // FG is a single-region YWG pilot
function todayInWinnipeg(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: SCHED_TZ }); // YYYY-MM-DD
}
function scheduleDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}
/** "Saturday, June 27, 2026" — weekday + full date so the model can anchor bare dates. */
function todayLabelWinnipeg(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** Read-only: who's on which shift for a date ("who's closing with me tonight?"). */
async function executeLookupSchedule(
  supabase: SupabaseClient,
  userId: string,
  input: { date?: string; shift_type?: string },
): Promise<string> {
  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : todayInWinnipeg();
  const { data: shiftRows, error } = await supabase.from('shifts').select('user_id, shift_type').eq('date', date);
  if (error) throw error;
  // "Who's on WITH me" — exclude the asker from their own roster (this tool is always
  // "with me" framed). Mirrors the cockpit's teammatesOnToday self-filter. If the asker
  // is the only one on a shift, that group is empty → "nobody else", which is correct.
  const rows = (shiftRows ?? []).filter((r) => r.user_id !== userId);

  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids);
    for (const p of profs ?? []) names.set(p.id, p.name ?? 'Unknown');
  }

  const byType = new Map<string, string[]>();
  for (const r of rows) {
    const list = byType.get(r.shift_type) ?? [];
    list.push(names.get(r.user_id) ?? 'Unknown');
    byType.set(r.shift_type, list);
  }
  const groups: ScheduleGroup[] = [...byType].map(([shiftType, people]) => ({ shiftType, people }));
  const shiftType = typeof input.shift_type === 'string' ? input.shift_type : undefined;
  return JSON.stringify({ date, groups, summary: formatSchedule(scheduleDateLabel(date), groups, shiftType) });
}

function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Read-only: the asking user's own upcoming shifts + rough scheduled hours. */
async function executeLookupMyShift(supabase: SupabaseClient, userId: string, input: { days?: number }): Promise<string> {
  const days = Number.isFinite(input.days) ? Math.max(1, Math.min(31, Number(input.days))) : 7;
  const start = todayInWinnipeg();
  const end = addDaysISO(start, days);
  const { data, error } = await supabase
    .from('shifts')
    .select('date, shift_type')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  if (error) throw error;
  const rows: MyShiftRow[] = (data ?? []).map((r) => ({ dateLabel: scheduleDateLabel(r.date), shiftType: r.shift_type }));
  return JSON.stringify({ from: start, to: end, summary: formatMyShifts(rows) });
}

/** Read-only: current (unreturned) lost & found items, optionally text-matched. */
async function executeSearchLostFound(supabase: SupabaseClient, input: { query?: string; status?: string }): Promise<string> {
  let q = supabase
    .from('lost_found')
    .select('description, location, found_at, license_plate, resolved_at')
    .order('found_at', { ascending: false });
  if (input.status !== 'all') q = q.is('resolved_at', null);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data ?? [];
  const query = (input.query ?? '').trim().toLowerCase();
  if (query) {
    const terms = query.split(/\s+/);
    rows = rows.filter((r) => {
      const hay = `${r.description ?? ''} ${r.location ?? ''} ${r.license_plate ?? ''}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  const items: LostItem[] = rows.map((r) => ({
    description: r.description ?? '',
    location: r.location ?? null,
    foundLabel: scheduleDateLabel((r.found_at ?? '').slice(0, 10)),
    plate: r.license_plate ?? null,
  }));
  return JSON.stringify({ count: items.length, summary: formatLostFound(items, query || undefined) });
}

/** Read-only: open (uncleared) facility issues from the Issue Log. */
async function executeLookupIssues(supabase: SupabaseClient, input: { status?: string }): Promise<string> {
  let q = supabase
    .from('facility_issues')
    .select('title, severity, reported_at, cleared_at')
    .order('reported_at', { ascending: false });
  if (input.status !== 'all') q = q.is('cleared_at', null);
  const { data, error } = await q;
  if (error) throw error;
  const items: IssueRow[] = (data ?? []).map((r) => ({
    title: r.title,
    severity: r.severity,
    reportedLabel: scheduleDateLabel((r.reported_at ?? '').slice(0, 10)),
  }));
  return JSON.stringify({ count: items.length, summary: formatIssues(items) });
}

/** Read-only: vehicles currently on an ACTIVE hold, grouped by vehicle with their
 *  reasons — the "what's held and why" / "held for maintenance" list management asks
 *  for. Reads live from the holds table, so it answers across any day (the Movement
 *  Log view is day-scoped; this is not). Archived/out-of-fleet vehicles are dropped. */
async function executeLookupHeld(supabase: SupabaseClient): Promise<string> {
  const { data: holds, error } = await supabase
    .from('holds')
    .select('vehicle_id, hold_type, mechanical_sub_type, damage_description, flagged_at')
    .eq('status', 'ACTIVE')
    .order('flagged_at', { ascending: true });
  if (error) throw error;

  const ids = [...new Set((holds ?? []).map((h) => h.vehicle_id))];
  const veh = new Map<string, string>(); // vehicleId → display id (unit ?? plate)
  if (ids.length > 0) {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, unit_number, license_plate, archived_at')
      .in('id', ids)
      .is('archived_at', null);
    for (const v of vehicles ?? []) veh.set(v.id, v.unit_number ?? v.license_plate ?? 'Unknown');
  }

  const byVehicle = new Map<string, string[]>();
  for (const h of holds ?? []) {
    const label = veh.get(h.vehicle_id);
    if (!label) continue; // archived / not found — out of fleet
    const reason =
      (h.damage_description ?? '').trim() ||
      [h.hold_type, h.mechanical_sub_type].filter(Boolean).join(' · ') ||
      'held';
    (byVehicle.get(label) ?? byVehicle.set(label, []).get(label)!).push(reason);
  }
  const held = [...byVehicle.entries()].map(([id, reasons]) => `${id} — ${reasons.join('; ')}`);
  return JSON.stringify({ count: held.length, held });
}

/** Read-only: where a vehicle was last SENT, from its trip history (vsa_trips).
 *  Answers "where's LFJ285?" ACROSS DAYS — the Movement Log SCREEN is day-scoped,
 *  but the trip DATA persists here. Trips key off free-text plate/unit (no
 *  vehicle_id), so we match in JS like resolveVehicleRow does — robust to how a
 *  plate was typed. Returns the latest trip plus a short recent history. */
async function executeLookupVehicleLocation(supabase: SupabaseClient, rawPlate: string): Promise<string> {
  const norm = normalizePlate(rawPlate);
  if (!norm) return JSON.stringify({ found: false, note: 'No plate given.' });

  // Resolve the fleet row (if any) so we can also match on its canonical plate/unit,
  // not just what the operator typed.
  const vehicle = await resolveVehicleRow(supabase, rawPlate);
  const ids = new Set<string>([norm]);
  if (vehicle?.license_plate) ids.add(normalizePlate(vehicle.license_plate));
  if (vehicle?.unit_number) ids.add(normalizePlate(vehicle.unit_number));

  // The table grows slowly (a handful of runs a day); a generous recent window
  // covers many months, and matching in JS sidesteps free-text formatting drift.
  const { data: trips, error } = await supabase
    .from('vsa_trips')
    .select('vehicle_plate, vehicle_unit, depart_location, arrive_location, depart_time, trip_type, status')
    .order('depart_time', { ascending: false })
    .limit(500);
  if (error) throw error;

  const mine = (trips ?? []).filter(
    (t) => ids.has(normalizePlate(t.vehicle_plate ?? '')) || ids.has(normalizePlate(t.vehicle_unit ?? '')),
  );
  const label = vehicle?.unit_number ?? vehicle?.license_plate ?? rawPlate.trim();
  if (mine.length === 0) {
    return JSON.stringify({
      plate: label,
      found: false,
      tripCount: 0,
      note: 'No trip on record — never logged out, or logged under a different plate.',
    });
  }

  const toEntry = (t: (typeof mine)[number]) => ({
    destination: t.arrive_location ?? t.depart_location ?? 'unknown',
    when: scheduleDateLabel(new Date(t.depart_time).toLocaleDateString('en-CA', { timeZone: SCHED_TZ })),
    tripType: t.trip_type,
    status: t.status,
  });
  return JSON.stringify({
    plate: label,
    found: true,
    tripCount: mine.length,
    lastSent: toEntry(mine[0]),
    recent: mine.slice(0, 5).map(toEntry),
  });
}

/** Read-only: the overflow manifest — which vehicles are at which overflow spot,
 *  grouped, for the operator to copy into a reply. scope 'current' = latest send per
 *  vehicle across days (where everything is NOW — the "where are these vehicles?"
 *  email); scope 'shift' = only what was sent this shift-day (the end-of-shift report).
 *  Both dedup to the latest send per vehicle, so a moved car shows its newest spot. */
async function executeLookupSent(supabase: SupabaseClient, input: { scope?: string }): Promise<string> {
  const scope = input.scope === 'shift' ? 'shift' : 'current';
  const { data, error } = await supabase
    .from('vsa_trips')
    .select('vehicle_plate, vehicle_unit, arrive_location, depart_time')
    .in('arrive_location', [...OVERFLOW_DESTINATIONS])
    .order('depart_time', { ascending: false })
    .limit(1000);
  if (error) throw error;

  let rows = data ?? [];
  if (scope === 'shift') {
    const today = shiftBusinessDate(new Date());
    rows = rows.filter((r) => r.depart_time && shiftBusinessDate(new Date(r.depart_time)) === today);
  }
  // Dedup to the latest send per vehicle (rows are newest-first). A returned/re-sent
  // car reflects its newest spot; there's no return-logging, so this is "last sent".
  const seen = new Set<string>();
  const byDest = new Map<string, string[]>();
  for (const r of rows) {
    const label = r.vehicle_unit || r.vehicle_plate || 'Unknown';
    const key = label.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const dest = r.arrive_location ?? 'Unknown';
    (byDest.get(dest) ?? byDest.set(dest, []).get(dest)!).push(label);
  }
  const groups = [...byDest.entries()].map(([destination, vehicles]) => ({
    destination,
    count: vehicles.length,
    vehicles,
  }));
  return JSON.stringify({ scope, total: seen.size, groups });
}

/**
 * Draft a found item for lost & found — NEVER writes. The proposal goes to the
 * client as a confirm card, and only a user tap calls the real addLostFoundItem
 * (which resolves the plate, stamps found_by/found_at, and uploads any photos).
 * Pure — no DB read needed; the AI parsed the item from the user's words.
 */
function executeProposeLostItem(input: {
  description?: string;
  location?: string;
  license_plate?: string;
  notes?: string;
}): { toolResult: string; proposal: LostItemProposal | null } {
  const description = (input.description ?? '').trim();
  if (!description) {
    return {
      proposal: null,
      toolResult: JSON.stringify({ ok: false, reason: 'Need a short description of the item first — ask the user what it is.' }),
    };
  }
  const proposal = buildLostItemProposal({
    description,
    location: input.location ?? null,
    licensePlate: input.license_plate ?? null,
    notes: input.notes ?? null,
  });
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeLostItemProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is logged, just that it is drafted for them to confirm',
    }),
  };
}

/** Draft a memory to save about the operator. Pure — the write happens on the
 *  client's confirm tap (insert into effie_memory), never here. */
function executeProposeMemory(input: { content?: string }): { toolResult: string; proposal: MemoryProposal | null } {
  const proposal = buildMemoryProposal({ content: input.content ?? null });
  if (!proposal) {
    return {
      proposal: null,
      toolResult: JSON.stringify({ ok: false, reason: 'Need the specific thing to remember first — ask the operator what to note.' }),
    };
  }
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeMemoryProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is saved, just that it is drafted for them to confirm',
    }),
  };
}

/** Draft a next-shift whiteboard reminder. Pure — the write (a shift_board note filed
 *  under the operator's next shift-day) happens on the client's confirm tap, never here. */
function executeProposeReminder(input: { text?: string }): { toolResult: string; proposal: ReminderProposal | null } {
  const text = (input.text ?? '').trim();
  if (!text) {
    return {
      proposal: null,
      toolResult: JSON.stringify({ ok: false, reason: 'Need the reminder text first — ask the operator what to note for next shift.' }),
    };
  }
  const proposal = buildReminderProposal(text);
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeReminderProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is saved, just that it is drafted to land on their next shift',
    }),
  };
}

/**
 * Draft a batch of overflow sends — resolve each plate to a fleet row (so the trip
 * logs the canonical plate/unit) and build a confirm proposal. NEVER writes: the
 * client logs one completed one-way trip per vehicle only on the tap. Unresolved
 * plates are kept and flagged so the operator sees them before confirming.
 */
async function executeProposeOverflowLog(
  supabase: SupabaseClient,
  input: { plates?: string[]; destination?: string },
): Promise<{ toolResult: string; proposal: OverflowLogProposal | null }> {
  const destination = (input.destination ?? '') as OverflowDestination;
  const plates = (input.plates ?? []).map((p) => (p ?? '').trim()).filter(Boolean);
  if (!OVERFLOW_DESTINATIONS.includes(destination) || plates.length === 0) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: 'Need at least one plate and a destination of AV Flight, FastAir, or Airport.',
      }),
    };
  }
  const vehicles: OverflowVehicle[] = [];
  for (const raw of plates) {
    const row = await resolveVehicleRow(supabase, raw);
    if (row) {
      vehicles.push({
        plate: row.license_plate,
        unit: row.unit_number ?? null,
        label: row.unit_number ? `Unit ${row.unit_number}` : row.license_plate,
        unresolved: false,
      });
    } else {
      vehicles.push({ plate: normalizePlate(raw), unit: null, label: raw.trim(), unresolved: true });
    }
  }
  const proposal = buildOverflowProposal(destination, vehicles);
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      drafted: `${vehicles.length} vehicle(s) → ${destination}`,
      unresolved: vehicles.filter((v) => v.unresolved).map((v) => v.label),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is logged, just that it is drafted to log on their tap',
    }),
  };
}

/**
 * Offer to navigate the user to a screen. NEVER writes or navigates — it returns a
 * confirm card the client renders; only the user's tap navigates (and even then, only
 * changes screens, no data write). Safe by construction.
 */
function executeProposeNavigation(input: { destination?: string }): { toolResult: string; proposal: NavigateProposal | null } {
  const proposal = buildNavigateProposal(input.destination ?? '');
  if (!proposal) {
    return { proposal: null, toolResult: JSON.stringify({ ok: false, reason: 'Unknown destination — only offer a known screen.' }) };
  }
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      offered: proposal.label,
      awaiting: 'user confirmation — a confirm card is shown; do NOT say you navigated, just offer to take them there',
    }),
  };
}

/** Read-only: resolve a key-tag class code to make/model (pure codex lookup, no I/O). */
function executeLookupVehicleClass(input: { code?: string }): string {
  const vc = lookupVehicleClass(input.code);
  if (!vc) {
    return JSON.stringify({
      ok: false,
      code: input.code ?? '',
      reason: 'Unknown class code — ask the user for the make and model.',
    });
  }
  return JSON.stringify({ ok: true, make: vc.make, model: vc.model });
}

export default async function handler(req: FgRequest, res: FgResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Everything is wrapped: a throw anywhere — env read, createClient, the
  // Anthropic constructor, the tool loop — is logged (Vercel runtime logs) AND
  // returned as JSON for the FAB to show. Nothing escapes as a blind platform 500.
  //
  // Buffer-then-send (not res.write streaming): a Vercel serverless res doesn't
  // reliably accept writes from inside an SDK event listener — that throw is
  // uncaught and 500s the function. Tier 1 answers are a sentence or two, so we
  // run the loop, collect the final turn's text, and send it once.
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!apiKey || !supabaseUrl || !supabaseAnonKey) {
      res.status(500).json({ error: 'Assistant is not configured.' });
      return;
    }

    // Require the caller's Supabase session — reads run as this crew member (RLS).
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Cost gate: this runs on a personal Anthropic key, so the assistant is gated to
    // the allowlisted account(s). Validate the JWT (getUser verifies the signature —
    // a forged token can't pass and reach a billable Claude call) and check the
    // employee ID (the part before @fleet-garage.internal) against the allowlist.
    // Empty allowlist = open to all authed.
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

    const messages = (req.body?.messages ?? []) as Anthropic.MessageParam[];
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'No messages provided.' });
      return;
    }

    const anthropic = new Anthropic({ apiKey });
    const convo: Anthropic.MessageParam[] = [...messages];

    // Context-awareness: the FAB sends the screen the user is on. Tell the model so
    // it can be relevant ("you're on My Shift") — but it can still answer about any
    // module (the schedule/vehicle tools work from anywhere).
    const moduleName = typeof req.body?.module === 'string' ? req.body.module : '';
    const callSign = typeof req.body?.callSign === 'string' ? req.body.callSign.trim() : '';
    const todayISO = todayInWinnipeg();
    const contextBits = [
      `Today is ${todayLabelWinnipeg(todayISO)} (${todayISO}, America/Winnipeg). When the user names a date or day with no year ("July 3", "this Friday", "tomorrow"), resolve it to the CURRENT year / the nearest such day — never a past year.`,
    ];
    if (callSign) contextBits.push(`Address the operator as "${callSign}" — not by their profile name.`);
    if (moduleName) contextBits.push(`The user is currently on the "${moduleName}" screen — be relevant to it, but answer anything they ask.`);
    // Effie's durable memory (#2): inject the operator's saved facts so she personalizes.
    const { data: memRows } = await supabase
      .from('effie_memory')
      .select('content')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .limit(20); // bound the context — a fact store, not a transcript
    const memories = (memRows ?? []).map((m) => m.content).filter((c): c is string => !!c);
    if (memories.length > 0) {
      contextBits.push(`Standing notes the operator asked you to remember (use them naturally; don't recite the list): ${memories.map((m) => `• ${m}`).join(' ')}`);
    }
    const system = `${SYSTEM_PROMPT}\n\nContext: ${contextBits.join(' ')}`;

    // Tier 3 vision: a damage photo (base64 data URL) rides alongside the turns.
    // Attach it to the latest user message as an image block, and give that request
    // the vision model. Parsed defensively — a bad value is just ignored.
    const image = parseImageDataUrl(req.body?.image);
    if (image && convo.length > 0) {
      const last = convo[convo.length - 1];
      if (last.role === 'user' && typeof last.content === 'string') {
        const text = last.content.trim();
        last.content = [
          ...(text ? [{ type: 'text', text } as Anthropic.TextBlockParam] : []),
          { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
        ];
      }
    }
    const model = image ? VISION_MODEL : MODEL;

    let answer = '';
    let proposal: Proposal | null = null; // a drafted hold / register+hold to confirm, if any
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const message = await anthropic.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system,
        tools: TOOLS,
        messages: convo,
      });

      if (message.stop_reason !== 'tool_use') {
        answer = message.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        break;
      }

      const toolUses = message.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      convo.push({ role: 'assistant', content: message.content });

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        let content: string;
        try {
          if (tu.name === 'propose_hold') {
            const out = await executeProposeHold(
              supabase,
              tu.input as { plate?: string; hold_type?: string; damage_description?: string },
            );
            if (out.proposal) proposal = out.proposal; // captured out-of-band for the client
            content = out.toolResult;
          } else if (tu.name === 'propose_register_and_hold') {
            const out = await executeProposeRegisterHold(
              supabase,
              tu.input as Parameters<typeof executeProposeRegisterHold>[1],
            );
            if (out.proposal) proposal = out.proposal;
            content = out.toolResult;
          } else if (tu.name === 'propose_register_vehicle') {
            const out = await executeProposeRegisterVehicle(
              supabase,
              tu.input as Parameters<typeof executeProposeRegisterVehicle>[1],
            );
            if (out.proposal) proposal = out.proposal;
            content = out.toolResult;
          } else if (tu.name === 'lookup_schedule') {
            content = await executeLookupSchedule(supabase, userData.user.id, tu.input as { date?: string; shift_type?: string });
          } else if (tu.name === 'lookup_my_shift') {
            content = await executeLookupMyShift(supabase, userData.user.id, tu.input as { days?: number });
          } else if (tu.name === 'search_lost_found') {
            content = await executeSearchLostFound(supabase, tu.input as { query?: string; status?: string });
          } else if (tu.name === 'lookup_issues') {
            content = await executeLookupIssues(supabase, tu.input as { status?: string });
          } else if (tu.name === 'lookup_held') {
            content = await executeLookupHeld(supabase);
          } else if (tu.name === 'lookup_vehicle_location') {
            content = await executeLookupVehicleLocation(supabase, (tu.input as { plate?: string }).plate ?? '');
          } else if (tu.name === 'lookup_sent') {
            content = await executeLookupSent(supabase, tu.input as { scope?: string });
          } else if (tu.name === 'propose_navigation') {
            const out = executeProposeNavigation(tu.input as { destination?: string });
            if (out.proposal) proposal = out.proposal; // captured out-of-band for the client
            content = out.toolResult;
          } else if (tu.name === 'lookup_vehicle_class') {
            content = executeLookupVehicleClass(tu.input as { code?: string });
          } else if (tu.name === 'propose_lost_item') {
            const out = executeProposeLostItem(
              tu.input as { description?: string; location?: string; license_plate?: string; notes?: string },
            );
            if (out.proposal) proposal = out.proposal; // captured out-of-band for the client
            content = out.toolResult;
          } else if (tu.name === 'propose_memory') {
            const out = executeProposeMemory(tu.input as { content?: string });
            if (out.proposal) proposal = out.proposal; // captured out-of-band for the client
            content = out.toolResult;
          } else if (tu.name === 'propose_reminder') {
            const out = executeProposeReminder(tu.input as { text?: string });
            if (out.proposal) proposal = out.proposal; // captured out-of-band for the client
            content = out.toolResult;
          } else if (tu.name === 'propose_overflow_log') {
            const out = await executeProposeOverflowLog(supabase, tu.input as { plates?: string[]; destination?: string });
            if (out.proposal) proposal = out.proposal; // captured out-of-band for the client
            content = out.toolResult;
          } else {
            const plate = (tu.input as { plate?: string }).plate ?? '';
            content = JSON.stringify(await executeLookup(supabase, plate));
          }
        } catch {
          content = JSON.stringify({ error: 'That action failed — could not read vehicle records.' });
        }
        results.push({ type: 'tool_result', tool_use_id: tu.id, content });
      }
      convo.push({ role: 'user', content: results });
    }

    // Envelope: text answer + an optional drafted hold the client renders as a
    // confirm card. The proxy never writes — the write happens on the user's tap.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ text: answer || '(no answer)', proposal });
  } catch (err) {
    console.error('[fg-chat] handler error:', err);
    res.status(500).json({ error: `Assistant error: ${err instanceof Error ? err.message : String(err)}` });
  }
}
