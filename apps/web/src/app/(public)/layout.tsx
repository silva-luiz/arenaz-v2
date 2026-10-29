import { SiteFooter, SiteHeader } from '@arenaz/ui';
import type { ReactNode } from 'react';
import { PublicTabBar } from '@/components/layout/public-tab-bar';
import { SkipLink } from '@/components/layout/skip-link';
import { AppLink } from '@/components/ui/next-link';
import { currentUser } from '@/lib/current-user';
import { isDemoMode } from '@/lib/demo';

/**
 * Shell of the public pages (`/`, `/buscar`, `/espacos/[slug]`). Sign-in,
 * sign-up and the account page have the same header and footer in
 * `(account)` (no tab bar), and `/painel` its own layout.
 */
export default async function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await currentUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <SiteHeader user={user} linkComponent={AppLink} />
      {/* tabIndex -1: the skip link moves focus here; no ring for that. */}
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-4 outline-none md:px-10 md:pt-6"
      >
        {children}
      </main>
      <SiteFooter showPhotoCredit={isDemoMode} />
      <PublicTabBar />
    </div>
  );
}
