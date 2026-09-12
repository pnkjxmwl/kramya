#!/usr/bin/env node
/**
 * Stand up complete, browsable demo tenants on a DEPLOYED environment.
 *
 * ## Why this is not apps/api/src/seed.ts
 *
 * The seed writes rows straight to Postgres, refuses to run when NODE_ENV is
 * production, and refuses again if the database holds a hospital it did not create.
 * Both guards are correct and neither is worked around here - it is simply the wrong
 * tool for a live environment. It would also create staff accounts whose password
 * (`Demo@12345`) is committed in this repository, which on a public URL means anyone
 * who reads the repo can sign in as a hospital administrator.
 *
 * This does it the way the product actually does it:
 *
 *   1. `onboard.js` creates the hospital, its queue policy and an ADMIN **invitation**
 *      - the one bootstrap that has no API, because `Role` is ADMIN | RECEPTION |
 *        DOCTOR with nothing above it. Its own docstring says it exists to run
 *        against production.
 *   2. `POST /auth/accept-invite` turns that single-use token into a real account
 *      with a password YOU choose, passed in the environment and never logged.
 *   3. Everything after that is ordinary authenticated API calls, so every write goes
 *      through Zod validation, the guard pipeline, tenant scoping and the queue
 *      domain commands (docs/Rules.md 1, 2). Nothing it creates could be in a state
 *      the application itself would refuse to produce - which makes it a live smoke
 *      test of those paths as well as a fixture.
 *
 * ## Environment
 *
 * `DATABASE_URL` is needed ONLY for step 1, and only because hospital creation has no
 * endpoint. Put it in a gitignored file and source it - never on the command line,
 * where it lands in shell history:
 *
 *   apps/api/.env.render      DATABASE_URL="postgres://..."   (.env.* is gitignored)
 *
 *   set -a; . apps/api/.env.render; set +a
 *   API_URL=https://opd-api-koes.onrender.com ADMIN_PASSWORD='...' node scripts/demo-data.mjs
 *
 *   API_URL         the deployed API
 *   ADMIN_PASSWORD  password to set on each hospital admin (min 10 chars)
 *   DATABASE_URL    only for onboarding; omit to skip straight to populating
 *
 * Nothing prints DATABASE_URL or ADMIN_PASSWORD. The admin EMAIL is printed, because
 * you need it to sign in to the console afterwards.
 *
 * ## Idempotency
 *
 * Onboarding refuses a duplicate name+city, and that refusal is treated as success -
 * the script logs in with the existing admin instead. Departments and doctors are
 * matched by name. Sessions are unique on (doctor, date, start), and a duplicate is
 * RECOVERED rather than dropped, so a rerun still reaches queues an earlier run built.
 * Walk-ins top up to a target depth instead of being skipped, and the queue is only
 * advanced on a session nobody has worked yet - a queue cannot be un-called.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const API = (process.env.API_URL ?? 'https://opd-api-koes.onrender.com').replace(/\/+$/, '');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CAN_ONBOARD = Boolean(process.env.DATABASE_URL);

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 10) {
  console.error('Set ADMIN_PASSWORD (at least 10 characters). It is never logged.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// The tenants. Departments and doctor counts mirror the design reference in
// docs/design_handoff_opd_queue so the screens can be compared against it directly.
// ---------------------------------------------------------------------------

/** Unsplash, the same verified ids the development seed uses. */
const photo = (id) => `https://images.unsplash.com/${id}?w=900&q=80&auto=format&fit=crop`;

