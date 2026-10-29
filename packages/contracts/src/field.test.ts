import { describe, expect, it } from 'vitest';
import {
  blockInputSchema,
  blockSchema,
  fieldInputSchema,
  fieldSchema,
  fieldSummarySchema,
  fieldUpdateSchema,
  priceRuleInputSchema,
  priceRuleSchema,
  priceRulesInputSchema,
} from './field.js';

const ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

describe('priceRulesInputSchema', () => {
  it('rejeita faixas sobrepostas no mesmo dia', () => {
    const r = priceRulesInputSchema.safeParse([
      {
        weekdays: [1, 2],
        startMinute: 1080,
        endMinute: 1320,
        priceCentsPerHour: 20000,
      },
      {
        weekdays: [2],
        startMinute: 1260,
        endMinute: 1380,
        priceCentsPerHour: 25000,
      },
    ]);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain(
      'Faixas de preço se sobrepõem',
    );
    expect(r.error?.issues[0]?.path).toEqual([1]);
  });

  it('aceita faixas encostadas', () => {
    const r = priceRulesInputSchema.safeParse([
      {
        weekdays: [1, 2],
        startMinute: 1080,
        endMinute: 1260,
        priceCentsPerHour: 20000,
      },
      {
        weekdays: [1, 2],
        startMinute: 1260,
        endMinute: 1380,
        priceCentsPerHour: 25000,
      },
    ]);
    expect(r.success).toBe(true);
  });

  it('aceita faixas em dias diferentes com o mesmo horário', () => {
    const r = priceRulesInputSchema.safeParse([
      {
        weekdays: [1],
        startMinute: 1080,
        endMinute: 1320,
        priceCentsPerHour: 20000,
      },
      {
        weekdays: [2],
        startMinute: 1080,
        endMinute: 1320,
        priceCentsPerHour: 25000,
      },
    ]);
    expect(r.success).toBe(true);
  });

  it('rejeita minuto fora de múltiplo de 30', () => {
    const r = priceRulesInputSchema.safeParse([
      {
        weekdays: [1],
        startMinute: 1085,
        endMinute: 1320,
        priceCentsPerHour: 20000,
      },
    ]);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain(
      'Use horários em intervalos de 30 minutos',
    );
  });

  it('rejeita mais de 50 faixas', () => {
    const rules = Array.from({ length: 51 }, (_, i) => ({
      weekdays: [i % 7],
      startMinute: 0,
      endMinute: 30,
      priceCentsPerHour: 1000,
    }));
    expect(priceRulesInputSchema.safeParse(rules).success).toBe(false);
  });
});

describe('priceRuleInputSchema', () => {
  const base = {
    weekdays: [6, 0],
    startMinute: 600,
    endMinute: 720,
    priceCentsPerHour: 15000,
  };

  it('aceita faixa válida com rótulo opcional', () => {
    expect(priceRuleInputSchema.safeParse(base).success).toBe(true);
    expect(
      priceRuleInputSchema.safeParse({ ...base, label: 'Fim de semana' })
        .success,
    ).toBe(true);
  });

  it('rejeita início >= fim, dias repetidos/vazios e preço zero', () => {
    const bad = (patch: object) =>
      priceRuleInputSchema.safeParse({ ...base, ...patch }).success;
    expect(bad({ endMinute: 600 })).toBe(false);
    expect(bad({ weekdays: [1, 1] })).toBe(false);
    expect(bad({ weekdays: [] })).toBe(false);
    expect(bad({ weekdays: [7] })).toBe(false);
    expect(bad({ priceCentsPerHour: 0 })).toBe(false);
    expect(bad({ label: 'x'.repeat(41) })).toBe(false);
  });
});

