import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));

import { PublicMain } from './public-main';

describe('PublicMain', () => {
  beforeEach(() => {
    mocks.pathname = '/';
  });

  it('is the 1360px column with gutters on ordinary pages', () => {
    mocks.pathname = '/espacos/arena-1';
    render(<PublicMain>conteúdo</PublicMain>);

    const main = screen.getByRole('main');
    expect(main).toHaveClass('mx-auto', 'max-w-[1360px]', 'px-4', 'md:px-10');
    expect(main).toHaveAttribute('id', 'conteudo');
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(main).toHaveClass('outline-none');
  });

  it('is full width on /buscar, where the map runs to the screen edge', () => {
    mocks.pathname = '/buscar';
    render(<PublicMain>conteúdo</PublicMain>);

    const main = screen.getByRole('main');
    expect(main).not.toHaveClass('max-w-[1360px]');
    expect(main.className).not.toMatch(/(^|\s)px-/);
    expect(main).toHaveClass('w-full', 'flex-1');
    expect(main).toHaveAttribute('id', 'conteudo');
  });

  it('leaves the bottom spacing to the tab bar spacer', () => {
    render(<PublicMain>conteúdo</PublicMain>);

    expect(screen.getByRole('main').className).not.toMatch(/(^|\s)pb-/);
  });
});
