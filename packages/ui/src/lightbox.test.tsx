import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lightbox } from './lightbox';

const PHOTOS = [
  { url: '/1.jpg', alt: 'Quadra vista de cima' },
  { url: '/2.jpg', alt: 'Vestiário' },
  { url: '/3.jpg', alt: 'Arquibancada' },
];

function Harness({ start = 0 }: { start?: number }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(start);
        }}
      >
        Abrir galeria
      </button>
      {open !== null ? (
        <Lightbox
          photos={PHOTOS}
          index={open}
          onClose={() => {
            setOpen(null);
          }}
        />
      ) : null}
    </>
  );
}

async function openLightbox(start?: number) {
  const user = userEvent.setup();
  render(<Harness {...(start === undefined ? {} : { start })} />);
  await user.click(screen.getByRole('button', { name: 'Abrir galeria' }));
  return user;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Lightbox', () => {
  it('opens as a native modal dialog with focus on "Fechar"', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    await openLightbox();

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('dialog', { name: 'Galeria de fotos' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
  });

  it('shows the photo with its alt text and an "N de M" live counter', async () => {
    await openLightbox();

    expect(
      screen.getByRole('img', { name: 'Quadra vista de cima' }),
    ).toHaveAttribute('src', '/1.jpg');
    const counter = screen.getByText('1 de 3');
    expect(counter).toHaveAttribute('aria-live', 'polite');
  });

  it('starts at the given index', async () => {
    await openLightbox(2);

    expect(screen.getByText('3 de 3')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Arquibancada' })).toBeVisible();
  });

  it('moves with the arrow keys and wraps around', async () => {
    const user = await openLightbox();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('2 de 3')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Vestiário' })).toBeVisible();

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByText('3 de 3')).toBeVisible();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('1 de 3')).toBeVisible();
  });

  it('keeps the arrow keys working after clicking the photo', async () => {
    const user = await openLightbox();

    await user.click(screen.getByRole('img', { name: 'Quadra vista de cima' }));
    await user.keyboard('{ArrowRight}');

    expect(screen.getByText('2 de 3')).toBeVisible();

    await user.click(screen.getByRole('img', { name: 'Vestiário' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stops listening to the keyboard once unmounted', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(
      <Lightbox photos={PHOTOS} index={0} onClose={onClose} />,
    );
    unmount();

    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores keys another handler already handled', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Lightbox photos={PHOTOS} index={0} onClose={onClose} />);
    // A handler closer to the target (a nested control) claimed the key.
    const claim = (event: KeyboardEvent) => {
      event.preventDefault();
    };
    document.body.addEventListener('keydown', claim);

    await user.keyboard('{ArrowRight}{Escape}');
    document.body.removeEventListener('keydown', claim);

    expect(screen.getByText('1 de 3')).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores keys once the dialog is no longer open', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Lightbox photos={PHOTOS} index={0} onClose={onClose} />);

    // Closed from outside (for example the Android back gesture) while the
    // component is still mounted.
    screen.getByRole<HTMLDialogElement>('dialog', { hidden: true }).close();
    onClose.mockClear();
    await user.keyboard('{ArrowRight}{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText('2 de 3')).toBeNull();
  });

  it('returns focus to returnFocusRef even if the opener never had focus', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    const { unmount } = render(
      <Lightbox
        photos={PHOTOS}
        index={0}
        onClose={vi.fn()}
        returnFocusRef={{ current: trigger }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();

    unmount();

    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('draws a two-tone focus ring on every control', () => {
    render(<Lightbox photos={PHOTOS} index={0} onClose={vi.fn()} />);
    for (const name of ['Fechar', 'Foto anterior', 'Próxima foto']) {
      const button = screen.getByRole('button', { name });
      expect(button.className).toContain('focus-visible:shadow-[');
      expect(button.className).toContain('focus-visible:outline-hidden');
    }
  });

  it('moves with the previous and next buttons', async () => {
    const user = await openLightbox();

    await user.click(screen.getByRole('button', { name: 'Próxima foto' }));
    expect(screen.getByText('2 de 3')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Foto anterior' }));
    expect(screen.getByText('1 de 3')).toBeVisible();
  });

  it('closes on Esc and returns focus to the opener', async () => {
    const user = await openLightbox();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir galeria' })).toHaveFocus();
  });

  it('closes with the "Fechar" button and returns focus to the opener', async () => {
    const user = await openLightbox();

    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir galeria' })).toHaveFocus();
  });

  it('reports a native close of the dialog', () => {
    const onClose = vi.fn();
    render(<Lightbox photos={PHOTOS} index={0} onClose={onClose} />);

    screen.getByRole('dialog').dispatchEvent(new Event('close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has no navigation with a single photo', () => {
    render(
      <Lightbox photos={PHOTOS.slice(0, 1)} index={0} onClose={vi.fn()} />,
    );

    expect(screen.getByText('1 de 1')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Próxima foto' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Foto anterior' })).toBeNull();
  });

  it('renders nothing without photos', () => {
    const { container } = render(
      <Lightbox photos={[]} index={0} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
