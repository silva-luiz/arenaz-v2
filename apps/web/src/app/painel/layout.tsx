import { SiteHeader } from '@arenaz/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { SkipLink } from '@/components/layout/skip-link';
import { OwnerNav } from '@/components/owner/owner-nav';
import { AppLink } from '@/components/ui/next-link';
import { getSession } from '@/lib/session';

// Nothing under /painel is for search engines. Pages set their own `title`
// only, so this is inherited by all of them.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Guard for everything under /painel (only signed-in users get in) and the
 * shell of the owner panel: the site header with the "DONO" tag, the owner
 * navigation under it, and the page. No tab bar and no footer here.
 */
export default async function PainelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/entrar?next=/painel');

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <SkipLink />
      <SiteHeader
        user={session}
        badge="DONO"
        showOwnerCta={false}
        linkComponent={AppLink}
      />
      <div className="border-b border-line bg-bg">
        <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-2 py-1 md:px-8">
          <OwnerNav />
          <span className="px-2 text-sm text-muted">{`Olá, ${session.name}`}</span>
        </div>
      </div>
      {/* tabIndex -1: the skip link moves focus here; no ring for that. */}
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-8 outline-none md:px-10 md:py-10"
      >
        {children}
      </main>
    </div>
  );
}
