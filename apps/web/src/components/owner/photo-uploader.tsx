'use client';

import {
  PHOTO_CONTENT_TYPES,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_PER_VENUE,
  photoSchema,
  photoUploadResponseSchema,
  type Photo,
} from '@arenaz/contracts';
import { Alert, Badge, Button, Field, Input } from '@arenaz/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiSend } from '@/lib/api-client';

const INVALID_FILE = 'Use JPG, PNG ou WebP até 10 MB';
const LIMIT_MESSAGE = `Limite de ${String(PHOTO_MAX_PER_VENUE)} fotos por espaço`;
const STORAGE_FAILED = 'Não foi possível enviar a foto. Tente novamente.';
const ACCEPT = PHOTO_CONTENT_TYPES.join(',');

const photosSchema = photoSchema.array();

type UploadStatus = 'enviando' | 'enviado' | 'erro';

interface Upload {
  id: number;
  name: string;
  status: UploadStatus;
  message?: string;
}

const STATUS_TEXT: Record<UploadStatus, string> = {
  enviando: 'Enviando…',
  enviado: 'Enviado',
  erro: 'Erro',
};

function isAllowedType(type: string): boolean {
  return (PHOTO_CONTENT_TYPES as readonly string[]).includes(type);
}

function isValidFile(file: File): boolean {
  return (
    isAllowedType(file.type) && file.size > 0 && file.size <= PHOTO_MAX_BYTES
  );
}

function sortByPosition(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => a.position - b.position);
}

/**
 * The browser talks to object storage itself (a presigned POST, never through
 * `/api`): the signed `fields` first, `Content-Type` if they leave it out, and
 * the `file` LAST, because storage ignores whatever follows it. No cookies.
 */
