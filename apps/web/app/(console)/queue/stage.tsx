import { Icon, type IconName } from '../../../components/icon';

/**
 * The board's shared furniture - drawn once, used by the real board and the demo.
 *
 * The demo used to copy the board's markup by hand, which is how the two had
 * already drifted (tables in one, lists in the other, different headings). What they
 * share now is the shape; what each owns is only its data and its buttons.
 */

/**
 * "Now with": the one thing on the board a room full of people is waiting on.
 *
 * Drawn as the token it is - a ticket. An ink stub carries the number at a size
 * that can be read from the other side of a counter, a perforation, and a white
 * body holding the actions. It used to be a card like every other card, with the
 * token at 17px, so the single most important fact on the screen had the same visual
 * weight as the pace panel beneath it (docs/Design.md 5.7: one dominant element).
 *
 * The actions stay on white on purpose: they include text inputs (skip reason) and
 * a destructive button, and both are already designed and tested on light.
 */
export function Stage({
  state,
  token,
  name,
  meta,
  dim = false,
  children,
}: {
  /** What is happening, in words and an icon - never the colour alone. */
  state: { label: string; icon: IconName; live?: boolean };
  token: string | null;
  name: string;
  meta?: React.ReactNode;
  /** A preview (who is NEXT) rather than who is in the room: set in a quieter ink. */
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label="Now with the doctor"
      // shrink-0: it sits in the board's height-capped, scrolling left column, and a
      // flex child with overflow-hidden is allowed to shrink - which silently cut the
      // "Up next" list off the bottom of the ticket.
      className="shrink-0 overflow-hidden rounded-xl border border-ink bg-surface shadow-raised"
    >
      <div className="relative bg-ink px-5 pb-6 pt-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <span className="text-eyebrow uppercase text-white/50">Now with the doctor</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-caption font-medium text-white/85 ring-1 ring-inset ring-white/15">
            {state.live === true ? (
              <span className="live-dot text-brand-live" aria-hidden="true" />
            ) : (
              <Icon name={state.icon} className="h-3 w-3" />
            )}
            {state.label}
          </span>
        </div>

        <div className="mt-5 flex items-end gap-4">
          <span
            // Keyed on the token so a change re-mounts it and the number settles in
            // (animate-tick) instead of silently swapping under somebody's eyes.
            key={token ?? 'none'}
            className={
              'animate-tick text-[56px] font-semibold leading-[0.9] tracking-[-0.04em] tabular-nums ' +
              (dim ? 'text-white/40' : 'text-white')
            }
          >
            {token ?? '—'}
          </span>
          <div className="min-w-0 pb-0.5">
            <p className={'truncate text-h2 ' + (dim ? 'text-white/70' : 'text-white')}>{name}</p>
            {meta !== undefined && <div className="mt-0.5 text-caption text-white/55">{meta}</div>}
          </div>
        </div>
      </div>

      <Perforation />

      <div className="px-5 pb-5 pt-4">{children}</div>
    </section>
  );
}

/**
 * The tear line: a notch bitten out of each edge where the ink stub meets the body.
 * The ink/white boundary already IS the line; a dashed rule on top of it was either
 * invisible (white on white) or noise (white on ink).
 */
function Perforation() {
  return (
    <div aria-hidden="true" className="relative h-0">
      <span className="absolute -left-[11px] -top-[11px] h-[22px] w-[22px] rounded-full border border-ink bg-canvas" />
      <span className="absolute -right-[11px] -top-[11px] h-[22px] w-[22px] rounded-full border border-ink bg-canvas" />
    </div>
  );
}

/** "B004 Deepa Nair · B005 Harpreet Singh · …" - the next few, in the server's order. */
export function UpNext({ entries }: { entries: { id: string; token: string; name: string }[] }) {
  if (entries.length === 0) return null;
  const shown = entries.slice(0, 4);
  return (
    <div className="mt-4 border-t border-line-soft pt-3.5">
      <p className="text-eyebrow uppercase text-ink-muted">Up next</p>
      <ol className="mt-2 flex flex-col gap-1.5">
        {shown.map((e, i) => (
          <li key={e.id} className="flex items-center gap-2.5 text-body">
            <span className="w-3 text-right text-caption tabular-nums text-ink-disabled">
              {i + 1}
            </span>
            <span className="font-semibold tabular-nums text-ink">{e.token}</span>
            <span className="min-w-0 truncate text-ink-muted">{e.name}</span>
          </li>
        ))}
      </ol>
      {entries.length > shown.length && (
        <p className="mt-1.5 pl-[22px] text-caption text-ink-muted">
          +{entries.length - shown.length} more
        </p>
      )}
    </div>
  );
}

/**
 * A roster's frame: icon, title and count on one line, then the rows.
 *
 * The count sits beside the title, not under it - the demo showed it as a lone "4"
 * on a line of its own, which read as a stray digit rather than as "four people".
 */
export function RosterShell({
  title,
  icon,
  count,
  description,
  emphasis = false,
  children,
}: {
  title: string;
  icon: IconName;
  count: number;
  description?: string;
  /** The list the doctor calls from - drawn a step heavier than the rest. */
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        'rounded-xl border bg-surface ' +
        (emphasis ? 'border-line-strong shadow-sm' : 'border-line shadow-xs')
      }
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft px-5 py-3.5">
        <span
          className={
            'grid h-7 w-7 place-items-center rounded-lg ' +
            (emphasis ? 'bg-ink text-white' : 'bg-sunken text-ink-muted')
          }
        >
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-h3 text-ink">{title}</h2>
        <span className="rounded-full bg-sunken px-2 py-0.5 text-caption font-semibold tabular-nums text-ink-soft">
          {count}
        </span>
        {description !== undefined && (
          <p className="w-full pl-10 text-caption text-ink-muted">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}

/**
 * The per-row overflow: everything that is not the row's one obvious action.
 *
 * Every row used to carry two open disclosures - "Priority" and a red "Cancel
 * booking" - so a queue of twenty showed forty links, half of them red, and the one
 * useful button per row (Check in) was lost among them. They are rare, audited
 * actions; one "⋯" per row is enough to find them, and the forms themselves are
 * unchanged underneath.
 */
export function RowMenu({ label, children }: { label: string; children: React.ReactNode }) {
  // A popover, not an inline panel: opened under a row, it floats over the rows
  // below instead of pushing the whole list down. The roster frame deliberately has
  // no overflow-hidden so this is never clipped by the card it sits in.
  return (
    <details className="group/menu relative">
      <summary
        className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-md text-ink-muted transition-colors hover:bg-sunken hover:text-ink group-open/menu:bg-sunken group-open/menu:text-ink [&::-webkit-details-marker]:hidden"
        aria-label={label}
        title={label}
      >
        <Icon name="more" className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 top-full z-30 mt-1.5 flex w-[min(30rem,calc(100vw-2.5rem))] animate-fade-up flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-lg">
        {children}
      </div>
    </details>
  );
}
