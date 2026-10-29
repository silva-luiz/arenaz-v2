import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Card, PageShell } from '@/components/ui/page-shell';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Minha conta' };

export default async function ContaPage() {
  const session = await getSession();
  if (!session) redirect('/entrar?next=/conta');

  return (
    <PageShell>
      <Card>
        <h1 className="text-2xl font-bold tracking-tight">
          {`Olá, ${session.name}`}
        </h1>
        <p className="mt-1 mb-6 text-muted">{session.email}</p>
        <SignOutButton />
      </Card>
    </PageShell>
  );
}
