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

  it('instala postgis, btree_gist, unaccent e pg_trgm', async () => {
    const { rows } = await pool.query<{ extname: string }>(
      'select extname from pg_extension',
    );
    expect(rows.map((r) => r.extname)).toEqual(
      expect.arrayContaining(['postgis', 'btree_gist', 'unaccent', 'pg_trgm']),
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

  it('f_unaccent tira acentos, é IMMUTABLE e indexável', async () => {
    const { rows } = await pool.query<{ plain: string; volatility: string }>(
      `select f_unaccent(lower('SÃO José Çá')) as plain,
              (select provolatile::text from pg_proc where proname = 'f_unaccent') as volatility`,
    );
    expect(rows[0]).toEqual({ plain: 'sao jose ca', volatility: 'i' });

    const { rows: indexes } = await pool.query<{ indexname: string }>(
      "select indexname from pg_indexes where tablename = 'venue' and indexname like 'venue_%_search_idx'",
    );
    expect(indexes.map((i) => i.indexname).sort()).toEqual([
      'venue_city_search_idx',
      'venue_neighborhood_search_idx',
    ]);
  });

  it('a busca por trecho usa o índice trigram', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      // Tiny tables prefer a seq scan; this only proves the index CAN serve it.
      await client.query('set local enable_seqscan = off');
      const { rows } = await client.query<{ 'QUERY PLAN': string }>(
        `explain select 1 from venue
          where f_unaccent(lower(city)) like f_unaccent(lower('%Paulo%')) escape '\\'`,
      );
      expect(rows.map((r) => r['QUERY PLAN']).join(' ')).toContain(
        'venue_city_search_idx',
      );
    } finally {
      await client.query('rollback');
      client.release();
    }
  });
});
