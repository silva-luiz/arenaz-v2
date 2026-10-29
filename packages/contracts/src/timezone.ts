import { z } from 'zod';

/**
 * IANA zones used in Brazil. A venue's wall-clock times (opening hours, price
 * rules, bookings) are read in its own zone. The database CHECK on
 * `venue.timezone` lists the same values (a db test keeps them in sync).
 */
export const BRAZIL_TIMEZONES = [
  'America/Sao_Paulo',
  'America/Bahia',
  'America/Fortaleza',
  'America/Recife',
  'America/Maceio',
  'America/Belem',
  'America/Araguaina',
  'America/Manaus',
  'America/Boa_Vista',
  'America/Porto_Velho',
  'America/Cuiaba',
  'America/Campo_Grande',
  'America/Rio_Branco',
  'America/Noronha',
  'America/Santarem',
  'America/Eirunepe',
] as const;
export type BrazilTimezone = (typeof BRAZIL_TIMEZONES)[number];

export const DEFAULT_TIMEZONE: BrazilTimezone = 'America/Sao_Paulo';

export const TIMEZONE_LABELS: Record<BrazilTimezone, string> = {
  'America/Sao_Paulo': 'Horário de Brasília',
  'America/Bahia': 'Bahia (UTC−3)',
  'America/Fortaleza':
    'Ceará, Maranhão, Piauí, Rio Grande do Norte e Paraíba (UTC−3)',
  'America/Recife': 'Pernambuco (UTC−3)',
  'America/Maceio': 'Alagoas e Sergipe (UTC−3)',
  'America/Belem': 'Pará e Amapá (UTC−3)',
  'America/Araguaina': 'Tocantins (UTC−3)',
  'America/Santarem': 'Oeste do Pará (UTC−3)',
  'America/Manaus': 'Amazonas (UTC−4)',
  'America/Boa_Vista': 'Roraima (UTC−4)',
  'America/Porto_Velho': 'Rondônia (UTC−4)',
  'America/Cuiaba': 'Mato Grosso (UTC−4)',
  'America/Campo_Grande': 'Mato Grosso do Sul (UTC−4)',
  'America/Rio_Branco': 'Acre (UTC−5)',
  'America/Eirunepe': 'Sudoeste do Amazonas (UTC−5)',
  'America/Noronha': 'Fernando de Noronha (UTC−2)',
};

export const timezoneSchema = z.enum(BRAZIL_TIMEZONES, {
  error: 'Fuso horário inválido',
});

const BY_UF: Record<string, BrazilTimezone> = {
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

/** The usual zone of a state; every state not listed is on Brasília time. */
export function defaultTimezoneForUf(uf: string): BrazilTimezone {
  return BY_UF[uf] ?? DEFAULT_TIMEZONE;
}