const HOSPITALS = [
  {
    name: 'Sunrise Multispeciality',
    city: 'Mumbai',
    area: 'Andheri West',
    address: 'Lokhandwala Complex, Andheri West, Mumbai 400053',
    photo: photo('photo-1519494026892-80bbd2d6fd0d'),
    admin: 'admin@sunrise.demo',
    clinic: [
      { dept: 'Cardiology', doctors: ['Anjali Rao', 'Vikram Desai'] },
      { dept: 'Orthopaedics', doctors: ['Sanjay Bhatt'] },
      { dept: 'General Medicine', doctors: ['Meera Iyer', 'Rakesh Kulkarni'] },
      { dept: 'Paediatrics', doctors: ['Farhan Qureshi'] },
      { dept: 'Dermatology', doctors: ['Kavita Shah'] },
      { dept: 'ENT', doctors: ['Sneha Pillai'] },
    ],
  },
  {
    name: 'Lotus Care Hospital',
    city: 'Mumbai',
    area: 'Bandra West',
    address: 'Hill Road, Bandra West, Mumbai 400050',
    photo: photo('photo-1629909613654-28e377c37b09'),
    admin: 'admin@lotuscare.demo',
    clinic: [
      { dept: 'Cardiology', doctors: ['Rajesh Khanna'] },
      { dept: 'Neurology', doctors: ['Shalini Bhatt'] },
      { dept: 'General Medicine', doctors: ['Nikhil Save', 'Priya Menon'] },
    ],
  },
  {
    name: 'Green Valley Clinic',
    city: 'Mumbai',
    area: 'Khar West',
    address: 'Linking Road, Khar West, Mumbai 400052',
    photo: photo('photo-1587351021759-3e566b6af7cc'),
    admin: 'admin@greenvalley.demo',
    clinic: [
      { dept: 'Orthopaedics', doctors: ['Ayesha Shaikh'] },
      { dept: 'Dermatology', doctors: ['Manav Trivedi'] },
    ],
  },
  {
    name: 'Nirmal Health Point',
    city: 'Bengaluru',
    area: 'Indiranagar',
    address: '100 Feet Road, Indiranagar, Bengaluru 560038',
    photo: photo('photo-1586773860418-d37222d8fce3'),
    admin: 'admin@nirmal.demo',
    clinic: [
      { dept: 'Paediatrics', doctors: ['Pooja Rane'] },
      { dept: 'General Medicine', doctors: ['Suresh Iyer'] },
    ],
  },
];

const SPECIALITY = {
  Cardiology: 'Interventional Cardiology',
  Orthopaedics: 'Joint Replacement',
  'General Medicine': 'Internal Medicine',
  Paediatrics: 'Neonatology',
  Dermatology: 'Clinical Dermatology',
  ENT: 'Otolaryngology',
  Neurology: 'Stroke Medicine',
};

const WALK_INS = [
  'Ramesh Gupta',
  'Sunita Patil',
  'Imtiaz Khan',
  'Deepa Nair',
  'Harpreet Singh',
  'Lata Mishra',
  'Joseph Mathew',
];

const FEE_PAISE = 50_000; // Rs 500 - the figure on the design's Join button.

// ---------------------------------------------------------------------------
// Time. IST is UTC+05:30 with no DST ever, so this is arithmetic rather than a
// timezone lookup - the same fixed-offset approach apps/api/src/common/ist.ts and
// apps/mobile/lib/format.ts both take.
//
// **Every window must contain "now".** A session whose scheduledEnd has passed is
// refused by registrationGate with SESSION_ENDED, which greys out the Join button and
// hides the state this data exists to show. Seeding a 10:00-13:00 clinic and looking
// at it at 23:00 gives you a screen full of "Registration closed" - correct, and
// useless. So the clinic starts two hours before now and runs three hours past it.
// ---------------------------------------------------------------------------

const IST_OFFSET_MIN = 330;
const istNow = new Date(Date.now() + IST_OFFSET_MIN * 60_000);
const TODAY = istNow.toISOString().slice(0, 10);
const nowMin = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();

const hhmm = (m) => {
  const c = Math.max(0, Math.min(1439, Math.round(m)));
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
};

/**
 * Staggered per doctor so the cards are not identical, but every window still
 * straddles now. Clamped inside the day because startTime/endTime are clock faces on
 * one calendar date - a window that ran past midnight would need tomorrow's date.
 */
function windowFor(index) {
  const start = Math.max(0, nowMin - 120 - (index % 4) * 20);
  const end = Math.min(1439, Math.max(start + 90, nowMin + 180 - (index % 3) * 15));
  return { startTime: hhmm(start), endTime: hhmm(end) };
}

const say = (line = '') => process.stdout.write(`${line}\n`);

// ---------------------------------------------------------------------------

async function api(method, pathname, body, token, retryWith) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  // Access tokens are short-lived and this makes hundreds of calls against a
  // free-tier host that can take a minute to wake, so expiry mid-run is ordinary.
  if (res.status === 401 && retryWith) {
    const fresh = await retryWith();
    return api(method, pathname, body, fresh, null);
  }
  if (!res.ok) {
    /*
      Include `details` and the route, not just `message`.

      The global filter returns { code, message, details } and a VALIDATION_FAILED
      message is the constant string "Request validation failed" - every field error
      lives in `details`. Throwing only the message produced a failure that named the
      problem class and nothing about which call or which field, which is a dead end
      at the exact moment you need a clue.
    */
    const detail = json?.error?.details ? ` ${JSON.stringify(json.error.details)}` : '';
    const err = new Error(
      `${method} ${pathname} -> ${json?.error?.message ?? `HTTP ${res.status}`}${detail}`,
    );
    err.code = json?.error?.code ?? String(res.status);
    err.status = res.status;
    throw err;
  }
  return json;
}

