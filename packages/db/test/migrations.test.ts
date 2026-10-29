import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDb } from '../src/client.js';

describe('migrations', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    ({ pool } = createDb(inject('DATABASE_URL')));
  });

  afterAll(async () => {
    await pool.end();
  });

  it('instala postgis e btree_gist', async () => {
    const { rows } = await pool.query<{ extname: string }>(
      'select extname from pg_extension',
    );
    expect(rows.map((r) => r.extname)).toEqual(
      expect.arrayContaining(['postgis', 'btree_gist']),
    );
  });

  it('cria tabelas de auth', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public'",
    );
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining(['user', 'session', 'account', 'verification']),
    );
  });

  it('e-mail de usuário é único', async () => {
    const insert = (id: string): Promise<unknown> =>
      pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [
        id,
        'Joao',
        'joao@mail.com',
      ]);

    await insert('user-1');
    await expect(insert('user-2')).rejects.toMatchObject({ code: '23505' });
  });
});
