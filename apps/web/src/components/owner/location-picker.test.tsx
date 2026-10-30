import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Leaflet needs a real browser; the numeric fields are what is tested here.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStub() {
      return <div data-testid="map" />;
    },
}));

import { LocationPicker, type LatLngValue } from './location-picker';

describe('LocationPicker', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always offers labelled latitude and longitude fields', () => {
    render(<LocationPicker value={null} onChange={onChange} />);

    expect(screen.getByLabelText('Latitude')).toHaveValue('');
    expect(screen.getByLabelText('Longitude')).toHaveValue('');
  });

  it('shows the current value in the fields', () => {
    render(
      <LocationPicker
        value={{ lat: -23.5568, lng: -46.6916 }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText('Latitude')).toHaveValue('-23.5568');
    expect(screen.getByLabelText('Longitude')).toHaveValue('-46.6916');
  });

  it('emits the value once both coordinates are numbers', async () => {
    const user = userEvent.setup();
    render(<LocationPicker value={null} onChange={onChange} />);

    await user.type(screen.getByLabelText('Latitude'), '-23,5');
    expect(onChange).toHaveBeenLastCalledWith(null);

    await user.type(screen.getByLabelText('Longitude'), '-46.6');
    expect(onChange).toHaveBeenLastCalledWith({ lat: -23.5, lng: -46.6 });
  });

  it('emits null when a coordinate is cleared or is not a number', async () => {
    const user = userEvent.setup();
    render(
      <LocationPicker value={{ lat: -23.5, lng: -46.6 }} onChange={onChange} />,
    );

    await user.type(screen.getByLabelText('Latitude'), 'x');

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('follows an external change of the value (for example the CEP lookup)', async () => {
    function Harness() {
      const [value, setValue] = useState<LatLngValue | null>(null);
      return (
        <>
          <LocationPicker value={value} onChange={setValue} />
          <button
            type="button"
            onClick={() => {
              setValue({ lat: -23.5614, lng: -46.6559 });
            }}
          >
            Preencher
          </button>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Preencher' }));

    expect(screen.getByLabelText('Latitude')).toHaveValue('-23.5614');
    expect(screen.getByLabelText('Longitude')).toHaveValue('-46.6559');
  });

  it('keeps what the user typed while it is not yet a valid pair', async () => {
    function Harness() {
      const [value, setValue] = useState<LatLngValue | null>({
        lat: -23.5,
        lng: -46.6,
      });
      return <LocationPicker value={value} onChange={setValue} />;
    }
    const user = userEvent.setup();
    render(<Harness />);

    const lat = screen.getByLabelText('Latitude');
    await user.clear(lat);
    await user.type(lat, '-2');

    expect(lat).toHaveValue('-2');
    expect(screen.getByLabelText('Longitude')).toHaveValue('-46.6');
  });

  it('shows the errors it receives and marks the fields invalid', () => {
    render(
      <LocationPicker
        value={null}
        onChange={onChange}
        errors={{ lat: 'Informe a localização do espaço' }}
      />,
    );

    expect(screen.getByText('Informe a localização do espaço')).toBeVisible();
    expect(screen.getByLabelText('Latitude')).toBeInvalid();
    expect(screen.getByLabelText('Longitude')).toBeValid();
  });

  it('renders the map as a labelled complement of the fields', () => {
    render(<LocationPicker value={null} onChange={onChange} />);

    expect(screen.getByTestId('map')).toBeInTheDocument();
    expect(
      screen.getByRole('group', {
        name: /alternativa acessível são os campos acima/i,
      }),
    ).toBeInTheDocument();
  });
});