/** Create the hospital + policy + admin invite. Returns the single-use token. */
async function onboard(h) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      path.join(ROOT, 'apps/api/dist/onboard.js'),
      '--name', h.name,
      '--city', h.city,
      '--area', h.area,
      '--address', h.address,
      '--photo', h.photo,
      '--admin', h.admin,
    ],
    { cwd: path.join(ROOT, 'apps/api'), env: process.env, maxBuffer: 1024 * 1024 },
  );
  const match = stdout.match(/accept-invite\?token=(\S+)/);
  if (!match) throw new Error(`onboard produced no invite link:\n${stdout}`);
  return match[1];
}

async function main() {
  const done = [];
  const failed = [];
  say(`API: ${API}`);
  say(CAN_ONBOARD ? 'DATABASE_URL present - will onboard missing hospitals' : 'no DATABASE_URL - populate only');
  say('');

  for (const h of HOSPITALS) {
    say(`--- ${h.name}, ${h.city}`);

    // 1. Get an admin session, onboarding first if this tenant is new.
    let token = null;
    const login = async () => {
      const out = await api('POST', '/auth/login', { email: h.admin, password: ADMIN_PASSWORD });
      token = out.accessToken;
      return token;
    };

    try {
      await login();
      say(`    admin ${h.admin} already exists - signed in`);
    } catch {
      if (!CAN_ONBOARD) {
        say(`    SKIPPED: no admin account and no DATABASE_URL to onboard with`);
        failed.push(`${h.name} (no admin, no DATABASE_URL)`);
        continue;
      }
      try {
        const invite = await onboard(h);
        const out = await api('POST', '/auth/accept-invite', { token: invite, password: ADMIN_PASSWORD });
        token = out.accessToken;
        say(`    onboarded, invite accepted -> ${h.admin}`);
      } catch (e) {
        say(`    FAILED to onboard: ${e.message}`);
        failed.push(`${h.name} (onboard: ${e.message.split(String.fromCharCode(10))[0]})`);
        continue;
      }
    }

    const me = await api('GET', '/me', undefined, token, login);
    const admin = (me.memberships ?? []).find((m) => m.role === 'ADMIN' && m.status === 'ACTIVE');
    if (!admin) {
      say(`    FAILED: ${h.admin} is not an ACTIVE ADMIN anywhere`);
      failed.push(`${h.name} (admin not active)`);
      continue;
    }
    const H = admin.hospitalId;

    // 2. Departments.
    const deptByName = new Map(
      ((await api('GET', `/hospitals/${H}/departments?limit=100`, undefined, token, login)).items ?? [])
        .map((d) => [d.name, d]),
    );
    for (const { dept } of h.clinic) {
      if (deptByName.has(dept)) continue;
      deptByName.set(dept, await api('POST', `/hospitals/${H}/departments`, { name: dept }, token, login));
    }

    // 3. Doctors.
    const docByName = new Map(
      ((await api('GET', `/hospitals/${H}/doctors?limit=100`, undefined, token, login)).items ?? [])
        .map((d) => [d.name, d]),
    );
    for (const { dept, doctors } of h.clinic) {
      for (const n of doctors) {
        const full = `Dr ${n}`;
        if (docByName.has(full)) continue;
        docByName.set(
          full,
          await api('POST', `/hospitals/${H}/doctors`, {
            departmentId: deptByName.get(dept).id,
            name: full,
            specialization: SPECIALITY[dept] ?? dept,
            // Varied on purpose: a uniform consult time makes every ETA identical
            // and hides whether the engine is using it at all.
            defaultConsultMins: 8 + ((n.length + dept.length) % 8),
          }, token, login),
        );
      }
    }
    say(`    ${deptByName.size} departments, ${docByName.size} doctors`);

    // 4. Today's sessions, every window straddling now.
    const wanted = h.clinic.flatMap(({ dept, doctors }) =>
      doctors.map((n) => ({ dept, doctor: docByName.get(`Dr ${n}`) })),
    );
    const sessions = [];
    for (const [i, { dept, doctor }] of wanted.entries()) {
      const { startTime, endTime } = windowFor(i);
      try {
        const s = await api('POST', `/hospitals/${H}/sessions`, {
          doctorId: doctor.id,
          date: TODAY,
          startTime,
          endTime,
          feePaise: FEE_PAISE,
          tokenPrefix: dept.slice(0, 1).toUpperCase(),
        }, token, login);
        sessions.push({ ...s, doctor });
      } catch {
        /*
          Unique on (doctor, date, start): a rerun lands here, which is the point -
          but it must still RECOVER the session rather than drop it.

          The first version just swallowed the duplicate, so on any rerun `sessions`
          came back empty and every step after this one silently did nothing: "0
          sessions created, 0 queues filled" while four healthy clinics sat in the
          database. That made the script look idempotent when it was actually inert,
          and a change to the queue shape could never reach a session built earlier.
        */
        try {
          const mine = await api(
            'GET', `/doctors/${doctor.id}/sessions?limit=5`, undefined, token, login,
          );
          const today = (mine.items ?? [])[0];
          if (today) sessions.push({ ...today, doctor });
        } catch {
          // Genuinely unreachable session; the summary will show it missing.
        }
      }
    }
    say(`    ${sessions.length} sessions for ${TODAY} (IST), each spanning now`);

    // 5. Queues, seeded MID-CLINIC.
    //
    // An empty queue proves nothing: nowServingToken is null, "N ahead of you" is
    // zero, and the ETA engine has no history to blend. So one patient is seen and
    // finished and a second is with the doctor right now.
    let queued = 0;
    for (const [index, s] of sessions.entries()) {
      // CALL_NEXT is refused unless the doctor is present, and calling the first
      // patient is what makes a session ACTIVE - there is no start-session command.
      await api('POST', `/sessions/${s.id}/presence`, { presence: 'PRESENT' }, token, login);

      /*
        TOP UP rather than skip.

        This used to `continue` the moment a session had any entry at all, which made
        a re-run a no-op for every queue built by an earlier run - so a change to the
        shape of the fixture could never reach a session that already existed. It now
        reads how many are there and adds the difference, so re-running converges on
        the intended shape instead of freezing the first one that happened to be built.
      */
      const existing = await api('GET', `/sessions/${s.id}/queue?limit=100`, undefined, token, login);
      const have = (existing.items ?? []).length;
      const advanced = (existing.items ?? []).some(
        (e) => e.status === 'IN_CONSULTATION' || e.status === 'COMPLETED',
      );

      /*
        Queue depth varies by POSITION, not by the doctor's name.

        It used to be `4 + (doctor.name.length % 3)`. "Nikhil Save" and "Priya Menon"
        are both eleven characters, so the two General Medicine doctors at Lotus Care
        got identical queues - same walk-in count, same "now serving G002", and
        therefore the same ETA window to the millisecond, because snapshots() computes
        every card in one pass from a shared `now` and identical inputs give identical
        output. Two different doctors rendered as the same card, and it was reported as
        a bug in the app. The app was right; the fixture was indistinguishable.

        Position spreads properly: a name hash can collide, an index cannot.
      */
      // How far through the list the doctor is, and how many are behind them. Both
      // vary by index so no two cards on one screen can coincide.
      const seen = index % 3; // 0, 1 or 2 finished before the one in the room
      const target = 4 + (index % 6) + seen;
      for (let i = have; i < target; i += 1) {
        await api('POST', `/sessions/${s.id}/walk-in`, {
          name: WALK_INS[(index * 3 + i) % WALK_INS.length],
          gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
        }, token, login);
      }

      // Only on a queue nobody has worked yet. Calling next while someone is already
      // in the room is refused by the state machine, and correctly so.
      if (!advanced) {
        for (let i = 0; i < seen; i += 1) {
          const done = await api('POST', `/sessions/${s.id}/call-next`, {}, token, login);
          await api('POST', `/sessions/${s.id}/start-consultation`, { entryId: done.entry.id }, token, login);
          await api('POST', `/sessions/${s.id}/complete-consultation`, { entryId: done.entry.id }, token, login);
        }
        const current = await api('POST', `/sessions/${s.id}/call-next`, {}, token, login);
        await api('POST', `/sessions/${s.id}/start-consultation`, { entryId: current.entry.id }, token, login);
      }
      queued += 1;
    }
    say(`    ${queued} queues topped up (walk-ins, varied depth, one in consultation)`);
    say('');
    done.push(h);
  }

  /*
    Report what actually happened, not what was attempted.

    The first version printed "Done." and the full list of admin logins
    unconditionally - so a run in which every single hospital failed to onboard ended
    with a confident list of four accounts that did not exist. A summary that cannot
    fail is not a summary.
  */
  if (done.length > 0) {
    say(`Succeeded (${done.length}/${HOSPITALS.length}). Admin logins:`);
    for (const h of done) say(`  ${h.admin}`);
    say('(password: the ADMIN_PASSWORD you passed - not printed)');
  }
  if (failed.length > 0) {
    say('');
    say(`Failed (${failed.length}/${HOSPITALS.length}):`);
    for (const f of failed) say(`  ${f}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`\nFAILED: ${e.message}${e.code ? `  (${e.code})` : ''}`);
  process.exitCode = 1;
});
