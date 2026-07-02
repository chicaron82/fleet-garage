// A drafted "remember this about the operator" the AI proposes but never writes.
// Pure (tested), like lostItemProposal: the proxy builds one from the model's tool
// call, the client renders it as a confirm card, and only the user's tap writes the
// row to effie_memory. Self-contained — api/_lib must NOT cross-import src (Vercel
// transpiles functions, so a cross-dir import ERR_MODULE_NOT_FOUNDs at runtime); the
// client re-declares the shape and maps it back.

export interface MemoryProposal {
  kind: 'memory';
  content: string;
}

/** Max stored length of a single memory — a fact, not an essay. */
export const MEMORY_MAX_LEN = 280;

/** Build a memory proposal from the model's tool input. Pure — no I/O, no write.
 *  Returns null when there's no usable content, so the caller can ask for specifics
 *  instead of drafting an empty memory. */
export function buildMemoryProposal(input: { content?: string | null }): MemoryProposal | null {
  const content = (input.content ?? '').replace(/\s+/g, ' ').trim().slice(0, MEMORY_MAX_LEN);
  if (!content) return null;
  return { kind: 'memory', content };
}

/** Short confirmation line for the tool result / runtime logs. */
export function describeMemoryProposal(p: MemoryProposal): string {
  return `Drafted a memory to save: "${p.content}" — awaiting the operator's confirm tap.`;
}
