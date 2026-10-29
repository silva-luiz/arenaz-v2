import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert } from './alert';

describe('Alert', () => {
  it('is always in the DOM as an empty live region', () => {
    render(<Alert tone="error">{null}</Alert>);

    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  });

  it('announces by filling the same region with text', () => {
    const { rerender } = render(<Alert tone="error">{null}</Alert>);
    const region = screen.getByRole('alert');

    rerender(<Alert tone="error">E-mail ou senha inválidos</Alert>);

    expect(screen.getByRole('alert')).toBe(region);
    expect(region).toHaveTextContent('E-mail ou senha inválidos');
  });

  it('treats an empty string as no message', () => {
    render(<Alert tone="info">{''}</Alert>);

    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  });

  it('renders every tone with its message', () => {
    render(
      <>
        <Alert tone="error">Erro</Alert>
        <Alert tone="info">Info</Alert>
        <Alert tone="success">Salvo</Alert>
      </>,
    );

    expect(screen.getAllByRole('alert')).toHaveLength(3);
  });
});
