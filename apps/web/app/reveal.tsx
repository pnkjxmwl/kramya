'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Scroll-triggered reveal, and the scroll-driven queue demonstration beneath it.
 *
 * **IntersectionObserver, not a library.** The whole behaviour is "tell me when this
 * is on screen", which is one browser API and about fifteen lines. `framer-motion` is
 * 40KB of gzipped JavaScript on a marketing page whose entire job is to load fast for
 * someone who has never heard of us, and docs/CLAUDE.md 2 asks for the smallest option
 * that works before a new dependency.
 *
 * **Everything animates in CSS, not JS.** Transforms and opacity are composited on the
 * GPU, so nothing here can cause a layout pass or contend with the main thread. The
 * only thing React does is toggle a class.
 *
 * **`prefers-reduced-motion` is honoured by skipping straight to the end state**,
 * not by shortening the duration. Somebody who has asked their OS for less motion has
 * usually asked because motion makes them ill, and a fast animation is still an
 * animation.
 */

function useOnScreen<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;

    // No IntersectionObserver, or reduced motion: show the final state immediately.
    // A visitor must never be left looking at content that is permanently invisible
    // because a browser API was missing.
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setSeen(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Plays once. A section that re-animates every time it scrolls back into view
        // turns a page into a fairground, and the second play carries no information.
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -10% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, seen };
}

/** Fade and a short rise. The rise is 12px - felt, not watched. */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, seen } = useOnScreen<HTMLDivElement>(0.2);
  return (
    <div
      ref={ref}
      className={
        className +
        ' transition-[opacity,transform] duration-[650ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ' +
        (seen ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0')
      }
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * The demonstration: one queue, advancing, as you scroll past it.
 *
 * This is the section that has to do the explaining, so it shows the product working
 * rather than describing it. Three stages, and the numbers between them are the ones
 * the real engine would produce - a bar leaves, the ahead-count drops, the window
 * narrows, and the token is finally called.
 *
 * **The stage advances on a timer once the section is on screen, not on scroll
 * position.** Scrubbing a queue backwards and forwards with the scrollbar is a toy;
 * a queue only ever moves one way, and tying it to scroll would let a visitor run it
 * in reverse - which is the single thing this product can never do.
 */
const STAGES = [
  {
    caption: 'They join from home',
    detail: 'A token is issued the moment payment clears. No queue, no counter.',
    seen: 4,
    ahead: 3,
    window: '11:40 – 12:05',
    serving: 'G009',
    called: false,
  },
  {
    caption: 'The clinic moves',
    detail: 'A patient is seen. Everyone behind shifts up, and the window narrows.',
    seen: 4,
    ahead: 2,
    window: '11:35 – 11:55',
    serving: 'G010',
    called: false,
  },
  {
    caption: 'Time to leave',
    detail: 'Two tokens out, the app says to set off. They arrive as they are called.',
    seen: 4,
    ahead: 0,
    window: 'Now',
    serving: 'G012',
    called: true,
  },
];

export function QueueDemo() {
  const { ref, seen } = useOnScreen<HTMLDivElement>(0.45);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!seen) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStage(STAGES.length - 1);
      return;
    }
    // 2.6s a stage: long enough to read the caption, short enough that nobody
    // scrolls away mid-story.
    const timers = STAGES.map((_, i) => window.setTimeout(() => setStage(i), i * 2600));
    return () => timers.forEach(clearTimeout);
  }, [seen]);

  const s = STAGES[stage] ?? STAGES[0]!;

  return (
    <div ref={ref} className="grid gap-12 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-center">
      {/* The captions. The active one is ink; the rest recede rather than vanish, so
          the reader can see where the story has been and where it is going. */}
      <ol className="flex flex-col gap-1">
        {STAGES.map((st, i) => (
          <li
            key={st.caption}
            className={
              'rounded-2xl px-5 py-4 transition-all duration-500 ' +
              (i === stage ? 'bg-white shadow-[0_1px_2px_rgba(11,12,13,0.05),0_12px_30px_rgba(11,12,13,0.06)]' : 'opacity-40')
            }
          >
            <div className="flex items-baseline gap-3">
              <span className="text-[12px] font-semibold tabular-nums text-brand-faint">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-[17px] font-semibold tracking-[-0.4px]">{st.caption}</h3>
            </div>
            <p className="mt-1.5 pl-[26px] text-[14px] leading-[1.55] text-brand-soft">
              {st.detail}
            </p>
          </li>
        ))}
      </ol>

      {/* The card. Same object as the hero, but this one moves. */}
      <div className="mx-auto w-full max-w-[380px]">
        <div className="rounded-[28px] bg-white p-7 shadow-[0_1px_2px_rgba(11,12,13,0.05),0_24px_60px_rgba(11,12,13,0.10)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[1.4px] text-brand-live-ink">
              {s.called ? "You're being seen" : "You're in the queue"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-live motion-reduce:animate-none" />
              <span className="text-[12px] font-semibold text-brand-live-ink">Live</span>
            </span>
          </div>

          <div className="mt-3 text-[56px] font-semibold leading-none tracking-[-2.8px] tabular-nums">
            G012
          </div>
          <p className="mt-2 text-[14px] text-brand-soft">Aarav · Dr Nikhil Save</p>

          {/*
            The strip. Waiting bars are keyed from the END of the run, so the one that
            disappears is the bar nearest the doctor - key them forwards and the
            browser removes the last node instead, which reads as the queue shrinking
            behind you rather than ahead of you.
          */}
          <div className="mt-7 flex h-[30px] items-end gap-[5px]" aria-hidden="true">
            {Array.from({ length: s.seen }, (_, i) => (
              <span key={`seen-${i}`} className="h-[15px] w-[6px] rounded-full bg-brand-ink/80" />
            ))}
            {Array.from({ length: s.ahead }, (_, i) => (
              <span
                key={`wait-${s.ahead - i}`}
                className="h-[11px] w-[6px] rounded-full bg-brand-faint transition-all duration-500"
              />
            ))}
            <span
              className={
                'w-[6px] rounded-full transition-all duration-500 ' +
                (s.called ? 'h-[30px] bg-brand-live' : 'h-[30px] bg-brand-ink')
              }
            />
          </div>

          <div className="mt-3.5 flex items-center justify-between text-[13px] text-brand-muted">
            <span>
              <strong className="font-semibold tabular-nums text-brand-ink">{s.ahead}</strong>{' '}
              ahead of you
            </span>
            <span>
              Seen <strong className="font-semibold tabular-nums text-brand-ink">{s.window}</strong>
            </span>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-brand-line pt-4 text-[14px]">
            <span className="text-brand-muted">Now serving</span>
            <span className="font-medium tabular-nums">{s.serving}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
