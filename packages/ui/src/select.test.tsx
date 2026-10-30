import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Select } from './select';

const OPTIONS = [
  { value: 'society', label: 'Society' },
  { value: 'futsal', label: 'Futsal' },
];

describe('Select', () => {
  it('renders a disabled, pre-selected placeholder', () => {
    render(
      <Select
        aria-label="Esporte"
        options={OPTIONS}
        placeholder="Escolha o esporte"
      />,
    );

    const placeholder = screen.getByRole('option', {
      name: 'Escolha o esporte',
    });
    expect(placeholder).toBeDisabled();
    expect(placeholder).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Esporte' })).toHaveValue('');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('renders only the options when there is no placeholder', () => {
    render(<Select aria-label="Esporte" options={OPTIONS} />);

    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('combobox')).toHaveValue('society');
  });

  it('lets the user pick an option', async () => {
    const user = userEvent.setup();
    render(
      <Select aria-label="Esporte" options={OPTIONS} placeholder="Escolha" />,
    );

    await user.selectOptions(screen.getByRole('combobox'), 'futsal');

    expect(screen.getByRole('combobox')).toHaveValue('futsal');
  });
});
