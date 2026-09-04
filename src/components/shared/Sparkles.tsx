// ✨ The flourish, as a primitive.
//
// ⭐⭐⭐ WHY THIS IS A COMPONENT AND NOT FIVE LINES INSIDE `Toast`. Aaron, 2026-09-04: *"there's
// something we dropped along the way while working on FG. we stopped being unapologetically bougie.
// functional is boring. bougie makes it a little exciting to work on and use."*
//
// The drift was real and measurable — 330 commits since the last one that treated *bougie* as a
// practice — and the cause was a hundred individually-defensible restraint arguments. **A principle
// that requires bespoke work every time will lose to restraint every time.** So the fix is not a
// paragraph in CLAUDE.md telling the next session to care; it is making the flourish cost one word.
//
// ⭐ It reads the preference ITSELF, so no call site has to remember to check it and none can
// forget. The caller's only job is the thing only the caller knows: *was this moment worth it?*
//
// ⚠️⚠️ AND IT FAILS OPEN. The first version called `usePreferences()`, which THROWS outside a
// provider — so adding a flourish to `Toast` made a pure presentational component crash without app
// context. **Decoration that can break its host is worse than no decoration**, and it hands the next
// restraint argument an unanswerable case.
//
// ⚠️ Reduced motion is handled in CSS (`.fg-sparkle`), not here — an accessibility floor belongs
// somewhere a component cannot opt out of.
import { useSparklesEnabled } from '../../context/PreferencesContext';

/** Where the glyphs sit — spread, and each a beat behind the last, so it reads as a shimmer rather
 *  than a flash. "Bougie" is his word for an ELEVATED ORDINARY THING, not confetti. */
const SPARKS: readonly { left: string; delay: string }[] = [
  { left: '8%',  delay: '0ms' },
  { left: '28%', delay: '120ms' },
  { left: '50%', delay: '60ms' },
  { left: '72%', delay: '180ms' },
  { left: '92%', delay: '240ms' },
];

/**
 * Drop into any positioned element to give it the flourish.
 *
 * ⚠️ PURELY DECORATIVE: `aria-hidden`, and outside the message text, so a screen reader hears the
 * news and never the confetti. The host must be positioned (Toast is `fixed`; an inline line needs
 * `relative`), because this fills it with `inset: 0`.
 */
export function Sparkles({ size = '0.9rem' }: { size?: string }) {
  // ⚠️ Never throws — see useSparklesEnabled. Decoration that can crash its host is worse
  // than no decoration at all.
  if (!useSparklesEnabled()) return null;

  return (
    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
      {SPARKS.map(s => (
        <span key={s.left} className="fg-sparkle"
          style={{ position: 'absolute', top: 0, left: s.left, animationDelay: s.delay, fontSize: size }}>✨</span>
      ))}
    </span>
  );
}
