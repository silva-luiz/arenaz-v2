import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchBar } from './search-bar';

type PositionCallback = (position: {
  coords: { latitude: number; longitude: number };
}) => void;
type ErrorCallback = (error: { code: number }) => void;

function mockGeolocation(
  behaviour: (success: PositionCallback, failure: ErrorCallback) => void,
) {
  const getCurrentPosition = vi.fn<
    (
      success: PositionCallback,
      failure: ErrorCallback,
      options?: PositionOptions,
    ) => void
  >((success, failure) => {
    behaviour(success, failure);
  });
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
  return getCurrentPosition;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation');
});

describe('SearchBar', () => {
  it('is a GET form to /buscar that works without JavaScript', () => {
    render(<SearchBar />);

    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/buscar');
    expect(screen.getByRole('textbox', { name: 'Onde' })).toHaveAttribute(
      'name',
      'q',
    );
    expect(screen.getByRole('textbox', { name: 'Onde' })).toHaveAttribute(
      'placeholder',
      'Cidade ou bairro',
    );
    expect(screen.getByRole('combobox', { name: 'Esporte' })).toHaveAttribute(
      'name',
      'sport',
    );
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('lists "Qualquer esporte" and every sport label', () => {
    render(<SearchBar />);

    const options = screen
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options[0]).toBe('Qualquer esporte');
    expect(options).toContain('Society');
    expect(options).toContain('Beach tennis');
    expect(options).toHaveLength(9);
  });

  it('honours action, defaultQuery and defaultSport', () => {
    render(
      <SearchBar
        action="/outra"
        defaultQuery="Pinheiros"
        defaultSport="padel"
      />,
    );

    expect(screen.getByRole('search')).toHaveAttribute('action', '/outra');
    expect(screen.getByRole('textbox', { name: 'Onde' })).toHaveValue(
      'Pinheiros',
    );
    expect(screen.getByRole('combobox', { name: 'Esporte' })).toHaveValue(
      'padel',
    );
  });

  it('submits q and sport as GET fields', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    let submitted: Record<string, FormDataEntryValue | null> = {};
    const form = screen.getByRole<HTMLFormElement>('search');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      submitted = { q: data.get('q'), sport: data.get('sport') };
    });

    await user.type(screen.getByRole('textbox', { name: 'Onde' }), 'Pinheiros');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Esporte' }),
      'padel',
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(submitted).toEqual({ q: 'Pinheiros', sport: 'padel' });
  });

  describe('"Perto de mim"', () => {
    it('navigates with coordinates rounded to 3 decimals', async () => {
      const user = userEvent.setup();
      const getCurrentPosition = mockGeolocation((success) => {
        success({ coords: { latitude: -23.56149, longitude: -46.6559 } });
      });
      const onNavigate = vi.fn();
      render(<SearchBar onNavigate={onNavigate} />);

      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));

      expect(onNavigate).toHaveBeenCalledExactlyOnceWith(
        '/buscar?lat=-23.561&lng=-46.656',
      );
      expect(getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({ timeout: 10_000 }),
      );
    });

    it('keeps the selected sport and honours action', async () => {
      const user = userEvent.setup();
      mockGeolocation((success) => {
        success({ coords: { latitude: -23.5, longitude: -46.6 } });
      });
      const onNavigate = vi.fn();
      render(<SearchBar action="/outra" onNavigate={onNavigate} />);

      await user.selectOptions(
        screen.getByRole('combobox', { name: 'Esporte' }),
        'futsal',
      );
      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));

      expect(onNavigate).toHaveBeenCalledExactlyOnceWith(
        '/outra?lat=-23.500&lng=-46.600&sport=futsal',
      );
    });

    it('shows the error when the permission is denied', async () => {
      const user = userEvent.setup();
      mockGeolocation((_success, failure) => {
        failure({ code: 1 });
      });
      const onNavigate = vi.fn();
      render(<SearchBar onNavigate={onNavigate} />);

      expect(screen.getByRole('alert')).toBeEmptyDOMElement();
      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não conseguimos sua localização',
      );
      expect(onNavigate).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: 'Perto de mim' }),
      ).toBeEnabled();
    });

    it('shows the error when geolocation does not exist', async () => {
      const user = userEvent.setup();
      render(<SearchBar onNavigate={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não conseguimos sua localização',
      );
    });

    it('clears the error on the next attempt', async () => {
      const user = userEvent.setup();
      let attempt = 0;
      mockGeolocation((success, failure) => {
        attempt += 1;
        if (attempt === 1) failure({ code: 1 });
        else success({ coords: { latitude: 1, longitude: 2 } });
      });
      const onNavigate = vi.fn();
      render(<SearchBar onNavigate={onNavigate} />);

      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));
      expect(screen.getByRole('alert')).toHaveTextContent('Não conseguimos');

      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));
      expect(screen.getByRole('alert')).toBeEmptyDOMElement();
      expect(onNavigate).toHaveBeenCalledExactlyOnceWith(
        '/buscar?lat=1.000&lng=2.000',
      );
    });

    it('is a plain button that never submits the form', () => {
      render(<SearchBar />);
      expect(
        screen.getByRole('button', { name: 'Perto de mim' }),
      ).toHaveAttribute('type', 'button');
    });
  });
});
