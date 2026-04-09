# Fleet Garage — Dev Notes

## Resetting demo data

All vehicle and hold data is persisted in `localStorage` so it survives page refreshes and account switches. The seed data (from `src/data/mock.ts`) only loads on the very first visit when localStorage is empty.

**To reset back to the original mock data:**

1. Open DevTools (`F12`)
2. Go to **Application** tab → **Local Storage** → `http://localhost:5173`
3. Delete the two keys:
   - `fg_vehicles`
   - `fg_holds`
4. Refresh the page

Everything resets to the seed data.

---

## Demo accounts

All passwords: `demo`

| Employee ID | Name | Role | Can release holds? |
|---|---|---|---|
| 331965 | Aaron S. | VSA | No |
| VSA-002 | Marcus T. | VSA | No |
| VSA-003 | Priya S. | Lead VSA | No |
| CSR-001 | Jamie L. | CSR | No |
| HIR-001 | Dana K. | HIR | No |
| MGR-001 | Sandra V. | Branch Manager | Yes |
| OPS-001 | Trevor W. | Operations Manager | Yes |

---

## localStorage keys

| Key | Contents |
|---|---|
| `fg_vehicles` | Full vehicle list (JSON array) |
| `fg_holds` | Full hold + release history (JSON array) |
