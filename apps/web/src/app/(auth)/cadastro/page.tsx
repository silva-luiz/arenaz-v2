import { Card } from '@arenaz/ui';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { PageShell } from '@/components/ui/page-shell';

export const metadata: Metadata = { title: 'Criar conta' };

export default function CadastroPage() {
  return (
    <PageShell>
      <Card>
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Criar conta</h1>
        {/* useSearchParams needs a Suspense boundary during static rendering */}
        <Suspense>
          <SignUpForm />
        </Suspense>
      </Card>
    </PageShell>
  );
}
