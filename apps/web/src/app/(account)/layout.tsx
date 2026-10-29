import { SiteFooter, SiteHeader } from '@arenaz/ui';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SkipLink } from '@/components/layout/skip-link';
import { AppLink } from '@/components/ui/next-link';
import { currentUser } from '@/lib/current-user';

// Nothing here is for search engines (robots.txt blocks it as well).
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Shell of sign-in, sign-up and `/conta`: the same header and footer as the
 * public pages, no tab bar, and the page's card centered in the middle.
 */
export default async function AccountLayout({
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
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 outline-none md:py-16"
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
