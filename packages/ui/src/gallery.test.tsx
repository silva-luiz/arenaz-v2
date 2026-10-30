import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Gallery } from './gallery';

function photos(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    url: `/foto-${String(i + 1)}.jpg`,
    alt: `Foto ${String(i + 1)} da quadra`,
  }));
}

function photoButtons() {
  return screen.getAllByRole('button', { name: /^Abrir foto \d+ de \d+$/ });
}

describe('Gallery', () => {
  it('renders nothing without photos', () => {
    const { container } = render(<Gallery photos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('adapts to a single photo: no 5-photo grid, no "show all"', () => {
    const { container } = render(<Gallery photos={photos(1)} />);

    expect(photoButtons()).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Abrir foto 1 de 1' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Mostrar todas as fotos' }),
    ).toBeNull();
    expect(container.innerHTML).not.toContain('md:grid-cols-4');
  });

  it('offers "Mostrar todas as fotos" from two photos on', () => {
    render(<Gallery photos={photos(2)} />);
    expect(
      screen.getByRole('button', { name: 'Mostrar todas as fotos' }),
    ).toBeVisible();
  });

  it('uses the 1 large + 4 small grid with five photos', () => {
    const { container } = render(<Gallery photos={photos(5)} />);

    expect(photoButtons()).toHaveLength(5);
    expect(container.innerHTML).toContain('md:grid-cols-4');
    expect(container.innerHTML).toContain('md:grid-rows-[210px_210px]');
    expect(container.innerHTML).toContain('md:rounded-card');
    expect(container.innerHTML).toContain('shadow-2');
  });

  it('is a 2 column grid on a phone: the large photo on top, squares below', () => {
    render(<Gallery photos={photos(5)} />);

    const [large, ...small] = photoButtons();
    expect(large).toHaveClass('col-span-2', 'aspect-[4/3]');
    for (const button of small) {
      expect(button).toHaveClass('aspect-square');
      expect(button).not.toHaveClass('col-span-2');
    }
  });

  it('shows five photos and leaves the others to the lightbox', async () => {
    const user = userEvent.setup();
    render(<Gallery photos={photos(7)} />);

    const buttons = photoButtons();
    expect(buttons).toHaveLength(5);
    expect(buttons[4]).toHaveAccessibleName('Abrir foto 5 de 7');

    await user.click(
      screen.getByRole('button', { name: 'Mostrar todas as fotos' }),
    );
    expect(screen.getByText('1 de 7')).toBeVisible();
  });

  it.each([
    [2, 'md:grid-cols-2'],
    [3, 'md:grid-cols-4'],
    [4, 'md:grid-cols-4'],
  ])('leaves no hole with %i photos', (count, desktopGrid) => {
    const { container } = render(<Gallery photos={photos(count)} />);

    const buttons = photoButtons();
    expect(container.innerHTML).toContain(desktopGrid);
    // Phone: after the large photo, an odd count of small ones would leave a
    // hole in the 2 columns, so the last one takes the whole row.
    const small = buttons.slice(1);
    const last = small.at(-1);
    if (small.length % 2 === 1) {
      expect(last).toHaveClass('col-span-2', 'aspect-[2/1]');
    } else {
      expect(last).not.toHaveClass('col-span-2');
    }
    // Desktop: 3 photos stack two halves on the right, 4 put a wide one on
    // top of two quarters; a stretched phone row is undone.
    if (count === 3) {
      expect(buttons[1]).toHaveClass('md:col-span-2');
      expect(buttons[2]).toHaveClass('md:col-span-2');
    }
    if (count === 4) {
      expect(buttons[1]).toHaveClass('md:col-span-2');
      expect(buttons[3]).toHaveClass('md:col-span-1', 'md:aspect-auto');
    }
    if (count === 2) {
      expect(buttons[1]).toHaveClass('md:col-span-1');
    }
  });

  it('describes each photo button with the photo alt text', () => {
    render(<Gallery photos={photos(3)} />);
    expect(
      screen.getByRole('button', { name: 'Abrir foto 2 de 3' }),
    ).toHaveAccessibleDescription('Foto 2 da quadra');
  });

  it('keeps the images decorative, lazy except the first', () => {
    const { container } = render(<Gallery photos={photos(3)} />);
    const images = [...container.querySelectorAll('img')];

    expect(images).toHaveLength(3);
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt', '');
    });
    expect(images[0]).not.toHaveAttribute('loading', 'lazy');
    expect(images[1]).toHaveAttribute('loading', 'lazy');
  });

  it('opens the lightbox at the clicked photo and returns focus on close', async () => {
    const user = userEvent.setup();
    render(<Gallery photos={photos(5)} />);

    const third = screen.getByRole('button', { name: 'Abrir foto 3 de 5' });
    await user.click(third);

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText('3 de 5')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Foto 3 da quadra' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(third).toHaveFocus();
  });

  it('returns focus to the photo even when a mouse click did not focus it', () => {
    render(<Gallery photos={photos(3)} />);

    const second = screen.getByRole('button', { name: 'Abrir foto 2 de 3' });
    // Safari and Firefox on macOS do not focus a button on mouse click.
    fireEvent.click(second);
    expect(second).not.toHaveFocus();
    expect(screen.getByRole('dialog')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(second).toHaveFocus();
  });

  it('offers the variants of each photo with the sizes of its slot', () => {
    const list = photos(5).map((photo, i) => ({
      ...photo,
      srcSet: `/foto-${String(i + 1)}.w400.webp 400w, /foto-${String(i + 1)}.w800.webp 800w`,
    }));
    const { container } = render(<Gallery photos={list} />);
    const imgs = container.querySelectorAll('img');
    expect(imgs[0]).toHaveAttribute('srcset', list[0]?.srcSet);
    expect(imgs[0]).toHaveAttribute('src', '/foto-1.jpg');
    // The large photo: half the 1160px column on desktop, the whole content
    // width on a phone.
    expect(imgs[0]).toHaveAttribute(
      'sizes',
      '(min-width: 1240px) 576px, (min-width: 768px) calc(50vw - 44px), calc(100vw - 32px)',
    );
    // A small one: a quarter of it, half the width on a phone.
    expect(imgs[3]).toHaveAttribute(
      'sizes',
      '(min-width: 1240px) 284px, (min-width: 768px) calc(25vw - 26px), calc(50vw - 20px)',
    );
  });

  it('sizes the small photos that span two columns as halves', () => {
    const list = photos(3).map((photo) => ({ ...photo, srcSet: 'x 400w' }));
    const { container } = render(<Gallery photos={list} />);
    for (const img of container.querySelectorAll('img')) {
      expect(img.getAttribute('sizes')).toMatch(/^\(min-width: 1240px\) 576px/);
    }
  });

  it('gives a lone photo the full content width in its sizes', () => {
    const { container } = render(
      <Gallery
        photos={[{ url: '/a.jpg', alt: 'A', srcSet: '/a.w400.webp 400w' }]}
      />,
    );
    expect(container.querySelector('img')).toHaveAttribute(
      'sizes',
      '(min-width: 1240px) 1160px, (min-width: 768px) calc(100vw - 80px), calc(100vw - 32px)',
    );
  });

  it('serves only the originals while the variants are pending', () => {
    const { container } = render(
      <Gallery
        photos={photos(2).map((photo) => ({ ...photo, srcSet: null }))}
      />,
    );
    for (const img of container.querySelectorAll('img')) {
      expect(img).not.toHaveAttribute('srcset');
      expect(img).not.toHaveAttribute('sizes');
    }
  });

  it('gives a lone photo the whole row', () => {
    render(<Gallery photos={photos(1)} />);
    const lone = screen.getByRole('button', { name: 'Abrir foto 1 de 1' });
    expect(lone).toHaveClass('col-span-2', 'aspect-[4/3]');
  });

  it('opens the lightbox at the first photo from "Mostrar todas as fotos"', async () => {
    const user = userEvent.setup();
    render(<Gallery photos={photos(5)} />);

    const showAll = screen.getByRole('button', {
      name: 'Mostrar todas as fotos',
    });
    await user.click(showAll);

    expect(screen.getByText('1 de 5')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(showAll).toHaveFocus();
  });
});
