import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  it('marks the search page for the scroll padding of its taller sticky header', () => {
    mocks.pathname = '/buscar';
    const { unmount } = render(<PublicMain>conteúdo</PublicMain>);
    expect(screen.getByRole('main')).toHaveAttribute('data-search-page', '');
    unmount();

    mocks.pathname = '/espacos/arena-1';
    render(<PublicMain>conteúdo</PublicMain>);
    expect(screen.getByRole('main')).not.toHaveAttribute('data-search-page');
  });

  it('globals.css gives that mark the header height as scroll padding', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/app/globals.css'),
      'utf8',
    );

    expect(css).toMatch(
      /html:has\(\[data-search-page\]\)\s*\{\s*scroll-padding-top:\s*var\(--search-header-h\);/,
    );
  });

  it('leaves the bottom spacing to the tab bar spacer', () => {
    render(<PublicMain>conteúdo</PublicMain>);

    expect(screen.getByRole('main').className).not.toMatch(/(^|\s)pb-/);
  });
});
