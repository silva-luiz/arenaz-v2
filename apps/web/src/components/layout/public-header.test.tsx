import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  demo: false,
  search: '',
}));
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.search),
  useRouter: () => ({ push: vi.fn() }),
}));
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
    mocks.search = '';
  });

  it('shows "Quadras" as the current section', () => {
    mocks.pathname = '/espacos/arena-1';
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

  describe('on /buscar', () => {
    beforeEach(() => {
      mocks.pathname = '/buscar';
    });

    it('has no section tabs, the compact search and the filter pills, all in the banner', () => {
      render(<PublicHeader user={null} />);

      const header = screen.getByRole('banner');
      expect(
        within(header).queryByRole('navigation', { name: 'Principal' }),
      ).toBeNull();
      expect(
        within(header).getByText('Alterar a busca:', { exact: false }),
      ).toBeInTheDocument();
      expect(
        within(header).getByRole('group', { name: 'Filtros' }),
      ).toBeInTheDocument();
    });

    it('spans the viewport, keeps its border and drops the wordmark and "Anuncie" on a phone', () => {
      render(<PublicHeader user={null} />);

      const header = screen.getByRole('banner');
      expect(header).not.toHaveClass('md:border-b-0');
      expect(header.innerHTML).not.toContain('max-w-[1360px]');
      expect(screen.getByText('arenaz')).toHaveClass('max-md:hidden');
      expect(
        screen.getByRole('link', { name: 'Anuncie sua quadra' }),
      ).toHaveClass('max-md:hidden');
    });

    it('shows the pills pressed as the URL says', () => {
      mocks.search = 'amenities=coberta&maxPrice=200';
      render(<PublicHeader user={null} />);

      expect(screen.getByRole('button', { name: 'Coberta' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Vestiário' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(
        screen.getByRole('button', { name: 'Até R$ 200/h' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('keeps the plain header (tabs, 1360px column, wordmark) off /buscar', () => {
    mocks.pathname = '/espacos/arena-1';
    render(<PublicHeader user={null} />);

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('md:border-b-0');
    expect(header.innerHTML).toContain('max-w-[1360px]');
    expect(screen.getByText('arenaz')).not.toHaveClass('max-md:hidden');
    expect(screen.queryByRole('group', { name: 'Filtros' })).toBeNull();
    expect(screen.queryByText('Alterar a busca:', { exact: false })).toBeNull();
  });
});
