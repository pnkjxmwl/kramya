'use client';

import { useEffect, useState } from 'react';
import { Mark } from '../components/mark';

/**
 * The fold's right-hand column: the whole product loop, running, in ten seconds.
 *
 * Two surfaces that are really one system. Behind, the reception desk's board -
 * who is being seen, who is next. In front, one patient's token card on their phone.
 * As the desk calls people in, the card's "ahead of you" falls, its window narrows,
 * and at one-ahead the phone says it is time to leave. That sentence is the product;
 * everything else on the page explains it.
 *
 * It replaced a line drawing of a waiting room, which said "empty corridor" but not
 * how - the drawing now sits further down the page, where the page makes that claim.
 *
 * Every number is the same kind of number the real card shows: a token, a count, a
 * window. Nothing is a vanity metric. Reduced motion gets the one frame that tells
 * the story on its own - the leave-now moment - and no timers at all.
 */

const QUEUE = [
  { token: 'G009', name: 'Deepa Nair' },
  { token: 'G010', name: 'Harpreet Singh' },
  { token: 'G011', name: 'Lata Mishra' },
  { token: 'G012', name: 'Aarav Semwal' },
  { token: 'G013', name: 'Fatima Sheikh' },
  { token: 'G014', name: 'Joseph Mathew' },
  { token: 'G015', name: 'Ritu Kapoor' },
];

/** Index into QUEUE of who is with the doctor; our patient is G012 (index 3). */
const STEPS = [
  { serving: 0, window: '11:40 – 12:05' },
  { serving: 1, window: '11:35 – 11:55' },
  { serving: 2, window: '11:30 – 11:45' },
  { serving: 3, window: 'Now' },
];
const OURS = 3;
const LEAVE_AT = 2; // one ahead: the moment the app tells them to set off

