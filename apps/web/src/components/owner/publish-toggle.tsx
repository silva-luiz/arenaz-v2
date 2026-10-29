'use client';

import { venueSchema, type VenueStatus } from '@arenaz/contracts';
import { Alert, Button } from '@arenaz/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiSend } from '@/lib/api-client';

interface Failure {
  message: string;
  /** What is missing, from `Problem.errors` of a refused publish. */
  problems: string[];
}

export interface PublishToggleProps {
  venueId: string;
  status: VenueStatus;
}

export function PublishToggle({ venueId, status }: PublishToggleProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const publishing = status === 'draft';

  async function toggle() {
    setFailure(null);
    setBusy(true);
    // No body: the API rejects an empty body declared as JSON.
    const result = await apiSend(
      'POST',
      `/owner/venues/${venueId}/${publishing ? 'publish' : 'unpublish'}`,
      undefined,
      venueSchema,
    );
    setBusy(false);

    if (!result.ok) {
      setFailure({
        message: result.message,
        problems: Object.values(result.fieldErrors).flat(),
      });
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <Alert tone="error">
        {failure ? (
          <>
            <p>{failure.message}</p>
            {failure.problems.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {failure.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </Alert>
      <Button
        variant={publishing ? 'primary' : 'secondary'}
        loading={busy}
        onClick={() => {
          void toggle();
        }}
        className="self-start"
      >
        {publishing ? 'Publicar' : 'Despublicar'}
      </Button>
    </div>
  );
}
