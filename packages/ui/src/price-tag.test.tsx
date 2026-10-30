import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriceTag } from './price-tag';

describe('PriceTag', () => {
  it('drops the cents when the price is whole reais', () => {
    render(<PriceTag cents={18000} />);
    expect(screen.getByText('R$ 180')).toBeVisible();
    expect(screen.getByText('/ hora')).toBeVisible();
  });

  it('keeps the cents otherwise', () => {
    render(<PriceTag cents={18050} />);
    expect(screen.getByText('R$ 180,50')).toBeVisible();
  });

  it('formats thousands the pt-BR way', () => {
    render(<PriceTag cents={123456} />);
    expect(screen.getByText('R$ 1.234,56')).toBeVisible();
  });

  it('prefixes "a partir de" with from', () => {
    const { container } = render(<PriceTag cents={18000} from />);
    expect(container).toHaveTextContent('a partir de R$ 180 / hora');
  });

  it('accepts a custom suffix', () => {
    const { container } = render(<PriceTag cents={9000} suffix="/ jogo" />);
    expect(container).toHaveTextContent('R$ 90 / jogo');
  });
});
