import { SiteFooter } from '@arenaz/ui';
import type { ReactNode } from 'react';
import { PublicHeader } from '@/components/layout/public-header';
import { PublicMain } from '@/components/layout/public-main';
import { PublicTabBar } from '@/components/layout/public-tab-bar';
import { SkipLink } from '@/components/layout/skip-link';
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
      <PublicHeader user={user ? { name: user.name } : null} />
      <PublicMain>{children}</PublicMain>
      <SiteFooter showPhotoCredit={isDemoMode} />
      <PublicTabBar />
    </div>
  );
}
