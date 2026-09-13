import type { Metadata, Viewport } from 'next';
import { Demo } from './demo-client';

/**
 * `/demo` - the console, working, with no account.
 *
 * Public by design: the point is that a hospital can watch the board run before
 * talking to anyone. `middleware.ts` excludes this path explicitly, and that
 * exclusion is safe for one reason worth stating plainly - **this page has no API
 * calls, no session and no tenant.** Every figure on it is a fixture in
 * `./fixtures.ts`. There is no auth to bypass because there is no auth.
 *
 * The server component is this thin wrapper. Everything interactive lives in
 * `./demo-client`, so the metadata below still renders on the server and the route
 * stays statically prerenderable.
 */

export const metadata: Metadata = {
  title: 'Kramya — see the console, no sign-in',
  description:
    'A working demonstration of the Kramya reception board and administrator view, with sample data. Call the next patient, check someone in, register a walk-in.',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#F7F7F8',
  colorScheme: 'light',
};

export default function DemoPage() {
  return <Demo />;
}