export function HeroScene() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(LEAVE_AT);
      return;
    }
    let timer: number;
    let i = 0;
    const tick = () => {
      i = (i + 1) % (STEPS.length + 1);
      // The extra beat at the end is a pause on "you're being seen" before the loop
      // restarts, so the payoff is held rather than immediately taken away.
      setStep(Math.min(i, STEPS.length - 1));
      timer = window.setTimeout(tick, i === STEPS.length ? 3200 : 2600);
    };
    timer = window.setTimeout(tick, 1600);
    return () => clearTimeout(timer);
  }, []);

  const s = STEPS[step] ?? STEPS[0]!;
  const ahead = Math.max(OURS - s.serving, 0);
  const called = s.serving === OURS;
  const waiting = QUEUE.slice(s.serving + 1, s.serving + 5);

  return (
    <div className="relative mx-auto h-[420px] w-full max-w-[520px] select-none sm:h-[500px]">
      {/* ---------------------------------------------------------- the desk */}
      <div className="absolute left-0 top-2 hidden w-[300px] -rotate-[3deg] rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-sm sm:block">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[1.4px] text-white/40">
            Reception · Dr Anjali Rao
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-brand-live">
            <span className="live-dot" style={{ height: 6, width: 6 }} />
            Live
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-inset ring-white/10">
          <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[1.2px] text-white/40">
            With doctor
          </span>
          <span
            key={QUEUE[s.serving]!.token}
            className="animate-tick text-[18px] font-semibold tabular-nums tracking-tight text-white"
          >
            {QUEUE[s.serving]!.token}
          </span>
          <span className="truncate text-[12px] text-white/55">{QUEUE[s.serving]!.name}</span>
        </div>

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[1.4px] text-white/30">
          Waiting here
        </p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {waiting.map((row) => (
            <li
              key={row.token}
              className={
                'flex animate-fade-up items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-500 ' +
                (row.token === QUEUE[OURS]!.token ? 'bg-white/[0.08]' : '')
              }
            >
              <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white/80">
                {row.token}
              </span>
              <span className="truncate text-[12px] text-white/60">{row.name}</span>
              {row.token === QUEUE[OURS]!.token && (
                <span className="ml-auto text-[10px] font-medium text-white/40">on the app</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* --------------------------------------------------------- the phone */}
      <div className="absolute left-1/2 top-20 w-[290px] -translate-x-1/2 sm:left-auto sm:right-0 sm:top-[150px] sm:translate-x-0">
        {/* The nudge: "leave now" at one-ahead, then "your turn" at the call. Keyed
            on the message so the second one drops in rather than editing the first. */}
        {step >= LEAVE_AT && (
          <div
            key={called ? 'turn' : 'leave'}
            role="status"
            className="absolute -top-16 left-2 right-2 z-20 flex animate-drop items-start gap-3 rounded-2xl bg-white/95 px-3.5 py-3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-black/5 backdrop-blur"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-brand-ink text-white">
              <Mark className="h-4 w-4" />
            </span>
            <span className="min-w-0 text-[12px] leading-[1.35] text-brand-ink">
              <span className="flex items-center justify-between gap-2">
                <strong className="font-semibold">{called ? 'Your turn' : 'Time to leave'}</strong>
                <span className="text-[10px] text-brand-muted">now</span>
              </span>
              <span className="text-brand-soft">
                {called
                  ? 'Please go in — Dr Anjali Rao, Room 4.'
                  : 'One ahead of you. You’ll be called in about 15 min.'}
              </span>
            </span>
          </div>
        )}

        <div className="rounded-[30px] bg-white p-6 text-brand-ink shadow-[0_40px_100px_-24px_rgba(0,0,0,0.75)] ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <span
              className={
                'text-[10px] font-semibold uppercase tracking-[1.4px] transition-colors duration-500 ' +
                (called ? 'text-brand-live-ink' : 'text-brand-muted')
              }
            >
              {called ? 'You’re being seen' : 'You’re in the queue'}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-live-ink">
              <span className="live-dot text-brand-live" style={{ height: 6, width: 6 }} />
              Live
            </span>
          </div>

          <div className="mt-3 text-[58px] font-semibold leading-none tracking-[-2.8px] tabular-nums">
            {QUEUE[OURS]!.token}
          </div>
          <p className="mt-2 text-[13px] text-brand-soft">Aarav · Dr Anjali Rao</p>

          {/* The strip: seen, waiting ahead, you. Keyed from the end so the bar that
              leaves is the one nearest the doctor. */}
          <div className="mt-6 flex h-[30px] items-end gap-[5px]" aria-hidden="true">
            {Array.from({ length: 4 + s.serving }, (_, i) => (
              <span key={`seen-${i}`} className="h-[15px] w-[6px] rounded-full bg-brand-ink/80" />
            ))}
            {Array.from({ length: ahead }, (_, i) => (
              <span
                key={`wait-${ahead - i}`}
                className="h-[11px] w-[6px] rounded-full bg-brand-faint transition-all duration-500"
              />
            ))}
            <span
              className={
                'h-[30px] w-[6px] rounded-full transition-colors duration-500 ' +
                (called ? 'bg-brand-live' : 'bg-brand-ink')
              }
            />
          </div>

          <div className="mt-3.5 flex items-center justify-between text-[13px] text-brand-muted">
            <span>
              <strong
                key={ahead}
                className="inline-block animate-tick font-semibold tabular-nums text-brand-ink"
              >
                {ahead}
              </strong>{' '}
              ahead of you
            </span>
            <span>
              Seen{' '}
              <strong
                key={s.window}
                className="inline-block animate-tick font-semibold tabular-nums text-brand-ink"
              >
                {s.window}
              </strong>
            </span>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-brand-line pt-4 text-[13px]">
            <span className="text-brand-muted">Now serving</span>
            <span key={s.serving} className="animate-tick font-semibold tabular-nums">
              {QUEUE[s.serving]!.token}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
