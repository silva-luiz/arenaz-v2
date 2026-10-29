import { Card, buttonClasses } from '@arenaz/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Minha conta' };

export default async function ContaPage() {
  const session = await getSession();
  if (!session) redirect('/entrar?next=/conta');

  return (
    <Card>
      <h1 className="text-2xl font-bold tracking-tight">
        {`Olá, ${session.name}`}
      </h1>
      <p className="mt-1 mb-6 text-muted">{session.email}</p>
      <div className="flex flex-col gap-3">
        <Link
          href="/reservas"
          className={buttonClasses({ variant: 'secondary' })}
        >
          Minhas reservas
        </Link>
        <Link
          href="/painel"
          className={buttonClasses({ variant: 'secondary' })}
        >
          Painel do dono
        </Link>
        <SignOutButton />
      </div>
    </Card>
  );
}
