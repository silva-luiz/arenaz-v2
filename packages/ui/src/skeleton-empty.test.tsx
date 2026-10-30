import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('is a decorative placeholder that keeps the given classes', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    const el = container.firstElementChild;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveClass('h-4', 'w-20', 'animate-pulse');
    expect(el?.className).toContain('motion-reduce:animate-none');
  });
});

describe('EmptyState', () => {
  it('shows the title, description and action', () => {
    render(
      <EmptyState
        title="Nenhuma quadra por aqui"
        description="Tente outro esporte."
        action={<a href="/buscar">Limpar filtros</a>}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Nenhuma quadra por aqui' }),
    ).toBeVisible();
    expect(screen.getByText('Tente outro esporte.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Limpar filtros' })).toBeVisible();
  });

  it('renders only the title when it is all there is', () => {
    render(<EmptyState title="Vazio" />);
    expect(screen.getByRole('heading', { name: 'Vazio' })).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
