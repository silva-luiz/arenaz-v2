import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { OwnerNav } from '@/components/owner/owner-nav';
import { getSession } from '@/lib/session';

/** Guard for everything under /painel: only signed-in users get in. */
export default async function PainelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/entrar?next=/painel');

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line bg-bg">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link
            href="/"
            aria-label="arenaz, página inicial"
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          >
            <Logo />
          </Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-sm text-muted">{`Olá, ${session.name}`}</span>
            <OwnerNav />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
