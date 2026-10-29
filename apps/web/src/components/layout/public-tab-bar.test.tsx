import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));

import { PublicTabBar } from './public-tab-bar';

describe('PublicTabBar', () => {
  beforeEach(() => {
    mocks.pathname = '/';
  });

  it.each([
    ['/', 'Início'],
    ['/buscar', 'Buscar'],
    ['/espacos/arena', 'Buscar'],
    ['/reservas', 'Reservas'],
    ['/reservas/abc', 'Reservas'],
    ['/conta', 'Conta'],
  ])('%s marks %s', (pathname, label) => {
    mocks.pathname = pathname;
    render(<PublicTabBar />);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
