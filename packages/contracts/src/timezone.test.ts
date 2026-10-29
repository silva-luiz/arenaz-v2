import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { UF } from './catalog.js';
import {
  BRAZIL_TIMEZONES,
  TIMEZONE_LABELS,
  defaultTimezoneForUf,
  timezoneSchema,
} from './timezone.js';

describe('timezone', () => {
  it('lista os 16 fusos brasileiros, cada um com rótulo pt-BR', () => {
    expect(BRAZIL_TIMEZONES).toHaveLength(16);
    expect(new Set(BRAZIL_TIMEZONES).size).toBe(16);
    for (const zone of BRAZIL_TIMEZONES) {
      expect(TIMEZONE_LABELS[zone].length).toBeGreaterThan(3);
    }
    expect(TIMEZONE_LABELS['America/Sao_Paulo']).toBe('Horário de Brasília');
    expect(TIMEZONE_LABELS['America/Manaus']).toBe('Amazonas (UTC−4)');
  });

  it('o rótulo de cada fuso cita todos os estados que o mapa manda para ele', () => {
    const fortaleza = TIMEZONE_LABELS['America/Fortaleza'];
    for (const name of [
      'Ceará',
      'Maranhão',
      'Piauí',
      'Rio Grande do Norte',
      'Paraíba',
    ]) {
      expect(fortaleza).toContain(name);
    }
  });

  it('todos os fusos são reconhecidos pelo Intl', () => {
    for (const zone of BRAZIL_TIMEZONES) {
      expect(
        () => new Intl.DateTimeFormat('pt-BR', { timeZone: zone }),
      ).not.toThrow();
    }
  });

  it('defaultTimezoneForUf segue o mapa do brief', () => {
    const expected: Record<string, string> = {
      AC: 'America/Rio_Branco',
      AM: 'America/Manaus',
      RR: 'America/Boa_Vista',
      RO: 'America/Porto_Velho',
      MT: 'America/Cuiaba',
      MS: 'America/Campo_Grande',
      PA: 'America/Belem',
      AP: 'America/Belem',
      TO: 'America/Araguaina',
      MA: 'America/Fortaleza',
      PI: 'America/Fortaleza',
      CE: 'America/Fortaleza',
      RN: 'America/Fortaleza',
      PB: 'America/Fortaleza',
      PE: 'America/Recife',
      AL: 'America/Maceio',
      SE: 'America/Maceio',
      BA: 'America/Bahia',
    };
    expect(defaultTimezoneForUf('AM')).toBe('America/Manaus');
    for (const uf of UF) {
      expect(defaultTimezoneForUf(uf)).toBe(
        expected[uf] ?? 'America/Sao_Paulo',
      );
    }
    expect(defaultTimezoneForUf('XX')).toBe('America/Sao_Paulo');
  });

  it('timezoneSchema aceita só a lista', () => {
    expect(timezoneSchema.safeParse('America/Manaus').success).toBe(true);
    const bad = timezoneSchema.safeParse('Europe/Lisbon');
    expect(bad.success).toBe(false);
    expect(JSON.stringify(bad.error?.issues)).toContain(
      'Fuso horário inválido',
    );
  });
});

describe('timezone x migração 0006', () => {
  const dir = fileURLToPath(new URL('../../db/migrations', import.meta.url));
  const file = readdirSync(dir).find((name) => /^0006_.*\.sql$/.test(name));
  const sql = file ? readFileSync(join(dir, file), 'utf8') : '';

  it('o CHECK do banco lista exatamente BRAZIL_TIMEZONES', () => {
    const check =
      /CONSTRAINT "venue_timezone_check" CHECK \(([^;]*?)\)(?:;|,|\n)/s.exec(
        sql,
      );
    expect(check).not.toBeNull();
    const listed = [...(check?.[1] ?? '').matchAll(/'([A-Za-z_/]+)'/g)].map(
      (match) => match[1],
    );
    expect([...listed].sort()).toEqual([...BRAZIL_TIMEZONES].sort());
  });

  it('o CASE do backfill espelha defaultTimezoneForUf para todas as UFs', () => {
    const fromSql: Record<string, string> = {};
    for (const match of sql.matchAll(
      /WHEN "state" IN \(([^)]*)\) THEN '([^']+)'/g,
    )) {
      for (const uf of (match[1] ?? '').matchAll(/'([A-Z]{2})'/g)) {
        fromSql[uf[1] ?? ''] = match[2] ?? '';
      }
    }
    const fallback = /ELSE '([^']+)'/.exec(sql)?.[1];
    for (const uf of UF) {
      expect(fromSql[uf] ?? fallback).toBe(defaultTimezoneForUf(uf));
    }
  });
});
