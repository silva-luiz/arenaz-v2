import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('is a plain, enabled button by default', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Salvar</Button>);

    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('type', 'button');
    expect(button).not.toHaveAttribute('aria-busy');

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and busy while loading, keeping the label', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button loading onClick={onClick}>
        Salvar
      </Button>,
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveTextContent('Salvar');
    expect(button).toHaveAccessibleName('Salvar, Aguarde…');
    expect(screen.getByText(/Aguarde…/)).toHaveClass('sr-only');

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('stays disabled when disabled is set without loading', () => {
    render(<Button disabled>Salvar</Button>);

    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.queryByText(/Aguarde…/)).not.toBeInTheDocument();
  });

  it('submits the surrounding form when type is submit', async () => {
    const onSubmit = vi.fn((event: React.SyntheticEvent) => {
      event.preventDefault();
    });
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Enviar</Button>
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit the surrounding form by default', async () => {
    const onSubmit = vi.fn((event: React.SyntheticEvent) => {
      event.preventDefault();
    });
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Button>Cancelar</Button>
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('can submit forms and accepts a custom className', () => {
    render(
      <Button type="submit" variant="danger" size="sm" className="extra">
        Excluir
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Excluir' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveClass('extra');
  });
});
