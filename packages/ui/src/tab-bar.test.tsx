import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TabBar } from './tab-bar';

describe('TabBar', () => {
  it('is a labelled navigation with the three destinations', () => {
    render(<TabBar active="inicio" />);
    const nav = screen.getByRole('navigation', {
      name: 'Navegação principal',
    });
    expect(within(nav).getAllByRole('link')).toHaveLength(3);
    expect(within(nav).getByRole('link', { name: 'Início' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(within(nav).getByRole('link', { name: 'Buscar' })).toHaveAttribute(
      'href',
      '/buscar',
    );
    expect(within(nav).getByRole('link', { name: 'Conta' })).toHaveAttribute(
      'href',
      '/conta',
    );
  });

  it('marks only the active item with aria-current="page"', () => {
    render(<TabBar active="buscar" />);
    expect(screen.getByRole('link', { name: 'Buscar' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('link', { name: 'Conta' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('is mobile only, fixed to the bottom and safe-area aware', () => {
    render(<TabBar active="conta" />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('md:hidden', 'fixed', 'bottom-0');
    expect(nav.className).toContain('env(safe-area-inset-bottom)');
  });

  it('hides the decorative icons from assistive tech', () => {
    const { container } = render(<TabBar active="inicio" />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(3);
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
