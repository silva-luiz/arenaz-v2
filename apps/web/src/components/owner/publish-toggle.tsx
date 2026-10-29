'use client';

import { venueSchema, type VenueStatus } from '@arenaz/contracts';
import { Alert, Button } from '@arenaz/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { apiSend } from '@/lib/api-client';

type Notice =
  | { tone: 'success'; message: string }
  | {
      tone: 'error';
      message: string;
      /** What is missing, from `Problem.errors` of a refused publish. */
      problems: string[];
    }
  | null;

export interface PublishToggleProps {
  venueId: string;
  status: VenueStatus;
}

export function PublishToggle({ venueId, status }: PublishToggleProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Keeps the button busy until the server data has been re-fetched.
  const [refreshing, startRefresh] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  const publishing = status === 'draft';

  async function toggle() {
    setNotice(null);
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
      setNotice({
        tone: 'error',
        message: result.message,
        problems: Object.values(result.fieldErrors).flat(),
      });
      return;
    }
    setNotice({
      tone: 'success',
      message: publishing ? 'Espaço publicado' : 'Espaço despublicado',
    });
    startRefresh(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Alert tone={notice?.tone ?? 'error'}>
        {notice ? (
          <>
            <p>{notice.message}</p>
            {notice.tone === 'error' && notice.problems.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {notice.problems.map((problem, index) => (
                  // Messages are not unique ids; the list is static per answer.
                  <li key={index}>{problem}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </Alert>
      <Button
        variant={publishing ? 'primary' : 'secondary'}
        loading={busy || refreshing}
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
