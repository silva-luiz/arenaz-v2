'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GENERIC_ERROR, authClient } from '@/lib/auth-client';
import { secondaryButton } from '@/components/ui/button-styles';
import { FormAlert } from './form-alert';

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
      <FormAlert message={error} />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          void signOut();
        }}
        className={secondaryButton}
      >
        Sair
      </button>
    </div>
  );
}
