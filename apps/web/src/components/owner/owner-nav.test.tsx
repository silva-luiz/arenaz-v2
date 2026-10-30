import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pathname: { current: '/painel' },
  demo: { value: false },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname.current,
}));
vi.mock('@/lib/demo', () => ({
  get isDemoMode() {
    return mocks.demo.value;
  },
}));

import { OwnerNav, type OwnerNavVenue } from './owner-nav';

const VILA: OwnerNavVenue = {
  id: '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10',
  name: 'Arena Vila Madalena',
  fieldsCount: 3,
  coverUrl: 'https://cdn.test/vila.jpg',
};
const PINHEIROS: OwnerNavVenue = {
  id: '4a1d2c3e-7b5f-4e7c-8b63-2c7f1d8e0a21',
  name: 'Arena Pinheiros',
  fieldsCount: 1,
  coverUrl: null,
};

function renderNav(venues: OwnerNavVenue[] = [VILA, PINHEIROS]) {
  return render(<OwnerNav venues={venues} ownerName="Marcos Almeida" />);
}

describe('OwnerNav', () => {
  beforeEach(() => {
    mocks.pathname.current = '/painel';
    mocks.demo.value = false;
  });

  it('is the panel sidebar: home link with the wordmark and the DONO tag', () => {
    renderNav();
    const nav = screen.getByRole('navigation', { name: 'Painel do dono' });
    expect(
      within(nav).getByRole('link', { name: 'ArenaZ, início' }),
    ).toHaveAttribute('href', '/');
    expect(within(nav).getByText('arenaz')).toBeVisible();
    expect(within(nav).getByText('DONO')).toBeVisible();
  });

  it('links to the venue list and to the account, marking the list', () => {
    renderNav();
    expect(screen.getByRole('link', { name: 'Meus espaços' })).toHaveAttribute(
      'href',
      '/painel',
    );
    expect(screen.getByRole('link', { name: 'Meus espaços' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Conta' })).toHaveAttribute(
      'href',
      '/conta',
    );
    expect(screen.getByRole('link', { name: 'Conta' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('has no venue links or card when no venue is in context', () => {
    renderNav();
    expect(screen.queryByRole('link', { name: 'Hoje' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Quadras' })).toBeNull();
    expect(screen.queryByText('Arena Vila Madalena')).toBeNull();
  });

  it('uses the only venue of the owner when the path names none', () => {
    renderNav([VILA]);
    expect(screen.getByRole('link', { name: 'Hoje' })).toHaveAttribute(
      'href',
      `/painel/espacos/${VILA.id}/agenda`,
    );
    expect(screen.getByText('Arena Vila Madalena')).toBeVisible();
  });

  it('on the agenda of a venue: Hoje is the page, Agenda jumps to it, Quadras to the courts', () => {
    mocks.pathname.current = `/painel/espacos/${PINHEIROS.id}/agenda`;
    renderNav();
    const hoje = screen.getByRole('link', { name: 'Hoje' });
    expect(hoje).toHaveAttribute(
      'href',
      `/painel/espacos/${PINHEIROS.id}/agenda`,
    );
    expect(hoje).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute(
      'href',
      `/painel/espacos/${PINHEIROS.id}/agenda#agenda`,
    );
    expect(screen.getByRole('link', { name: 'Quadras' })).toHaveAttribute(
      'href',
      `/painel/espacos/${PINHEIROS.id}#espaco-quadras`,
    );
    expect(
      screen.getByRole('link', { name: 'Meus espaços' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('marks Quadras on the venue page and on its court pages', () => {
    mocks.pathname.current = `/painel/espacos/${VILA.id}`;
    const { unmount } = renderNav();
    expect(screen.getByRole('link', { name: 'Quadras' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    unmount();
    mocks.pathname.current = `/painel/espacos/${VILA.id}/quadras/novo`;
    renderNav();
    expect(screen.getByRole('link', { name: 'Quadras' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('shows the venue of the path with its courts and the first name of the owner', () => {
    mocks.pathname.current = `/painel/espacos/${VILA.id}/agenda`;
    renderNav();
    const card = screen.getByText('Arena Vila Madalena').closest('div');
    expect(card).toHaveTextContent('3 quadras · Marcos');
    expect(screen.queryByText('Arena Pinheiros')).toBeNull();
  });

  it('says "1 quadra" and shows the mark when there is no cover', () => {
    mocks.pathname.current = `/painel/espacos/${PINHEIROS.id}`;
    renderNav();
    expect(
      screen.getByText('Arena Pinheiros').closest('div'),
    ).toHaveTextContent('1 quadra · Marcos');
  });

  it('has no Mensalistas, Financeiro or Avaliações outside the demo', () => {
    renderNav();
    for (const name of ['Mensalistas', 'Financeiro', 'Avaliações']) {
      expect(screen.queryByText(name)).toBeNull();
    }
  });

  it('shows them disabled ("em breve") in the demo', () => {
    mocks.demo.value = true;
    renderNav();
    for (const name of ['Mensalistas', 'Financeiro', 'Avaliações']) {
      const item = screen.getByRole('button', {
        name: `${name} (em breve)`,
      });
      expect(item).toBeDisabled();
      expect(item).toHaveAttribute('title', 'Em breve');
    }
  });
});
