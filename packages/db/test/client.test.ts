import { describe, expect, it, vi } from 'vitest';
import { createDb } from '../src/client.js';

describe('createDb', () => {
  it('trata erros de conexões ociosas sem derrubar o processo', async () => {
    const onError = vi.fn();
    const { pool } = createDb('postgres://u:p@127.0.0.1:1/x', { onError });
    const error = new Error('terminating connection');

    expect(pool.listenerCount('error')).toBeGreaterThan(0);
    expect(() => pool.emit('error', error)).not.toThrow();
    expect(onError).toHaveBeenCalledWith(error);

    await pool.end();
  });

  it('registra um listener padrão quando onError não é informado', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { pool } = createDb('postgres://u:p@127.0.0.1:1/x');

    expect(() => pool.emit('error', new Error('boom'))).not.toThrow();
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
    await pool.end();
  });
});
