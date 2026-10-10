// The one sentence the shared time limit owes him, held where any screen's failure can reach it.
//
// ⭐ WHY THIS IS NOT LEFT TO EACH SCREEN. When FG stops waiting on a save, the screen that sent it
// says its usual "didn't save — tap it again". For an update that is right. For a save that CREATES
// something (a hold, an issue, a trip) it is the wrong advice: the request may have landed, and
// tapping again makes a second one. 37 call sites would each have had to learn that, so the limit
// itself reports it once, here, and the shell shows it over whatever is open.

type Listener = (at: number | null) => void;

let lastAt: number | null = null;
const listeners = new Set<Listener>();

export function reportGaveUpOnCreate(now: number = Date.now()): void {
  lastAt = now;
  listeners.forEach(l => l(lastAt));
}

export function dismissGaveUp(): void {
  lastAt = null;
  listeners.forEach(l => l(null));
}

export function currentGaveUp(): number | null {
  return lastAt;
}

export function subscribeGaveUp(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
