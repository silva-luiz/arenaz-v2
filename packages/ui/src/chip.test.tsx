import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from './chip';

function Toggle() {
  const [on, setOn] = useState(false);
  return (
    <Chip
      pressed={on}
      onClick={() => {
        setOn((value) => !value);
      }}
    >
      Society
    </Chip>
  );
}

describe('Chip', () => {
  it('toggles aria-pressed as a button', async () => {
    const user = userEvent.setup();
    render(<Toggle />);

    const chip = screen.getByRole('button', { name: 'Society' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('is not a toggle without pressed', () => {
    render(<Chip onClick={vi.fn()}>Todos</Chip>);
    expect(screen.getByRole('button', { name: 'Todos' })).not.toHaveAttribute(
      'aria-pressed',
    );
  });

  it('renders a link with href and marks the selected one', () => {
    render(
      <Chip href="/buscar?sport=padel" pressed>
        Padel
      </Chip>,
    );
    const link = screen.getByRole('link', { name: 'Padel' });
    expect(link).toHaveAttribute('href', '/buscar?sport=padel');
    expect(link).toHaveAttribute('aria-current', 'true');
  });

  it('renders through a custom link component', () => {
    function Custom({ href, children, ...rest }: React.ComponentProps<'a'>) {
      return (
        <a href={href} data-custom="yes" {...rest}>
          {children}
        </a>
      );
    }
    render(
      <Chip href="/x" linkComponent={Custom}>
        X
      </Chip>,
    );
    expect(screen.getByRole('link', { name: 'X' })).toHaveAttribute(
      'data-custom',
      'yes',
    );
  });
});
