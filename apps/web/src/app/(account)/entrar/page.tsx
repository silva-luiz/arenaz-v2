import { Card } from '@arenaz/ui';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignInForm } from '@/components/auth/sign-in-form';

export const metadata: Metadata = { title: 'Entrar' };

export default function EntrarPage() {
  return (
    <Card>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Entrar</h1>
      {/* useSearchParams needs a Suspense boundary during static rendering */}
      <Suspense>
        <SignInForm />
      </Suspense>
    </Card>
  );
}
