import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TabBar } from './tab-bar';

describe('TabBar', () => {
  it('is a labelled navigation with Explorar, Reservas and Perfil by default', () => {
    render(<TabBar active="explorar" />);
    const nav = screen.getByRole('navigation', {
      name: 'Navegação principal',
    });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Explorar',
      'Reservas',
      'Perfil',
    ]);
    expect(within(nav).getByRole('link', { name: 'Explorar' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(within(nav).getByRole('link', { name: 'Reservas' })).toHaveAttribute(
      'href',
      '/reservas',
    );
    expect(within(nav).getByRole('link', { name: 'Perfil' })).toHaveAttribute(
      'href',
      '/conta',
    );
  });

  it('takes the destinations from `items`, in order', () => {
    render(
      <TabBar
        active={null}
        items={[
          { id: 'explorar', href: '/' },
          { id: 'partidas', href: '/#partidas' },
          { id: 'reservas', href: '/reservas' },
          { id: 'perfil', href: '/conta' },
        ]}
      />,
    );
    const labels = within(screen.getByRole('navigation'))
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Explorar', 'Partidas', 'Reservas', 'Perfil']);
    expect(screen.getByRole('link', { name: 'Partidas' })).toHaveAttribute(
      'href',
      '/#partidas',
    );
    expect(screen.queryByRole('link', { current: 'page' })).toBeNull();
  });

  it('marks only the active item with aria-current="page"', () => {
    render(<TabBar active="reservas" />);
    expect(screen.getByRole('link', { name: 'Reservas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Explorar' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('link', { name: 'Perfil' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows the active item with a non-colour cue too (weight)', () => {
    render(<TabBar active="perfil" />);
    const active = screen.getByRole('link', { name: 'Perfil' });
    const idle = screen.getByRole('link', { name: 'Explorar' });

    expect(active).toHaveClass('text-brand', 'font-semibold');
    expect(idle).toHaveClass('text-muted', 'font-medium');
    expect(idle).not.toHaveClass('font-semibold');
  });

  it('keeps every item at least 44px tall', () => {
    render(<TabBar active="explorar" />);
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveClass('min-h-14');
    }
  });

  it('renders a mobile-only spacer as tall as the bar plus the safe area', () => {
    render(<TabBar active="explorar" />);
    const spacer = screen.getByTestId('tab-bar-spacer');
    expect(spacer).toHaveAttribute('aria-hidden', 'true');
    expect(spacer).toHaveClass('md:hidden');
    expect(spacer.className).toContain('env(safe-area-inset-bottom)');
    expect(spacer.className).toContain('3.5rem');
  });

  it('is mobile only, fixed to the bottom, translucent and safe-area aware', () => {
    render(<TabBar active="perfil" />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('md:hidden', 'fixed', 'bottom-0', 'bg-white/96');
    expect(nav.className).toContain('env(safe-area-inset-bottom)');
  });

  it('hides the decorative icons from assistive tech', () => {
    const { container } = render(<TabBar active="explorar" />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(3);
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
