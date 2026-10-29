import { SiteFooter, SiteHeader } from '@arenaz/ui';
import { unstable_rethrow } from 'next/navigation';
import type { ReactNode } from 'react';
import { PublicTabBar } from '@/components/layout/public-tab-bar';
import { AppLink } from '@/components/ui/next-link';
import { getSession } from '@/lib/session';

/**
 * A failed lookup must not take the public pages down with it: they work
 * without a user, so fall back to the signed-out header (and log it).
 */
async function currentUser() {
  try {
    return await getSession();
  } catch (error) {
    // Next signals "this route is dynamic" by throwing; let that through.
    unstable_rethrow(error);
    console.error('Não foi possível ler a sessão no cabeçalho', error);
    return null;
  }
}

/**
 * Shell of the public pages (`/`, `/buscar`, `/espacos/[slug]`). Sign-in,
 * sign-up and the account page keep their own centered `PageShell`, and
 * `/painel` its own layout, so they live outside this group.
 */
export default async function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await currentUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only rounded-button bg-ink px-4 py-3 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader user={user} linkComponent={AppLink} />
      <main
        id="conteudo"
        className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-4 pb-16 md:px-10 md:pt-6"
      >
        {children}
      </main>
      <SiteFooter />
      <PublicTabBar />
    </div>
  );
}
