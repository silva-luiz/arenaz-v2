import type { Photo } from '@arenaz/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiSend: vi.fn(),
  refresh: vi.fn(),
  storageFetch: vi.fn(),
  createImageBitmap: vi.fn(),
  calls: [] as string[],
}));

vi.mock('@/lib/api-client', () => ({ apiSend: mocks.apiSend }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: mocks.refresh }),
}));

import { PhotoUploader } from './photo-uploader';

const VENUE_ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';
const STORAGE_URL = 'http://localhost:9000/arenaz-photos';
const INVALID = 'Use JPG, PNG ou WebP até 10 MB';
const REENCODED_BYTES = 321;

function photo(n: number): Photo {
  return {
    id: `00000000-0000-4000-8000-00000000000${String(n)}`,
    url: `${STORAGE_URL}/venues/${VENUE_ID}/${String(n)}.png`,
    // Variants are made later by the worker: the first photo has them.
    srcSet:
      n === 1
        ? `${STORAGE_URL}/venues/${VENUE_ID}/1.w400.webp 400w, ${STORAGE_URL}/venues/${VENUE_ID}/1.w800.webp 800w`
        : null,
    position: n - 1,
  };
}

function png(name = 'quadra.png', bytes = 1024): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
}

function apiCalls(): string[] {
  return mocks.apiSend.mock.calls.map(
    (call) => `${String(call[0])} ${String(call[1])}`,
  );
}

/** The browser would not show a gif with this `accept`, but "all files" can. */
function setup() {
  return userEvent.setup({ applyAccept: false });
}

function storageAnswers() {
  mocks.apiSend.mockImplementation((method: string, path: string) => {
    mocks.calls.push(`api ${method} ${path}`);
    if (path.endsWith('/photos/upload-url')) {
      return Promise.resolve({
        ok: true,
        data: {
          url: STORAGE_URL,
          fields: {
            key: `venues/${VENUE_ID}/abc.png`,
            'Content-Type': 'image/png',
            Policy: 'policy',
            'X-Amz-Signature': 'sig',
          },
          key: `venues/${VENUE_ID}/abc.png`,
          expiresAt: '2026-10-29T12:10:00.000Z',
        },
      });
    }
    if (method === 'POST' && path.endsWith('/photos')) {
      return Promise.resolve({ ok: true, data: photo(1) });
    }
    return Promise.reject(new Error(`unexpected ${method} ${path}`));
  });
}

