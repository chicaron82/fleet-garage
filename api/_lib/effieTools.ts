// Effie's tool definitions — the schema the model chooses from. Extracted verbatim
// from fg-chat; each tool's enum pulls from its own proposal/context module, so a new
// tool's schema lives beside its logic, not in a growing god-file.
import type Anthropic from '@anthropic-ai/sdk';
import { LOST_ITEM_LOCATIONS } from './lostItemProposal.js';
import { NAV_DESTINATIONS } from './navProposal.js';
import { OVERFLOW_DESTINATIONS } from './overflowProposal.js';
import { PHOTO_CONTEXTS } from './photoRequest.js';

export const TOOLS: Anthropic.Tool[] = [
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
    name: 'propose_update_and_hold',
    description:
      'Draft BACKFILL + hold in ONE confirm for a vehicle ALREADY ON RECORD but with missing identity fields (blank make/model/year/colour/unit), when there is damage to flag. The drop-n-go case: the operator drops a KEY TAG photo + a DAMAGE photo on a car that is on record but only partially filled in. Pass every identity field you read off the key tag AND the damage — the system fills ONLY the blanks (never overwrites a known field) and opens the hold together. Use propose_hold instead if the vehicle identity is already complete; use propose_register_and_hold if the plate is NOT on record. Does NOT write — returns a draft the user taps to confirm.',
    input_schema: {
      type: 'object',
      properties: {
        plate: { type: 'string', description: 'License plate — the vehicle to look up (must be on record).' },
        unit_number: { type: 'string', description: 'Unit number read from the key tag (fills if blank on record).' },
        make: { type: 'string', description: 'Make read from the key tag / class code (fills if blank).' },
        model: { type: 'string', description: 'Model from lookup_vehicle_class (fills if blank).' },
        year: { type: 'integer', description: 'Model year read from the key tag (fills if blank).' },
        color: { type: 'string', description: 'Colour read from the key tag (fills if blank).' },
        hold_type: { type: 'string', enum: ['damage', 'mechanical', 'detail', 'hail'], description: 'Default "damage".' },
        damage_description: { type: 'string', description: 'What is wrong, e.g. "scrape on the rear driver-side quarter panel".' },
      },
      required: ['plate', 'damage_description'],
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
      'Who ELSE is on shift — the roster of teammates the operator will work WITH on a date. This is the tool for ANY "who\'s on / who am I working with" question: "who am I working with today?", "who\'s on with me?", "who\'s closing tonight?", "who\'s on tomorrow?". Works from any screen. Defaults to today; pass shift_type to narrow (e.g. "closing"). Do NOT use lookup_my_shift for these — that one only knows the operator\'s own hours, not who else is on.',
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
      "ONLY the asking user's OWN shift days + rough hours — \"when am I working?\", \"am I closing this week?\", \"what days am I on?\". It does NOT know who ELSE is on; for \"who am I working WITH\" or \"who's on with me\", use lookup_schedule instead. Defaults to the next 7 days. This is NOT the dollar pay estimate — that lives on the My Shift card.",
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
    name: 'request_photo',
    description:
      'Ask the operator to attach a PHOTO — shows an inline upload button in your reply so they don\'t hunt for the camera. Call this whenever you need an image: a KEY TAG (to register or read a vehicle), a DAMAGE photo (for a hold), a LOST ITEM photo, or the daily INVENTORY sheet. Pair it with a short spoken ask ("Key tag photo, or read them off to me?"). Pass the context that matches what you\'re asking for — it captions the photo so you read it in the right frame (a key tag is NOT damage).',
    input_schema: {
      type: 'object',
      properties: {
        context: {
          type: 'string',
          enum: [...PHOTO_CONTEXTS],
          description: 'What kind of photo you\'re asking for: keytag, damage, lost_item, or inventory.',
        },
      },
      required: ['context'],
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
