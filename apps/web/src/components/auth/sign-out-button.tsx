'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, Button } from '@arenaz/ui';
import { GENERIC_ERROR, authClient } from '@/lib/auth-client';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(GENERIC_ERROR);
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Alert tone="error">{error}</Alert>
      <Button
        variant="secondary"
        loading={pending}
        onClick={() => {
          void signOut();
        }}
      >
        Sair
      </Button>
    </div>
  );
}
