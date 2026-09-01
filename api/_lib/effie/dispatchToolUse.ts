// Effie tool-use dispatch — routes ONE tool_use block to its executor and returns the tool_result
// content, plus any out-of-band proposal / photo-request the client renders separately. Extracted
// from fg-chat.ts (2026-08-03) so the handler stays a thin request/auth/loop shell and the ~18-tool
// routing table lives in one named home beside the executors it calls. Pure move — no behaviour
// change: the branch order, input casts, and the catch-all fallback are identical to the original.
import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PHOTO_CONTEXTS, type PhotoContext } from '../photoRequest.js';
import { type Proposal } from '../holdProposal.js';
import {
  executeLookup,
  executeProposeHold,
  executeProposeRegisterHold,
  executeProposeUpdateAndHold,
  executeProposeRegisterVehicle,
  executeLookupSchedule,
  executeLookupMyShift,
  executeSearchLostFound,
  executeLookupIssues,
  executeLookupHeld,
  executeLookupVehicleLocation,
  executeLookupSent,
  executeProposeLostItem,
  executeProposeMemory,
  executeProposeReminder,
  executeProposeEvent,
  executeProposeOverflowLog,
  executeProposeUnsend,
  executeProposeNavigation,
  executeLookupVehicleClass,
} from '../effieExecutors.js';

export interface ToolDispatchResult {
  content: string; // the tool_result content string handed back to the model
  proposal?: Proposal; // an out-of-band drafted proposal, when this tool produced one
  photoRequest?: PhotoContext; // an inline upload button to show, when Effie asked for a photo
}

/**
 * Execute a single tool_use block. Reads run RLS-scoped through `supabase` (the caller's token);
 * schedule tools also need `userId`. Never throws — any executor failure collapses to a generic
 * error tool_result so one bad tool call can't 500 the whole turn.
 */
export async function dispatchToolUse(
  tu: Anthropic.ToolUseBlock,
  supabase: SupabaseClient,
  userId: string,
): Promise<ToolDispatchResult> {
  try {
    if (tu.name === 'propose_hold') {
      const out = await executeProposeHold(
        supabase,
        tu.input as { plate?: string; hold_type?: string; damage_description?: string },
      );
      return { content: out.toolResult, ...(out.proposal ? { proposal: out.proposal } : {}) };
    } else if (tu.name === 'propose_register_and_hold') {
      const out = await executeProposeRegisterHold(
        supabase,
        tu.input as Parameters<typeof executeProposeRegisterHold>[1],
      );
      return { content: out.toolResult, ...(out.proposal ? { proposal: out.proposal } : {}) };
    } else if (tu.name === 'propose_update_and_hold') {
      const out = await executeProposeUpdateAndHold(
        supabase,
        tu.input as Parameters<typeof executeProposeUpdateAndHold>[1],
      );
      return { content: out.toolResult, ...(out.proposal ? { proposal: out.proposal } : {}) };
    } else if (tu.name === 'propose_register_vehicle') {
      const out = await executeProposeRegisterVehicle(
        supabase,
        tu.input as Parameters<typeof executeProposeRegisterVehicle>[1],
      );
      return { content: out.toolResult, ...(out.proposal ? { proposal: out.proposal } : {}) };
    } else if (tu.name === 'lookup_schedule') {
      const content = await executeLookupSchedule(supabase, userId, tu.input as { date?: string; shift_type?: string });
      return { content };
    } else if (tu.name === 'lookup_my_shift') {
      const content = await executeLookupMyShift(supabase, userId, tu.input as { days?: number });
      return { content };
    } else if (tu.name === 'search_lost_found') {
      const content = await executeSearchLostFound(supabase, tu.input as { query?: string; status?: string });
      return { content };
    } else if (tu.name === 'lookup_issues') {
      const content = await executeLookupIssues(supabase, tu.input as { status?: string });
      return { content };
    } else if (tu.name === 'lookup_held') {
      const content = await executeLookupHeld(supabase);
      return { content };
    } else if (tu.name === 'lookup_vehicle_location') {
      const content = await executeLookupVehicleLocation(supabase, (tu.input as { plate?: string }).plate ?? '');
      return { content };
    } else if (tu.name === 'lookup_sent') {
      const content = await executeLookupSent(supabase, tu.input as { scope?: string; date?: string });
      return { content };
    } else if (tu.name === 'propose_navigation') {
      const out = executeProposeNavigation(tu.input as { destination?: string });
      return { content: out.toolResult, ...(out.proposal ? { proposal: out.proposal } : {}) };
    } else if (tu.name === 'request_photo') {
      const ctx = (tu.input as { context?: string }).context;
      const photoRequest =
        ctx && (PHOTO_CONTEXTS as readonly string[]).includes(ctx) ? (ctx as PhotoContext) : undefined;
      const content = JSON.stringify({
        ok: true,
        note: 'An inline upload button is now shown in your reply. Ask the operator for the photo in one short line; do NOT describe the button itself.',
      });
      return { content, ...(photoRequest ? { photoRequest } : {}) };
    } else if (tu.name === 'lookup_vehicle_class') {
      return { content: executeLookupVehicleClass(tu.input as { code?: string }) };
    } else if (tu.name === 'propose_lost_item') {
      const out = executeProposeLostItem(
        tu.input as { description?: string; location?: string; license_plate?: string; notes?: string },
      );
      return { content: out.toolResult, ...(out.proposal ? { proposal: out.proposal } : {}) };
    } else if (tu.name === 'propose_memory') {
      const out = executeProposeMemory(tu.input as { content?: string });
      return { content: out.toolResult, ...(out.proposal ? { proposal: out.proposal } : {}) };
    } else if (tu.name === 'propose_event') {
      const out = executeProposeEvent(tu.input as { title?: string; date?: string; time?: string });
      return { content: out.toolResult, ...(out.proposal ? { proposal: out.proposal } : {}) };
    } else if (tu.name === 'propose_reminder') {
      const out = executeProposeReminder(tu.input as { text?: string });
      return { content: out.toolResult, ...(out.proposal ? { proposal: out.proposal } : {}) };
    } else if (tu.name === 'propose_unsend') {
      const out = await executeProposeUnsend(supabase, tu.input as { plate?: string; destination?: string; date?: string; time?: string; reason?: string });
      return { content: out.toolResult, ...(out.proposal ? { proposal: out.proposal } : {}) };
    } else if (tu.name === 'propose_overflow_log') {
      const out = await executeProposeOverflowLog(supabase, tu.input as { plates?: string[]; destination?: string });
      return { content: out.toolResult, ...(out.proposal ? { proposal: out.proposal } : {}) };
    } else {
      const plate = (tu.input as { plate?: string }).plate ?? '';
      return { content: JSON.stringify(await executeLookup(supabase, plate)) };
    }
  } catch {
    return { content: JSON.stringify({ error: 'That action failed — could not read vehicle records.' }) };
  }
}
