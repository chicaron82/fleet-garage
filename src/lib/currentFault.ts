// ⭐ The rule lives in api/_lib/currentFault so the SERVER (Effie's lookup_issues) and the app derive
// "what's wrong with this machine now" from ONE function — the same arrangement as tagColour. Vercel
// functions can't import from src/, so the shared code sits under api/ and the app re-exports it.
// docs/September/ticket-reopens-invisible-downstream.md
export * from '../../api/_lib/currentFault';
