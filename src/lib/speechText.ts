// Cleaning a chat reply before it's read aloud. Effie's bubbles render as PLAIN text
// (no markdown renderer), and the on-device TTS reads characters literally — so a
// "**bold**" both SHOWS as asterisks and gets SPOKEN as "asterisk asterisk". The real
// cure is upstream (the prompt tells Effie to write plain), but this is the guaranteed
// safety net for anything that slips through: strip markdown to what a human would say.

/** Strip markdown so the text reads naturally aloud — no "asterisk asterisk". Pure. */
export function stripForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')       // fenced code blocks
    .replace(/`([^`]+)`/g, '$1')           // `inline code`
    .replace(/\*\*([^*]+)\*\*/g, '$1')     // **bold**
    .replace(/__([^_]+)__/g, '$1')         // __bold__
    .replace(/\*([^*]+)\*/g, '$1')         // *italic*
    .replace(/(^|\s)#{1,6}\s+/g, '$1')     // # headers
    .replace(/^\s*[-*+]\s+/gm, '')         // - bullet markers
    .replace(/^\s*>\s?/gm, '')             // > blockquotes
    .replace(/\*/g, '')                    // any stray asterisk
    .replace(/[ \t]{2,}/g, ' ')            // collapse runs of spaces
    .trim();
}
