import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pathname: '/', demo: false }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/lib/demo', () => ({
  get isDemoMode() {
    return mocks.demo;
  },
}));

import { PublicHeader } from './public-header';

describe('PublicHeader', () => {
  beforeEach(() => {
    mocks.pathname = '/';
    mocks.demo = false;
  });

  it('shows "Quadras" as the current section', () => {
    mocks.pathname = '/buscar';
    render(<PublicHeader user={null} />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Quadras');
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(links[0]).toHaveAttribute('href', '/');
  });

  it('adds "Partidas" (new) and "Mensalistas" in the demo mode', () => {
    mocks.demo = true;
    render(<PublicHeader user={null} />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(
      within(nav).getByRole('link', { name: 'Partidas Novo' }),
    ).toHaveAttribute('href', '/#partidas');
    expect(
      within(nav).getByRole('link', { name: 'Mensalistas' }),
    ).toHaveAttribute('href', '/painel');
  });

  it('gives way to the "Bora jogar?" pill on the mobile home only', () => {
    const { rerender } = render(<PublicHeader user={null} />);
    expect(screen.getByRole('banner')).toHaveClass('max-md:hidden');

    mocks.pathname = '/buscar';
    rerender(<PublicHeader user={null} />);
    expect(screen.getByRole('banner')).not.toHaveClass('max-md:hidden');
  });

  it('passes the user on', () => {
    render(<PublicHeader user={{ name: 'Maria Souza' }} />);
    expect(
      screen.getByRole('link', { name: 'Minha conta (MS)' }),
    ).toHaveAttribute('href', '/conta');
  });
});
