import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pathname: '/', demo: false }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/lib/demo', () => ({
  get isDemoMode() {
    return mocks.demo;
  },
}));

import { PublicTabBar } from './public-tab-bar';

describe('PublicTabBar', () => {
  beforeEach(() => {
    mocks.pathname = '/';
    mocks.demo = false;
  });

  it.each([
    ['/', 'Explorar'],
    ['/buscar', 'Explorar'],
    ['/espacos/arena', 'Explorar'],
    ['/reservas', 'Reservas'],
    ['/reservas/abc', 'Reservas'],
    ['/conta', 'Perfil'],
  ])('%s marks %s', (pathname, label) => {
    mocks.pathname = pathname;
    render(<PublicTabBar />);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('has Explorar, Reservas and Perfil outside the demo mode', () => {
    render(<PublicTabBar />);
    const labels = within(screen.getByRole('navigation'))
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Explorar', 'Reservas', 'Perfil']);
  });

  it('adds "Partidas" (the open games of the home) in the demo mode', () => {
    mocks.demo = true;
    render(<PublicTabBar />);
    const labels = within(screen.getByRole('navigation'))
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Explorar', 'Partidas', 'Reservas', 'Perfil']);
    expect(screen.getByRole('link', { name: 'Partidas' })).toHaveAttribute(
      'href',
      '/#partidas',
    );
  });
});
