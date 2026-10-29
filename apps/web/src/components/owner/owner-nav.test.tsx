import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pathname: { current: '/painel' } }));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname.current,
}));

import { OwnerNav } from './owner-nav';

describe('OwnerNav', () => {
  beforeEach(() => {
    mocks.pathname.current = '/painel';
  });

  it('links to the venue list and to the account', () => {
    render(<OwnerNav />);

    const nav = screen.getByRole('navigation', { name: 'Painel do dono' });
    expect(nav).toBeVisible();
    expect(screen.getByRole('link', { name: 'Meus espaços' })).toHaveAttribute(
      'href',
      '/painel',
    );
    expect(screen.getByRole('link', { name: 'Conta' })).toHaveAttribute(
      'href',
      '/conta',
    );
  });

  it('marks the venue list as the current page', () => {
    render(<OwnerNav />);

    expect(screen.getByRole('link', { name: 'Meus espaços' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Conta' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('keeps the venue list highlighted on its sub pages', () => {
    mocks.pathname.current = '/painel/espacos/abc';
    render(<OwnerNav />);

    expect(screen.getByRole('link', { name: 'Meus espaços' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});
