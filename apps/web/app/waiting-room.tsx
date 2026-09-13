'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The artwork: a waiting room that draws itself, and then empties.
 *
 * **This is the pitch, not a decoration of it.** Kramya's entire claim is that the
 * chairs stop being full - so the hero draws a full waiting room in line art, and
 * then empties it one person at a time while you watch. No product screenshot, no
 * stock photograph, no abstract glow: the thing the product does, happening.
 *
 * It replaces a centred headline over a floating card with a soft radial light behind
 * it, which is the exact composition every AI-assisted landing page arrives at. That
 * version was competent and anonymous - it would have sat on a fintech page, a
 * developer-tools page or this one without a single line changing.
 *
 * **Technique: `stroke-dasharray` / `stroke-dashoffset`.** Every path is given one
 * dash as long as the path itself and offset by the same amount, so it starts
 * invisible; animating the offset to zero looks like a pen drawing it. Chairs draw
 * left to right, then people appear in them, then they leave.
 *
 * **Pure CSS, triggered once by IntersectionObserver.** No animation library: the
 * whole thing is keyframes in globals.css plus a class toggle. `prefers-reduced-
 * motion` skips to the final frame - an empty room - because that is the state the
 * illustration is arguing for, and somebody who asked for less motion should still
 * get the point.
 */

/** Seven chairs, six of them occupied at the start. */
const CHAIRS = [0, 1, 2, 3, 4, 5, 6];
const OCCUPIED = [0, 1, 2, 3, 4, 5];
/** The order they leave in - deliberately not left-to-right, because a real room
 *  does not empty in a line, and one person stays behind. */
const LEAVE_ORDER = [2, 0, 4, 1, 5];

const CHAIR_W = 82;
const LEFT = 46;
const SEAT_Y = 196;
const cx = (i: number) => LEFT + i * CHAIR_W + CHAIR_W / 2;

export function WaitingRoom() {
  const ref = useRef<SVGSVGElement>(null);
  const [play, setPlay] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // The final frame: a drawn room with one person left in it.
      setStill(true);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setPlay(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPlay(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const state = still ? 'wr-still' : play ? 'wr-play' : 'wr-idle';

  return (
    <svg
      ref={ref}
      viewBox="0 0 640 268"
      /*
        `h-full` + `xMidYMax meet`, not `h-auto`.

        At `h-auto` the drawing's height is dictated by its width, and the hero bleeds
        it past both edges - so on a wide monitor a 640x268 scene became 600px tall and
        climbed up behind the headline. The container owns the height now and the scene
        fits inside it, anchored to the BOTTOM edge (`YMax`) so the chairs stay on the
        floor as the band gets shorter.
      */
      preserveAspectRatio="xMidYMax meet"
      className={'h-full w-full ' + state}
      /*
        Decorative, not an image with a label.

        It sits behind the headline now, and that headline already says in words what
        the drawing says in lines - "your waiting room, mostly empty". A screen reader
        announcing "a line drawing of a waiting room whose chairs empty one by one"
        over the top of it would be the same sentence twice, the second time as noise.
      */
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* The room: a floor, and a window that says "indoors" without drawing walls. */}
      <path className="wr-line wr-d0" d="M8 240H632" />
      <path className="wr-line wr-d0" d="M486 36h118v86H486z" />
      <path className="wr-line wr-d1" d="M545 36v86M486 79h118" />

      {/* A wall clock - the one object a waiting room is really about. */}
      <circle className="wr-line wr-d1" cx="70" cy="70" r="30" />
      <path className="wr-line wr-d2" d="M70 52v20l13 9" />

      {CHAIRS.map((i) => (
        <g key={`chair-${i}`}>
          <path
            className={`wr-line wr-d${1 + (i % 4)}`}
            d={`M${cx(i) - 28} ${SEAT_Y}h56`}
          />
          <path
            className={`wr-line wr-d${1 + (i % 4)}`}
            d={`M${cx(i) - 28} ${SEAT_Y}v-46`}
          />
          <path
            className={`wr-line wr-d${2 + (i % 3)}`}
            d={`M${cx(i) - 22} ${SEAT_Y}v34M${cx(i) + 22} ${SEAT_Y}v34`}
          />
        </g>
      ))}

      {/* The people. Each carries its own leave-delay, so they go one at a time. */}
      {OCCUPIED.map((i) => {
        const order = LEAVE_ORDER.indexOf(i);
        const leaves = order !== -1;
        return (
          <g
            key={`person-${i}`}
            className={leaves ? `wr-person wr-leave-${order}` : 'wr-person wr-stays'}
          >
            <circle cx={cx(i)} cy="122" r="12" />
            <path
              d={`M${cx(i) - 19} ${SEAT_Y - 4}c0-32 38-32 38 0`}
            />
          </g>
        );
      })}
    </svg>
  );
}