describe('fieldInputSchema', () => {
  const base = {
    name: 'Quadra 1',
    sports: ['futebol_society'],
    surface: 'grama_sintetica',
    format: '7x7',
    minSlotMinutes: 60,
    basePriceCentsPerHour: 18000,
  };
  const bad = (patch: object) =>
    fieldInputSchema.safeParse({ ...base, ...patch }).success;

  it('aplica isActive=true por padrão', () => {
    const r = fieldInputSchema.parse(base);
    expect(r.isActive).toBe(true);
  });

  it('aceita formato nulo e dimensões opcionais', () => {
    expect(bad({ format: null, lengthM: 40, widthM: 20.5 })).toBe(true);
  });

  it('rejeita esportes vazios/repetidos, slot inválido e preço fora do limite', () => {
    expect(bad({ sports: [] })).toBe(false);
    expect(bad({ sports: ['padel', 'padel'] })).toBe(false);
    expect(bad({ minSlotMinutes: 45 })).toBe(false);
    expect(bad({ basePriceCentsPerHour: 0 })).toBe(false);
    expect(bad({ basePriceCentsPerHour: 1_000_001 })).toBe(false);
    expect(bad({ lengthM: 0 })).toBe(false);
    expect(bad({ widthM: 201 })).toBe(false);
    expect(bad({ name: 'A' })).toBe(false);
  });

  it('medidas: no mínimo 0,1 e com até 1 casa decimal', () => {
    const msg = 'Use metros com até 1 casa decimal (mínimo 0,1)';
    for (const value of [0.04, 40.55, 0.05]) {
      const r = fieldInputSchema.safeParse({ ...base, lengthM: value });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.message).toBe(msg);
    }
    expect(bad({ widthM: 0.04 })).toBe(false);
    expect(bad({ lengthM: 40.5 })).toBe(true);
    expect(bad({ lengthM: 0.1, widthM: 200 })).toBe(true);
    expect(fieldUpdateSchema.safeParse({ lengthM: 0.04 }).success).toBe(false);
    expect(fieldUpdateSchema.safeParse({ widthM: 40.55 }).success).toBe(false);
    expect(fieldUpdateSchema.safeParse({ lengthM: 40.5 }).success).toBe(true);
  });

  it('update aceita parcial', () => {
    expect(fieldUpdateSchema.safeParse({ name: 'Quadra 2' }).success).toBe(
      true,
    );
    expect(fieldUpdateSchema.safeParse({}).success).toBe(true);
    // a PATCH must not silently re-activate the field
    expect(fieldUpdateSchema.parse({})).toEqual({});
    expect(fieldUpdateSchema.safeParse({ name: 'A' }).success).toBe(false);
  });

  it('update aceita null em lengthM e widthM para limpar as medidas', () => {
    expect(fieldUpdateSchema.parse({ lengthM: null, widthM: null })).toEqual({
      lengthM: null,
      widthM: null,
    });
    expect(fieldUpdateSchema.safeParse({ lengthM: 0 }).success).toBe(false);
    expect(fieldUpdateSchema.safeParse({ widthM: 201 }).success).toBe(false);
  });

  it('create continua sem aceitar null nas medidas (ausente significa nulo)', () => {
    const base = {
      name: 'Quadra 1',
      sports: ['futsal'],
      surface: 'piso_rigido',
      format: null,
      minSlotMinutes: 60,
      basePriceCentsPerHour: 18000,
    };
    expect(fieldInputSchema.safeParse(base).success).toBe(true);
    expect(fieldInputSchema.safeParse({ ...base, lengthM: null }).success).toBe(
      false,
    );
  });
});

describe('blockInputSchema', () => {
  const base = {
    startsAt: '2026-11-01T10:00:00-03:00',
    endsAt: '2026-11-01T12:00:00-03:00',
  };
  const ok = (patch: object) =>
    blockInputSchema.safeParse({ ...base, ...patch }).success;

  it('aceita bloqueio válido com motivo opcional', () => {
    expect(ok({})).toBe(true);
    expect(ok({ reason: 'Manutenção' })).toBe(true);
  });

  it('exige offset, início antes do fim e duração <= 90 dias', () => {
    expect(ok({ startsAt: '2026-11-01T10:00:00' })).toBe(false);
    expect(ok({ endsAt: base.startsAt })).toBe(false);
    expect(ok({ endsAt: '2027-03-01T12:00:00-03:00' })).toBe(false);
    expect(ok({ reason: 'x'.repeat(121) })).toBe(false);
  });

  it('aceita exatamente 90 dias', () => {
    expect(
      blockInputSchema.safeParse({
        startsAt: '2026-11-01T00:00:00Z',
        endsAt: '2027-01-30T00:00:00Z',
      }).success,
    ).toBe(true);
  });
});

describe('response schemas', () => {
  const priceRule = {
    id: ID,
    weekdays: [1],
    startMinute: 1080,
    endMinute: 1320,
    priceCentsPerHour: 20000,
    label: null,
  };
  const block = {
    id: ID,
    startsAt: '2026-11-01T13:00:00.000Z',
    endsAt: '2026-11-01T15:00:00.000Z',
    reason: null,
  };
  const field = {
    id: ID,
    name: 'Quadra 1',
    sports: ['futsal'],
    surface: 'piso_rigido',
    format: null,
    lengthM: null,
    widthM: null,
    minSlotMinutes: 60,
    basePriceCentsPerHour: 18000,
    isActive: true,
  };

  it('aceita faixa e bloqueio', () => {
    expect(priceRuleSchema.safeParse(priceRule).success).toBe(true);
    expect(blockSchema.safeParse(block).success).toBe(true);
  });

  it('fieldSchema inclui priceRules e blocks', () => {
    const r = fieldSchema.parse({
      ...field,
      venueId: '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10',
      priceRules: [priceRule],
      blocks: [block],
    });
    expect(r.venueId).toBe('3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10');
    expect(r.priceRules).toHaveLength(1);
    expect(r.blocks).toHaveLength(1);
    expect(fieldSchema.safeParse(field).success).toBe(false);
  });

  it('medidas já gravadas nunca quebram a leitura (inclusive 0.0)', () => {
    const stored = { ...field, lengthM: 0, widthM: 0.04, priceRulesCount: 0 };
    expect(fieldSummarySchema.safeParse(stored).success).toBe(true);
    expect(
      fieldSchema.safeParse({
        ...stored,
        venueId: ID,
        priceRules: [],
        blocks: [],
      }).success,
    ).toBe(true);
    expect(
      fieldSummarySchema.safeParse({ ...stored, lengthM: -1 }).success,
    ).toBe(false);
  });

  it('fieldSummarySchema traz priceRulesCount e não traz blocks', () => {
    const r = fieldSummarySchema.parse({ ...field, priceRulesCount: 2 });
    expect(r.priceRulesCount).toBe(2);
    expect('blocks' in r).toBe(false);
    expect('priceRules' in r).toBe(false);
  });
});