async function postToStorage(
  url: string,
  fields: Record<string, string>,
  file: File,
): Promise<boolean> {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  if (
    !Object.keys(fields).some((name) => name.toLowerCase() === 'content-type')
  ) {
    form.append('Content-Type', file.type);
  }
  form.append('file', file);
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: form,
      // Storage is another origin: no cookies, no referrer.
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export interface PhotoUploaderProps {
  venueId: string;
  photos: Photo[];
}

type FocusTarget =
  /** After a move: the moved photo's arrow, or the other one at an end. */
  | { kind: 'move'; id: string; direction: 'left' | 'right' }
  /** After a removal: the Remover of a neighbouring photo, or the file input. */
  | { kind: 'remove'; id: string | null };

/** Photo grid plus uploads. The first photo is the cover. */
export function PhotoUploader({
  venueId,
  photos: initial,
}: PhotoUploaderProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState(() => sortByPosition(initial));
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const nextUpload = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const refocus = useRef<FocusTarget | null>(null);

  // The button that was clicked may be gone (removed photo) or disabled (a
  // photo that reached an end), so the focus is placed after the commit.
  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    if (target.kind === 'remove' && target.id === null) {
      // The input is disabled while busy; wait for the render that enables it.
      if (busy) return;
      refocus.current = null;
      input.current?.focus();
      return;
    }
    refocus.current = null;
    const item = grid.current?.querySelector(
      `[data-photo-id="${target.id ?? ''}"]`,
    );
    if (target.kind === 'remove') {
      item?.querySelector<HTMLButtonElement>('button[data-remove]')?.focus();
      return;
    }
    const buttons = [
      ...(item?.querySelectorAll<HTMLButtonElement>('button[data-move]') ?? []),
    ];
    const wanted = buttons.find(
      (button) => button.dataset.move === target.direction,
    );
    const other = buttons.find(
      (button) => button.dataset.move !== target.direction,
    );
    (wanted?.disabled ? other : wanted)?.focus();
  });

  function patchUpload(id: number, patch: Partial<Upload>) {
    setUploads((current) =>
      current.map((upload) =>
        upload.id === id ? { ...upload, ...patch } : upload,
      ),
    );
  }

  async function sendOne(file: File, id: number, base: string) {
    const ticket = await apiSend(
      'POST',
      `${base}/upload-url`,
      { contentType: file.type, size: file.size },
      photoUploadResponseSchema,
    );
    if (!ticket.ok) {
      patchUpload(id, { status: 'erro', message: ticket.message });
      return;
    }
    const stored = await postToStorage(
      ticket.data.url,
      ticket.data.fields,
      file,
    );
    if (!stored) {
      patchUpload(id, { status: 'erro', message: STORAGE_FAILED });
      return;
    }
    const confirmed = await apiSend(
      'POST',
      base,
      { key: ticket.data.key },
      photoSchema,
    );
    if (!confirmed.ok) {
      patchUpload(id, { status: 'erro', message: confirmed.message });
      return;
    }
    setPhotos((current) =>
      sortByPosition([
        ...current.filter((photo) => photo.id !== confirmed.data.id),
        confirmed.data,
      ]),
    );
    patchUpload(id, { status: 'enviado' });
    router.refresh();
  }

  async function upload(files: File[]) {
    setNotice('');
    const valid = files.filter(isValidFile);
    if (photos.length + valid.length > PHOTO_MAX_PER_VENUE) {
      setNotice(`${LIMIT_MESSAGE}. Este espaço tem ${String(photos.length)}.`);
      return;
    }

    const base = `/owner/venues/${venueId}/photos`;
    const entries = files.map((file) => ({
      file,
      id: nextUpload.current++,
    }));
    setUploads(
      entries.map(({ file, id }) =>
        isValidFile(file)
          ? { id, name: file.name, status: 'enviando' }
          : { id, name: file.name, status: 'erro', message: INVALID_FILE },
      ),
    );

    setBusy(true);
    // One at a time: the API counts the photos when it confirms each one.
    for (const { file, id } of entries) {
      if (isValidFile(file)) await sendOne(file, id, base);
    }
    setBusy(false);
  }

  async function move(index: number, direction: 'left' | 'right') {
    const target = direction === 'left' ? index - 1 : index + 1;
    const moving = photos[index];
    if (!moving || target < 0 || target >= photos.length) return;
    const ids = photos.map((photo) => photo.id);
    ids.splice(index, 1);
    ids.splice(target, 0, moving.id);

    setNotice('');
    setBusy(true);
    const result = await apiSend(
      'PUT',
      `/owner/venues/${venueId}/photos/order`,
      { photoIds: ids },
      photosSchema,
    );
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    refocus.current = { kind: 'move', id: moving.id, direction };
    setPhotos(sortByPosition(result.data));
    router.refresh();
  }

  async function remove(photo: Photo) {
    setNotice('');
    setBusy(true);
    const result = await apiSend(
      'DELETE',
      `/owner/venues/${venueId}/photos/${photo.id}`,
    );
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    const at = photos.findIndex((other) => other.id === photo.id);
    const neighbour = photos[at + 1] ?? photos[at - 1];
    refocus.current = { kind: 'remove', id: neighbour?.id ?? null };
    setPhotos((current) => current.filter((other) => other.id !== photo.id));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {photos.length === 0 ? (
        <p className="text-muted">Nenhuma foto ainda.</p>
      ) : (
        <ul
          ref={grid}
          aria-label="Fotos do espaço"
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          {photos.map((photo, index) => {
            const number = String(index + 1);
            return (
              <li
                key={photo.id}
                data-photo-id={photo.id}
                className="flex flex-col gap-2"
              >
                <div className="relative aspect-4/3 overflow-hidden rounded-photo bg-surface">
                  {/* Photos are served by object storage on another origin;
                      next/image would need that host configured, so a plain img. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={`Foto ${number} do espaço`}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                  {index === 0 ? (
                    <Badge tone="brand" className="absolute top-2 left-2">
                      Capa
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    data-move="left"
                    aria-label={`Mover foto ${number} para a esquerda`}
                    disabled={busy || index === 0}
                    onClick={() => {
                      void move(index, 'left');
                    }}
                  >
                    <span aria-hidden="true">←</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    data-move="right"
                    aria-label={`Mover foto ${number} para a direita`}
                    disabled={busy || index === photos.length - 1}
                    onClick={() => {
                      void move(index, 'right');
                    }}
                  >
                    <span aria-hidden="true">→</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-remove=""
                    aria-label={`Remover foto ${number}`}
                    disabled={busy}
                    onClick={() => {
                      void remove(photo);
                    }}
                  >
                    <span aria-hidden="true">Remover</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Alert tone="error">{notice}</Alert>

      <Field
        label="Adicionar fotos"
        hint={`JPG, PNG ou WebP, até 10 MB cada. A primeira foto é a capa. Máximo de ${String(PHOTO_MAX_PER_VENUE)} fotos.`}
      >
        <Input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          disabled={busy}
          className="h-auto py-3"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            // Same file twice in a row must still fire change.
            event.target.value = '';
            if (files.length > 0) void upload(files);
          }}
        />
      </Field>

      {uploads.length > 0 ? (
        <ul
          aria-label="Envios"
          aria-live="polite"
          className="flex flex-col gap-1 text-sm"
        >
          {uploads.map((item) => (
            <li
              key={item.id}
              className={item.status === 'erro' ? 'text-red-700' : 'text-ink'}
            >
              <span className="font-medium">{item.name}</span>
              {': '}
              <span>
                {item.status === 'erro'
                  ? (item.message ?? STATUS_TEXT.erro)
                  : STATUS_TEXT[item.status]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
