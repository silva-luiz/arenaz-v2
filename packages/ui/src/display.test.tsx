import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';
import { Card } from './card';
import { cn } from './cn';

describe('cn', () => {
  it('joins truthy classes and drops the rest', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });
});

describe('Card', () => {
  it('renders a section by default and a div on request', () => {
    const { rerender } = render(<Card>Conteúdo</Card>);
    expect(screen.getByText('Conteúdo').tagName).toBe('SECTION');

    rerender(
      <Card as="div" className="extra">
        Conteúdo
      </Card>,
    );
    const card = screen.getByText('Conteúdo');
    expect(card.tagName).toBe('DIV');
    expect(card).toHaveClass('extra');
  });
});

describe('Badge', () => {
  it('renders its text for every tone', () => {
    render(
      <>
        <Badge tone="neutral">Neutro</Badge>
        <Badge tone="brand">Marca</Badge>
        <Badge tone="free">Livre às 20h</Badge>
        <Badge tone="warning">Pendente</Badge>
      </>,
    );

    expect(screen.getByText('Neutro')).toBeVisible();
    expect(screen.getByText('Marca')).toBeVisible();
    expect(screen.getByText('Livre às 20h')).toBeVisible();
    expect(screen.getByText('Pendente')).toBeVisible();
  });
});
