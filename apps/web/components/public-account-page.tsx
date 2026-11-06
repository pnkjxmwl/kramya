import Link from 'next/link';

export function PublicAccountPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="mx-auto max-w-2xl px-6 py-12 text-slate-900">
    <Link className="font-semibold underline" href="/">Kramya</Link>
    <h1 className="mb-6 mt-8 text-3xl font-semibold">{title}</h1>
    <div className="space-y-5 leading-7">{children}</div>
    <nav aria-label="Support and privacy" className="mt-10 flex flex-wrap gap-5 border-t pt-5 text-sm underline">
      <Link href="/privacy">Privacy</Link><Link href="/support">Support</Link><Link href="/delete-account">Account deletion</Link><Link href="/account-action">Password recovery</Link>
    </nav>
  </main>;
}
