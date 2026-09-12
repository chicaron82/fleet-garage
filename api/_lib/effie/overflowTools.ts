// Effie's OVERFLOW-domain tool schemas — the manifest reads and the two writes that maintain it.
//
// Split out of effieTools.ts when `propose_unsend` pushed that file past the 330-line cap
// (2026-09-01). It mirrors the split already made on the executor side: `effie/overflowExecutors.ts`
// owns exactly these three, and OVERFLOW_DESTINATIONS is imported by only this pair — so keeping
// the schemas beside their executors keeps that import local and gives the domain one home.
import type Anthropic from '@anthropic-ai/sdk';
import { OVERFLOW_DESTINATIONS } from '../overflowProposal.js';

export const OVERFLOW_TOOLS: Anthropic.Tool[] = [
  {
    name: 'lookup_sent',
    description:
      'The overflow MANIFEST — which vehicles are at which overflow spot (AV Flight / FastAir), grouped, for the operator to copy into a reply. TWO DIFFERENT QUESTIONS: "current" (default) = where every overflow vehicle is NOW (latest send per vehicle, across days) — answers "where are the overflow cars?" / a management email even days later. "day" (with a `date`) = WHAT WAS SENT on that specific day — "what went to FastAir yesterday?", "what did we send Saturday?", "what did I send this shift?" (omit the date for today). ⚠️ Ask for a DAY whenever the operator names or implies a day: "current" would answer with where things are NOW, which is a different and quietly wrong answer for a past day — a car sent yesterday and moved since would show its new spot and drop out of yesterday. A day answer lists every send that day with its time, so a car sent twice reads as two moves. Read-only. Use this for the WHOLE list; lookup_vehicle_location is for one named vehicle.',
    input_schema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['current', 'day', 'shift'],
          description: '"current" = where everything is now (default); "day" = what was sent on one day (pass `date`); "shift" = what was sent today.',
        },
        date: {
          type: 'string',
          description: 'The day to report, as YYYY-MM-DD, resolved against the "Today is" line. Passing a date always means that day, whatever the scope says. Omit for today.',
        },
      },
    },
  },
  {
    name: 'propose_unsend',
    description:
      'Remove a logged overflow send that NEVER ACTUALLY HAPPENED — "that one never went to FastAir", "take LUR247 off yesterday\'s FastAir list", "the driver took different cars, remove those". The send log is written from the INTENDED manifest, so when a driver ignores the note on the board the record keeps the plan instead of the reality; this is how the operator corrects it. ⚠️ If more than one send matches, the tool returns the candidates and NO draft — ASK the operator which one (by spot and time) and call again with `destination`/`date`/`time`. NEVER pick one yourself: a car sent to two spots in one day is exactly the case this exists for, and a wrong removal is invisible afterwards. Does NOT write — returns a draft the operator taps to confirm. Not for a car that DID go somewhere and later moved on: that is two real sends, and both belong on the record.',
    input_schema: {
      type: 'object',
      properties: {
        plate: { type: 'string', description: 'Plate or unit number of the vehicle, e.g. "LUR247" or "5424932".' },
        destination: { type: 'string', description: 'Which spot the bad send was logged to — "AV Flight" or "FastAir". Use it to narrow when several match.' },
        date: { type: 'string', description: 'The day the bad send was logged, YYYY-MM-DD, resolved against the "Today is" line. Use it to narrow when several match.' },
        time: { type: 'string', description: 'Local 24h time of the bad send, "HH:MM", exactly as the candidate list showed it. The last resort when a car was sent twice to the same spot on the same day.' },
        reason: { type: 'string', description: 'The operator\'s own words for why it did not go, if they said — e.g. "driver took different cars". Optional.' },
      },
      required: ['plate'],
    },
  },
  {
    name: 'propose_overflow_log',
    description:
      'Log where vehicles were SENT to overflow at end of shift — the spots FG fills beyond the main lot. "these went to AV Flight", "log LFJ379 and LUR175 to FastAir", "log the keytags to AV Flight". ⚠️ THE AIRPORT IS NOT AN OVERFLOW SPOT — a car sent to Richardson is in an O or P stall available for rent and the airport tracks it, so that is an ordinary trip, NOT this tool. DRAFTS a confirm card (never writes) listing the vehicles + destination; on the tap the client logs one completed one-way trip each, so they show in the Movement Log and answer "where\'s X?" days later. Use this ONLY for sends to the overflow spots below — not for a normal held/hold action. ⭐ IF THE OPERATOR ATTACHED KEY-TAG PHOTOS, DO NOT TRANSCRIBE THEM — call this tool and let it read them. It runs the same measured two-tier reader the scanner uses and keeps every field on the tag (unit, owning area, rental class, model code, VIN, colour), which registers a car FG does not know and fills the blanks on one it only half-knows. Anything you type from a photo instead is a second, worse read that throws the rest away. Pass `plates` for plates the operator SAID; omit it when the photos are the whole message.',
    input_schema: {
      type: 'object',
      properties: {
        plates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Plates or unit numbers the operator TYPED or SAID, e.g. ["LFJ379", "LUR175"]. ⚠️ NOT for plates you read off an attached photo — the tool reads those itself, properly. Omit entirely when key-tag photos are the whole message. A plate given here that a photo also covers is de-duplicated, so it is safe to include one the operator named explicitly.',
        },
        destination: {
          type: 'string',
          enum: [...OVERFLOW_DESTINATIONS],
          description: 'Where they were sent — the two spots used when the airport will not take more. A run to Richardson is not one of them.',
        },
      },
      // ⚠️ `plates` is no longer required: a stack of key-tag photos with "these went to FastAir"
      // is a complete instruction, and demanding a transcription is what made the model do the
      // reading badly in the first place.
      required: ['destination'],
    },
  },
];
