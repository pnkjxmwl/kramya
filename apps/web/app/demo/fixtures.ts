/**
 * The demo hospital. Every byte of it is invented, on purpose.
 *
 * **Nothing here touches the API, a session, or a tenant.** That is the entire
 * security argument for a page anyone on the internet can open: there is no auth to
 * bypass because there is no auth, and no data to leak because none of this exists.
 * `Call next` moves a number in React state and nothing else happens anywhere.
 *
 * The alternative - a real read-only demo tenant - would have meant a public path
 * through `JwtGuard -> RolesGuard -> TenantGuard`, which is a hole in the one
 * pipeline docs/CLAUDE.md 8 says must never have one. Not worth it to avoid a
 * fixture file.
 *
 * **The cost is drift.** These screens imitate the console; they are not the console,
 * and a change to the real board will not reach them. That is a real maintenance debt
 * and the reason everything here is shaped like the contracts in `@opd/contracts`
 * rather than invented freehand - when this does drift, the diff is legible.
 *
 * ponytail: hand-maintained fixtures. If the console's board changes shape more than
 * once or twice, generate these from a recorded API response instead.
 */

export type DemoStatus =
  | 'CHECKED_IN'
  | 'CONFIRMED'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'NO_SHOW';

export interface DemoEntry {
  id: string;
  token: string;
  patient: string;
  /** ONLINE booked from the app, WALK_IN registered at the counter. */
  type: 'ONLINE' | 'WALK_IN';
  status: DemoStatus;
  /** Minutes since they checked in; null when they have not arrived. */
  waitingMins: number | null;
}

export const HOSPITAL = {
  name: 'Sunrise Multispeciality',
  area: 'Andheri West, Mumbai',
  department: 'General Medicine',
  doctor: 'Dr Anjali Rao',
  window: '10:00 AM – 1:00 PM',
  feeRupees: 500,
};

/**
 * A queue mid-clinic, which is the only state worth showing.
 *
 * An empty queue proves nothing - no one being served, no one waiting, no ETA to
 * compute. This one has two people already seen, one in the room, four checked in and
 * waiting, and two booked who have not arrived. Those last two are the whole product:
 * they are at home watching this screen move.
 */
export const INITIAL_QUEUE: DemoEntry[] = [
  { id: 'e1', token: 'G001', patient: 'Ramesh Gupta', type: 'WALK_IN', status: 'COMPLETED', waitingMins: null },
  { id: 'e2', token: 'G002', patient: 'Sunita Patil', type: 'ONLINE', status: 'COMPLETED', waitingMins: null },
  { id: 'e3', token: 'G003', patient: 'Imtiaz Khan', type: 'ONLINE', status: 'IN_CONSULTATION', waitingMins: 21 },
  { id: 'e4', token: 'G004', patient: 'Deepa Nair', type: 'ONLINE', status: 'CHECKED_IN', waitingMins: 18 },
  { id: 'e5', token: 'G005', patient: 'Harpreet Singh', type: 'WALK_IN', status: 'CHECKED_IN', waitingMins: 14 },
  { id: 'e6', token: 'G006', patient: 'Lata Mishra', type: 'ONLINE', status: 'CHECKED_IN', waitingMins: 9 },
  { id: 'e7', token: 'G007', patient: 'Joseph Mathew', type: 'WALK_IN', status: 'CHECKED_IN', waitingMins: 4 },
  { id: 'e8', token: 'G008', patient: 'Aarav Semwal', type: 'ONLINE', status: 'CONFIRMED', waitingMins: null },
  { id: 'e9', token: 'G009', patient: 'Fatima Sheikh', type: 'ONLINE', status: 'CONFIRMED', waitingMins: null },
];

/** Somebody to register when the visitor presses "Add walk-in". */
export const NEXT_WALK_IN = { patient: 'Nikhil Save', token: 'G010' };

export const STATUS_LABEL: Record<DemoStatus, string> = {
  CHECKED_IN: 'Checked in',
  CONFIRMED: 'Booked',
  IN_CONSULTATION: 'With doctor',
  COMPLETED: 'Seen',
  NO_SHOW: 'No-show',
};

/**
 * Admin-side fixtures: today's programme, the shape the Overview screen shows.
 *
 * Deliberately includes a finished session and one that has not started. A demo where
 * everything is running hides the two states an administrator most often opens the
 * console to check.
 */
export const DEMO_SESSIONS = [
  { doctor: 'Dr Anjali Rao', dept: 'General Medicine', window: '10:00 – 13:00', status: 'Running', waiting: 4 },
  { doctor: 'Dr Vikram Desai', dept: 'Cardiology', window: '10:30 – 13:30', status: 'Running', waiting: 6 },
  { doctor: 'Dr Sanjay Bhatt', dept: 'Orthopaedics', window: '09:00 – 11:00', status: 'Finished', waiting: 0 },
  { doctor: 'Dr Kavita Shah', dept: 'Dermatology', window: '14:00 – 17:00', status: 'Not started', waiting: 0 },
];

export const DEMO_DEPARTMENTS = [
  { name: 'General Medicine', doctors: 2, openToday: 2 },
  { name: 'Cardiology', doctors: 2, openToday: 1 },
  { name: 'Orthopaedics', doctors: 1, openToday: 0 },
  { name: 'Dermatology', doctors: 1, openToday: 1 },
];
