import { Board } from './board';

/**
 * `/demo/queue` - the reception board, public.
 *
 * A thin server wrapper so the interactive part stays a client island and this route
 * is still statically prerenderable. Public for the same reason `/demo` is, and safe
 * for the same reason: no API, no session, no tenant. See ../fixtures.ts.
 */
export default function DemoQueuePage() {
  return <Board />;
}
