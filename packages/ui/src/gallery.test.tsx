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
    expect(container.innerHTML).toContain('md:rounded-photo');
  });

  it('keeps every photo on the mobile strip but only five on the grid', () => {
    render(<Gallery photos={photos(7)} />);

    const buttons = photoButtons();
    expect(buttons).toHaveLength(7);
    expect(buttons[4]).not.toHaveClass('md:hidden');
    expect(buttons[5]).toHaveClass('md:hidden');
    expect(buttons[6]).toHaveClass('md:hidden');
    expect(buttons[6]).toHaveAccessibleName('Abrir foto 7 de 7');
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

  it('gives a lone photo the full width of the mobile row', () => {
    const { rerender } = render(<Gallery photos={photos(1)} />);
    const lone = screen.getByRole('button', { name: 'Abrir foto 1 de 1' });
    expect(lone).toHaveClass('basis-full');
    expect(lone).not.toHaveClass('basis-[88%]');

    rerender(<Gallery photos={photos(2)} />);
    const first = screen.getByRole('button', { name: 'Abrir foto 1 de 2' });
    expect(first).toHaveClass('basis-[88%]');
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
