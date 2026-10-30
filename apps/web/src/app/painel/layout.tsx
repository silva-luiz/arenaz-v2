import { venueSummarySchema } from '@arenaz/contracts';
import type { Metadata } from 'next';
import { redirect, unstable_rethrow } from 'next/navigation';
import type { ReactNode } from 'react';
import { SkipLink } from '@/components/layout/skip-link';
import { OwnerNav, type OwnerNavVenue } from '@/components/owner/owner-nav';
import { apiGet } from '@/lib/api';
import { getSession } from '@/lib/session';

// Nothing under /painel is for search engines. Pages set their own `title`
// only, so this is inherited by all of them.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The owner's venues for the sidebar. The panel must still open when the list
 * fails (the pages show their own errors), so only Next's redirect and
 * not-found signals get through.
 */
async function sidebarVenues(): Promise<OwnerNavVenue[]> {
  try {
    const venues = await apiGet(
      '/owner/venues',
      venueSummarySchema.array(),
      '/painel',
    );
    return venues.map(({ id, name, fieldsCount, coverUrl, coverSrcSet }) => ({
      id,
      name,
      fieldsCount,
      coverUrl,
      coverSrcSet,
    }));
  } catch (error) {
    unstable_rethrow(error);
    return [];
  }
}

/**
 * Guard for everything under /painel (only signed-in users get in) and the
 * shell of the owner panel as in Painel.dc.html: the sidebar (logo with the
 * "DONO" tag, sections, the venue in context) beside the page; on narrow
 * screens the sidebar comes first. No top bar, tab bar or footer here.
 */
export default async function PainelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/entrar?next=/painel');
  const venues = await sidebarVenues();

  return (
    <div className="flex min-h-dvh flex-col bg-surface min-[880px]:flex-row">
      <SkipLink />
      <OwnerNav venues={venues} ownerName={session.name} />
      {/* tabIndex -1: the skip link moves focus here; no ring for that. */}
      <main
        id="conteudo"
        tabIndex={-1}
        className="min-w-0 flex-1 px-4 pt-7 pb-12 outline-none min-[761px]:px-10"
      >
        {children}
      </main>
    </div>
  );
}
