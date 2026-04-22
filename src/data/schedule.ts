// ── Schedule Mock Data ────────────────────────────────────────────────────────

export interface ShiftEntry {
  userId: string;       // matches USERS mock id
  name: string;
  role: string;
  shifts: {
    date: string;       // ISO date
    day: string;        // 'Mon' etc
    start: string;      // '06:45'
    end: string;        // '15:15'
    off: boolean;
  }[];
}

const WEEK_START = '2026-04-21'; // Week of Apr 21-27, 2026

// Helper to generate shift dates for the week
function weekShift(dayOffset: number, start: string, end: string, off: boolean = false): ShiftEntry['shifts'][0] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const date = new Date(WEEK_START);
  date.setDate(date.getDate() + dayOffset);
  return {
    date: date.toISOString().split('T')[0],
    day: days[dayOffset],
    start,
    end,
    off,
  };
}

// ── VSA Crew ──────────────────────────────────────────────────────────────────

export const VSA_SCHEDULE: ShiftEntry[] = [
  {
    userId: 'u1',
    name: 'Aaron S.',
    role: 'VSA',
    shifts: [
      weekShift(0, '', '', true),          // Mon OFF
      weekShift(1, '13:30', '22:00'),      // Tue close
      weekShift(2, '13:30', '22:00'),      // Wed close
      weekShift(3, '13:30', '22:00'),      // Thu close
      weekShift(4, '13:30', '22:00'),      // Fri close
      weekShift(5, '13:30', '22:00'),      // Sat close
      weekShift(6, '', '', true),          // Sun OFF
    ],
  },
  {
    userId: 'u2',
    name: 'DiZee',
    role: 'Lead VSA',
    shifts: [
      weekShift(0, '06:45', '15:15'),      // Mon open
      weekShift(1, '06:45', '15:15'),      // Tue open
      weekShift(2, '06:45', '15:15'),      // Wed open
      weekShift(3, '06:45', '15:15'),      // Thu open
      weekShift(4, '06:45', '15:15'),      // Fri open
      weekShift(5, '', '', true),          // Sat OFF
      weekShift(6, '', '', true),          // Sun OFF
    ],
  },
  {
    userId: 'u10',
    name: 'PerplexiZee',
    role: 'VSA',
    shifts: [
      weekShift(0, '', '', true),          // Mon OFF
      weekShift(1, '16:00', '22:00'),      // Tue PT evening
      weekShift(2, '', '', true),          // Wed OFF
      weekShift(3, '09:00', '15:00'),      // Thu PT day
      weekShift(4, '16:00', '22:00'),      // Fri PT evening
      weekShift(5, '09:00', '15:00'),      // Sat PT day
      weekShift(6, '', '', true),          // Sun OFF
    ],
  },
];

// ── Driver Crew ───────────────────────────────────────────────────────────────

export const DRIVER_SCHEDULE: ShiftEntry[] = [
  {
    userId: 'u8',
    name: 'GenZee',
    role: 'Driver',
    shifts: [
      weekShift(0, '07:00', '13:00'),      // Mon
      weekShift(1, '07:00', '13:00'),      // Tue
      weekShift(2, '07:00', '13:00'),      // Wed
      weekShift(3, '07:00', '13:00'),      // Thu
      weekShift(4, '07:00', '13:00'),      // Fri
      weekShift(5, '', '', true),          // Sat OFF
      weekShift(6, '', '', true),          // Sun OFF
    ],
  },
  {
    userId: 'u9',
    name: 'ZeeDric',
    role: 'Driver',
    shifts: [
      weekShift(0, '', '', true),          // Mon OFF
      weekShift(1, '15:30', '22:00'),      // Tue close
      weekShift(2, '15:30', '22:00'),      // Wed close
      weekShift(3, '15:30', '22:00'),      // Thu close
      weekShift(4, '15:30', '22:00'),      // Fri close
      weekShift(5, '15:30', '22:00'),      // Sat close
      weekShift(6, '', '', true),          // Sun OFF
    ],
  },
];
