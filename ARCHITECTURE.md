# Fleet Garage — Architecture Notes

## Write-First Pattern

Any feature that starts a timed session (trip, off-standard entry, or similar)
and needs to survive React component unmount (navigation, screen lock, tab switch)
MUST write to Supabase before updating React state.

**Rule:** `await supabase.insert()` → confirm success → THEN set state.

**Never:** set state optimistically, then delegate the write to a parent callback.

### Reference implementations
- `OffStandardTimeLog.handleStartWith` — canonical correct example
- `DriverLiveForm.handleDepart` — correct example
- `VSAMovementLog.handleStartTripWith` — fixed May 2026 (was the wrong pattern)

### Why this matters
Fleet Garage uses switch-case routing in App.tsx. Every module switch fully
unmounts the previous component. React state dies on unmount. If a Supabase
write hasn't landed before unmount, recovery queries find nothing and the
session appears to reset. This is silent — no error, no toast, just a blank form.

### New features checklist
Adding a new quick-start, timer, or session feature?
- [ ] Does the start handler await the Supabase insert before setting state?
- [ ] Does the component have a mount recovery useEffect querying in_progress?
- [ ] Does the reset handler clear the pendingId?