describe('PhotoUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls.length = 0;
    mocks.storageFetch.mockImplementation((url: string) => {
      mocks.calls.push(`storage POST ${url}`);
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', mocks.storageFetch);
    mocks.createImageBitmap.mockResolvedValue({
      width: 800,
      height: 600,
      close: vi.fn(),
    });
    vi.stubGlobal('createImageBitmap', mocks.createImageBitmap);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback: BlobCallback, type?: string) => {
        callback(new Blob([new Uint8Array(REENCODED_BYTES)], { type }));
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('accepts several JPG, PNG and WebP files', () => {
    render(<PhotoUploader venueId={VENUE_ID} photos={[]} />);

    const input = screen.getByLabelText('Adicionar fotos');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('multiple');
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    expect(screen.getByText('Nenhuma foto ainda.')).toBeVisible();
  });

  it('rejects a gif on the client without calling anything', async () => {
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={[]} />);

    await user.upload(
      screen.getByLabelText('Adicionar fotos'),
      new File(['x'], 'gol.gif', { type: 'image/gif' }),
    );

    expect(await screen.findByText(new RegExp(INVALID))).toBeVisible();
    expect(screen.getByText(/gol\.gif/)).toBeVisible();
    expect(mocks.apiSend).not.toHaveBeenCalled();
    expect(mocks.storageFetch).not.toHaveBeenCalled();
  });

  it('rejects a file over 10 MB on the client', async () => {
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={[]} />);

    await user.upload(
      screen.getByLabelText('Adicionar fotos'),
      png('grande.png', 10 * 1024 * 1024 + 1),
    );

    expect(await screen.findByText(new RegExp(INVALID))).toBeVisible();
    expect(mocks.apiSend).not.toHaveBeenCalled();
    expect(mocks.storageFetch).not.toHaveBeenCalled();
  });

  it('uploads in order: upload-url, storage POST, confirmation', async () => {
    storageAnswers();
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={[]} />);

    const file = png();
    await user.upload(screen.getByLabelText('Adicionar fotos'), file);

    await waitFor(() => {
      expect(screen.getByText('Enviado')).toBeVisible();
    });
    expect(mocks.calls).toEqual([
      `api POST /owner/venues/${VENUE_ID}/photos/upload-url`,
      `storage POST ${STORAGE_URL}`,
      `api POST /owner/venues/${VENUE_ID}/photos`,
    ]);

    const [, , requestBody] = mocks.apiSend.mock.calls[0] as [
      string,
      string,
      unknown,
    ];
    // The declared size is the re-encoded blob's, not the original file's.
    expect(requestBody).toEqual({
      contentType: 'image/png',
      size: REENCODED_BYTES,
    });
    const [, confirmPath, confirmBody] = mocks.apiSend.mock.calls[1] as [
      string,
      string,
      unknown,
    ];
    expect(confirmPath).toBe(`/owner/venues/${VENUE_ID}/photos`);
    expect(confirmBody).toEqual({ key: `venues/${VENUE_ID}/abc.png` });

    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'Foto 1 do espaço' })).toBeVisible();
  });

  it('posts every signed field, the content type and the file last, with no credentials or referrer', async () => {
    storageAnswers();
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={[]} />);

    const file = png();
    await user.upload(screen.getByLabelText('Adicionar fotos'), file);
    await waitFor(() => {
      expect(mocks.storageFetch).toHaveBeenCalled();
    });

    const [url, init] = mocks.storageFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(STORAGE_URL);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(init.headers).toBeUndefined();
    const body = init.body as FormData;
    const entries = [...body.entries()];
    expect(entries.map(([name]) => name)).toEqual([
      'key',
      'Content-Type',
      'Policy',
      'X-Amz-Signature',
      'file',
    ]);
    expect(body.get('Content-Type')).toBe('image/png');
    const sent = body.get('file') as File;
    expect(sent.name).toBe('quadra.png');
    // The bytes sent are the re-encoded ones (metadata stripped), not the file.
    expect(sent).not.toBe(file);
    expect(sent.type).toBe('image/png');
    expect(sent.size).toBe(REENCODED_BYTES);
    expect(mocks.createImageBitmap).toHaveBeenCalledWith(file, {
      imageOrientation: 'from-image',
    });
  });

  it('re-encodes before asking for the upload URL', async () => {
    const order: string[] = [];
    mocks.createImageBitmap.mockImplementation(() => {
      order.push('decode');
      return Promise.resolve({ width: 10, height: 10, close: vi.fn() });
    });
    mocks.apiSend.mockImplementation(() => {
      order.push('upload-url');
      return Promise.resolve({
        ok: false,
        status: 422,
        fieldErrors: {},
        message: 'parou',
      });
    });
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={[]} />);

    await user.upload(screen.getByLabelText('Adicionar fotos'), png());

    await waitFor(() => {
      expect(order).toEqual(['decode', 'upload-url']);
    });
  });

  it('skips a photo that cannot be processed and still sends the others', async () => {
    storageAnswers();
    mocks.createImageBitmap.mockRejectedValueOnce(new Error('corrupt'));
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={[]} />);

    await user.upload(screen.getByLabelText('Adicionar fotos'), [
      png('quebrada.png'),
      png('boa.png'),
    ]);

    expect(
      await screen.findByText(/Não foi possível processar esta foto/),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByText('Enviado')).toBeVisible();
    });
    expect(apiCalls()).toEqual([
      `POST /owner/venues/${VENUE_ID}/photos/upload-url`,
      `POST /owner/venues/${VENUE_ID}/photos`,
    ]);
    expect(mocks.storageFetch).toHaveBeenCalledTimes(1);
  });

  it('adds the content type itself when the signed fields leave it out', async () => {
    mocks.apiSend.mockImplementation((_method: string, path: string) =>
      Promise.resolve(
        path.endsWith('/upload-url')
          ? {
              ok: true,
              data: {
                url: STORAGE_URL,
                fields: { key: 'k', Policy: 'p' },
                key: 'k',
                expiresAt: '2026-10-29T12:10:00.000Z',
              },
            }
          : { ok: true, data: photo(1) },
      ),
    );
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={[]} />);

    await user.upload(screen.getByLabelText('Adicionar fotos'), png());
    await waitFor(() => {
      expect(mocks.storageFetch).toHaveBeenCalled();
    });

    const body = (mocks.storageFetch.mock.calls[0] as [string, RequestInit])[1]
      .body as FormData;
    expect([...body.keys()]).toEqual(['key', 'Policy', 'Content-Type', 'file']);
    expect(body.get('Content-Type')).toBe('image/png');
  });

  it('uploads several files one after the other and reports each', async () => {
    storageAnswers();
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={[]} />);

    await user.upload(screen.getByLabelText('Adicionar fotos'), [
      png('a.png'),
      new File(['x'], 'b.gif', { type: 'image/gif' }),
      png('c.png'),
    ]);

    await waitFor(() => {
      expect(screen.getAllByText('Enviado')).toHaveLength(2);
    });
    expect(screen.getByText(/b\.gif/)).toBeVisible();
    expect(apiCalls()).toEqual([
      `POST /owner/venues/${VENUE_ID}/photos/upload-url`,
      `POST /owner/venues/${VENUE_ID}/photos`,
      `POST /owner/venues/${VENUE_ID}/photos/upload-url`,
      `POST /owner/venues/${VENUE_ID}/photos`,
    ]);
  });

  it('reports a storage failure and does not confirm', async () => {
    storageAnswers();
    mocks.storageFetch.mockResolvedValue(new Response(null, { status: 403 }));
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={[]} />);

    await user.upload(screen.getByLabelText('Adicionar fotos'), png());

    expect(
      await screen.findByText(/Não foi possível enviar a foto/),
    ).toBeVisible();
    expect(apiCalls()).toEqual([
      `POST /owner/venues/${VENUE_ID}/photos/upload-url`,
    ]);
  });

  it('reports a network failure on the storage POST', async () => {
    storageAnswers();
    mocks.storageFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={[]} />);

    await user.upload(screen.getByLabelText('Adicionar fotos'), png());

    expect(
      await screen.findByText(/Não foi possível enviar a foto/),
    ).toBeVisible();
  });

  it('shows the API message when upload-url or the confirmation refuses', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 422,
      fieldErrors: {},
      message: 'Limite de 20 fotos por espaço',
    });
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={[]} />);

    await user.upload(screen.getByLabelText('Adicionar fotos'), png());

    expect(
      await screen.findByText(/Limite de 20 fotos por espaço/),
    ).toBeVisible();
    expect(mocks.storageFetch).not.toHaveBeenCalled();
  });

  it('stops when the venue would go over 20 photos', async () => {
    const full = Array.from({ length: 20 }, (_, index) => photo(index + 1));
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={full} />);

    await user.upload(screen.getByLabelText('Adicionar fotos'), png());

    expect(
      await screen.findByText(/Limite de 20 fotos por espaço/),
    ).toBeVisible();
    expect(mocks.apiSend).not.toHaveBeenCalled();
    expect(mocks.storageFetch).not.toHaveBeenCalled();
  });

  it('stops when the selection would not fit in the 20 photos', async () => {
    const nineteen = Array.from({ length: 19 }, (_, index) => photo(index + 1));
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={nineteen} />);

    await user.upload(screen.getByLabelText('Adicionar fotos'), [
      png('a.png'),
      png('b.png'),
    ]);

    expect(
      await screen.findByText(/Limite de 20 fotos por espaço/),
    ).toBeVisible();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('counts only the valid files against the 20 photos', async () => {
    storageAnswers();
    const nineteen = Array.from({ length: 19 }, (_, index) => photo(index + 1));
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={nineteen} />);

    await user.upload(screen.getByLabelText('Adicionar fotos'), [
      png('a.png'),
      new File(['x'], 'b.gif', { type: 'image/gif' }),
    ]);

    await waitFor(() => {
      expect(screen.getByText('Enviado')).toBeVisible();
    });
    expect(screen.getByText(/b\.gif/)).toBeVisible();
    expect(screen.queryByText(/Limite de 20 fotos/)).toBeNull();
  });

  it('announces the uploads politely', async () => {
    storageAnswers();
    const user = setup();
    render(<PhotoUploader venueId={VENUE_ID} photos={[]} />);

    await user.upload(screen.getByLabelText('Adicionar fotos'), png());

    const list = await screen.findByRole('list', { name: 'Envios' });
    expect(list).toHaveAttribute('aria-live', 'polite');
  });

  describe('grid', () => {
    const THREE = [photo(1), photo(2), photo(3)];

    it('marks the first photo as the cover and describes every image', () => {
      render(<PhotoUploader venueId={VENUE_ID} photos={THREE} />);

      expect(screen.getAllByText('Capa')).toHaveLength(1);
      expect(
        screen.getByRole('img', { name: 'Foto 1 do espaço' }),
      ).toHaveAttribute('src', THREE[0]?.url);
      expect(
        screen.getByRole('img', { name: 'Foto 3 do espaço' }),
      ).toBeVisible();
    });

    it('offers the thumbnail variants sized to the grid, the original while pending', () => {
      render(<PhotoUploader venueId={VENUE_ID} photos={THREE} />);

      const first = screen.getByRole('img', { name: 'Foto 1 do espaço' });
      expect(first).toHaveAttribute('srcset', THREE[0]?.srcSet);
      expect(first).toHaveAttribute(
        'sizes',
        '(min-width: 1024px) 164px, (min-width: 848px) 224px, (min-width: 640px) calc(33vw - 43px), calc(50vw - 49px)',
      );
      expect(first).toHaveAttribute('loading', 'lazy');
      const pending = screen.getByRole('img', { name: 'Foto 2 do espaço' });
      expect(pending).toHaveAttribute('src', THREE[1]?.url);
      expect(pending).not.toHaveAttribute('srcset');
      expect(pending).not.toHaveAttribute('sizes');
    });

    it('names each button after its photo and disables the ends', () => {
      render(<PhotoUploader venueId={VENUE_ID} photos={THREE} />);

      expect(
        screen.getByRole('button', { name: 'Mover foto 1 para a esquerda' }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Mover foto 3 para a direita' }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Mover foto 2 para a esquerda' }),
      ).toBeEnabled();
      expect(
        screen.getByRole('button', { name: 'Remover foto 2' }),
      ).toBeEnabled();
    });

    it('reorders through PUT with the full list of ids', async () => {
      const reordered = [
        { ...THREE[1], position: 0 },
        { ...THREE[0], position: 1 },
        THREE[2],
      ];
      mocks.apiSend.mockResolvedValue({ ok: true, data: reordered });
      const user = setup();
      render(<PhotoUploader venueId={VENUE_ID} photos={THREE} />);

      await user.click(
        screen.getByRole('button', { name: 'Mover foto 2 para a esquerda' }),
      );

      await waitFor(() => {
        expect(mocks.refresh).toHaveBeenCalled();
      });
      const [method, path, body] = mocks.apiSend.mock.calls[0] as [
        string,
        string,
        unknown,
      ];
      expect(method).toBe('PUT');
      expect(path).toBe(`/owner/venues/${VENUE_ID}/photos/order`);
      expect(body).toEqual({
        photoIds: [THREE[1]?.id, THREE[0]?.id, THREE[2]?.id],
      });
      const images = screen.getAllByRole('img');
      expect(images[0]).toHaveAttribute('src', THREE[1]?.url);
    });

    it('moves to the right too', async () => {
      mocks.apiSend.mockResolvedValue({
        ok: true,
        data: [THREE[0], THREE[2], THREE[1]],
      });
      const user = setup();
      render(<PhotoUploader venueId={VENUE_ID} photos={THREE} />);

      await user.click(
        screen.getByRole('button', { name: 'Mover foto 2 para a direita' }),
      );

      await waitFor(() => {
        expect(mocks.apiSend).toHaveBeenCalled();
      });
      expect(mocks.apiSend.mock.calls[0]?.[2]).toEqual({
        photoIds: [THREE[0]?.id, THREE[2]?.id, THREE[1]?.id],
      });
    });

    it('removes a photo through DELETE', async () => {
      mocks.apiSend.mockResolvedValue({ ok: true, data: undefined });
      const user = setup();
      render(<PhotoUploader venueId={VENUE_ID} photos={THREE} />);

      await user.click(screen.getByRole('button', { name: 'Remover foto 2' }));

      await waitFor(() => {
        expect(screen.getAllByRole('img')).toHaveLength(2);
      });
      const call = mocks.apiSend.mock.calls[0] as unknown[];
      expect(call[0]).toBe('DELETE');
      expect(call[1]).toBe(`/owner/venues/${VENUE_ID}/photos/${photo(2).id}`);
      expect(call[2]).toBeUndefined();
      expect(mocks.refresh).toHaveBeenCalled();
    });

    it('shows the 422 detail and keeps the photo when it is the last of a published venue', async () => {
      mocks.apiSend.mockResolvedValue({
        ok: false,
        status: 422,
        fieldErrors: {},
        message: 'Despublique o espaço antes de deixá-lo incompleto',
      });
      const user = setup();
      render(<PhotoUploader venueId={VENUE_ID} photos={[photo(1)]} />);

      await user.click(screen.getByRole('button', { name: 'Remover foto 1' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Despublique o espaço antes de deixá-lo incompleto',
      );
      expect(
        screen.getByRole('img', { name: 'Foto 1 do espaço' }),
      ).toBeVisible();
      expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it('puts the focus on the next Remover button after removing a photo', async () => {
      mocks.apiSend.mockResolvedValue({ ok: true, data: undefined });
      const user = setup();
      render(<PhotoUploader venueId={VENUE_ID} photos={THREE} />);

      await user.click(screen.getByRole('button', { name: 'Remover foto 2' }));

      // The former third photo is now photo 2.
      await waitFor(() => {
        expect(screen.getAllByRole('img')).toHaveLength(2);
      });
      expect(
        screen.getByRole('button', { name: 'Remover foto 2' }),
      ).toHaveFocus();
    });

    it('falls back to the previous photo when the last one is removed', async () => {
      mocks.apiSend.mockResolvedValue({ ok: true, data: undefined });
      const user = setup();
      render(<PhotoUploader venueId={VENUE_ID} photos={THREE} />);

      await user.click(screen.getByRole('button', { name: 'Remover foto 3' }));

      await waitFor(() => {
        expect(screen.getAllByRole('img')).toHaveLength(2);
      });
      expect(
        screen.getByRole('button', { name: 'Remover foto 2' }),
      ).toHaveFocus();
    });

    it('focuses the file input once the last photo is gone', async () => {
      mocks.apiSend.mockResolvedValue({ ok: true, data: undefined });
      const user = setup();
      render(<PhotoUploader venueId={VENUE_ID} photos={[photo(1)]} />);

      await user.click(screen.getByRole('button', { name: 'Remover foto 1' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Adicionar fotos')).toHaveFocus();
      });
    });

    it('keeps the focus on the moved photo arrow after a move', async () => {
      mocks.apiSend.mockResolvedValue({
        ok: true,
        data: [
          THREE[0],
          { ...THREE[2], position: 1 },
          { ...THREE[1], position: 2 },
        ],
      });
      const user = setup();
      render(<PhotoUploader venueId={VENUE_ID} photos={THREE} />);

      await user.click(
        screen.getByRole('button', { name: 'Mover foto 2 para a direita' }),
      );

      // Photo 2 became photo 3 and has nowhere further right: the other arrow takes the focus.
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Mover foto 3 para a esquerda' }),
        ).toHaveFocus();
      });
    });

    it('keeps the order and says why when the reorder fails', async () => {
      mocks.apiSend.mockResolvedValue({
        ok: false,
        status: 500,
        fieldErrors: {},
        message: 'Não foi possível concluir. Tente novamente.',
      });
      const user = setup();
      render(<PhotoUploader venueId={VENUE_ID} photos={THREE} />);

      await user.click(
        screen.getByRole('button', { name: 'Mover foto 2 para a esquerda' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Não foi possível concluir. Tente novamente.',
      );
      const list = screen.getByRole('list', { name: 'Fotos do espaço' });
      expect(within(list).getAllByRole('img')[0]).toHaveAttribute(
        'src',
        THREE[0]?.url,
      );
    });
  });
});
