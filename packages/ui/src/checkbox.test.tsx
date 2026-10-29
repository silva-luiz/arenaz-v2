import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('is named by its label and toggles when the label is clicked', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Quadra coberta" />);

    const box = screen.getByRole('checkbox', { name: 'Quadra coberta' });
    expect(box).not.toBeChecked();

    await user.click(screen.getByText('Quadra coberta'));
    expect(box).toBeChecked();
  });
});
