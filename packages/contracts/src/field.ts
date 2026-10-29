import { z } from 'zod';
import { FIELD_FORMATS, SPORTS, SURFACES } from './catalog.js';
import { centsSchema } from './common.js';
import { minuteOfDaySchema } from './geo.js';

export const PRICE_OVERLAP_MESSAGE = 'Faixas de preço se sobrepõem';
export const MAX_PRICE_RULES = 50;
export const MAX_BASE_PRICE_CENTS = 1_000_000;
export const MAX_BLOCK_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const weekdaySchema = z
  .number({ error: 'Dia da semana inválido' })
  .int({ error: 'Dia da semana inválido' })
  .min(0, { error: 'Dia da semana inválido' })
  .max(6, { error: 'Dia da semana inválido' });

const priceCentsSchema = centsSchema.refine((cents) => cents > 0, {
  error: 'O preço precisa ser maior que zero',
});

const MEASURE_MESSAGE = 'Use metros com até 1 casa decimal (mínimo 0,1)';

// The column is numeric(5,1): anything finer than 0.1 would be rounded on
// write (0.04 -> 0.0), so it is refused up front.
const dimensionSchema = z
  .number({ error: 'Medida inválida' })
  .min(0.1, { error: MEASURE_MESSAGE, abort: true })
  .max(200, { error: 'A medida pode ter no máximo 200 metros' })
  .multipleOf(0.1, { error: MEASURE_MESSAGE });

// What is already stored must always parse on the way out, whatever it is.
const storedDimensionSchema = z.number().nonnegative().nullable();

// ---------------------------------------------------------------- fields ----

// Built without the `isActive` default so that `fieldUpdateSchema` (a partial)
// never injects `isActive: true` into a PATCH body.
const fieldBaseShape = {
  name: z
    .string({ error: 'Informe o nome da quadra' })
    .trim()
    .min(2, 'O nome precisa ter pelo menos 2 caracteres')
    .max(60, 'O nome pode ter no máximo 60 caracteres'),
  sports: z
    .array(z.enum(SPORTS, { error: 'Esporte inválido' }))
    .min(1, 'Selecione pelo menos um esporte')
    .refine((sports) => new Set(sports).size === sports.length, {
      error: 'Esportes repetidos',
    }),
  surface: z.enum(SURFACES, { error: 'Selecione o piso' }),
  format: z.enum(FIELD_FORMATS, { error: 'Formato inválido' }).nullable(),
  lengthM: dimensionSchema.optional(),
  widthM: dimensionSchema.optional(),
  minSlotMinutes: z.union([z.literal(30), z.literal(60), z.literal(90)], {
    error: 'Use 30, 60 ou 90 minutos',
  }),
  basePriceCentsPerHour: priceCentsSchema.max(MAX_BASE_PRICE_CENTS, {
    error: 'O preço por hora pode ser no máximo R$ 10.000,00',
  }),
};

export const fieldInputSchema = z.object({
  ...fieldBaseShape,
  isActive: z.boolean().default(true),
});

// On update the measures are nullable: `null` clears them (absent leaves them
// as they are), which `create` does not need because absent already means null.
export const fieldUpdateSchema = z
  .object({
    ...fieldBaseShape,
    lengthM: dimensionSchema.nullable(),
    widthM: dimensionSchema.nullable(),
    isActive: z.boolean(),
  })
  .partial();

// ----------------------------------------------------------- price rules ----

const priceRuleShape = {
  weekdays: z
    .array(weekdaySchema)
    .min(1, 'Selecione pelo menos um dia')
    .refine((days) => new Set(days).size === days.length, {
      error: 'Dias repetidos',
    }),
  startMinute: minuteOfDaySchema,
  endMinute: minuteOfDaySchema,
  priceCentsPerHour: priceCentsSchema,
};

const PRICE_RULE_RANGE_MESSAGE = 'O fim precisa ser depois do início';

export const priceRuleInputSchema = z
  .object({
    ...priceRuleShape,
    label: z
      .string()
      .trim()
      .max(40, 'O rótulo pode ter no máximo 40 caracteres')
      .optional(),
  })
  .refine((rule) => rule.startMinute < rule.endMinute, {
    error: PRICE_RULE_RANGE_MESSAGE,
    path: ['endMinute'],
  });

/**
 * Up to 50 rules; two rules on the same weekday may not intersect (touching
 * edges is fine). The issue is attached to the LATER rule of the pair so the
 * UI can flag that row.
 */
export const priceRulesInputSchema = z
  .array(priceRuleInputSchema)
  .max(MAX_PRICE_RULES, `No máximo ${String(MAX_PRICE_RULES)} faixas de preço`)
  .superRefine((rules, ctx) => {
    rules.forEach((later, laterIndex) => {
      const overlaps = rules
        .slice(0, laterIndex)
        .some(
          (earlier) =>
            earlier.weekdays.some((day) => later.weekdays.includes(day)) &&
            earlier.startMinute < later.endMinute &&
            later.startMinute < earlier.endMinute,
        );
      if (overlaps) {
        ctx.addIssue({
          code: 'custom',
          message: PRICE_OVERLAP_MESSAGE,
          path: [laterIndex],
        });
      }
    });
  });

export const priceRuleSchema = z.object({
  id: z.uuid(),
  ...priceRuleShape,
  label: z.string().nullable(),
});

// ---------------------------------------------------------------- blocks ----

const isoWithOffset = z.iso.datetime({
  offset: true,
  error: 'Data e hora inválidas',
});

export const blockInputSchema = z
  .object({
    startsAt: isoWithOffset,
    endsAt: isoWithOffset,
    reason: z
      .string()
      .trim()
      .max(120, 'O motivo pode ter no máximo 120 caracteres')
      .optional(),
  })
  .superRefine((block, ctx) => {
    const start = Date.parse(block.startsAt);
    const end = Date.parse(block.endsAt);
    if (end <= start) {
      ctx.addIssue({
        code: 'custom',
        message: 'O fim precisa ser depois do início',
        path: ['endsAt'],
      });
    } else if (end - start > MAX_BLOCK_DAYS * MS_PER_DAY) {
      ctx.addIssue({
        code: 'custom',
        message: `O bloqueio pode durar no máximo ${String(MAX_BLOCK_DAYS)} dias`,
        path: ['endsAt'],
      });
    }
  });

export const blockSchema = z.object({
  id: z.uuid(),
  startsAt: isoWithOffset,
  endsAt: isoWithOffset,
  reason: z.string().nullable(),
});

// -------------------------------------------------------------- responses ---

const fieldResponseShape = {
  id: z.uuid(),
  name: fieldBaseShape.name,
  sports: fieldBaseShape.sports,
  surface: fieldBaseShape.surface,
  format: fieldBaseShape.format,
  lengthM: storedDimensionSchema,
  widthM: storedDimensionSchema,
  minSlotMinutes: fieldBaseShape.minSlotMinutes,
  basePriceCentsPerHour: fieldBaseShape.basePriceCentsPerHour,
  isActive: z.boolean(),
};

/** Field as listed inside a venue: no rules or blocks, just a rule count. */
export const fieldSummarySchema = z.object({
  ...fieldResponseShape,
  priceRulesCount: z.number().int().nonnegative(),
});

/** Full field; `venueId` lets the panel link back to the venue. */
export const fieldSchema = z.object({
  ...fieldResponseShape,
  venueId: z.uuid(),
  priceRules: z.array(priceRuleSchema),
  blocks: z.array(blockSchema),
});

export type FieldInput = z.infer<typeof fieldInputSchema>;
export type FieldUpdate = z.infer<typeof fieldUpdateSchema>;
export type FieldSummary = z.infer<typeof fieldSummarySchema>;
export type FieldResponse = z.infer<typeof fieldSchema>;
export type PriceRuleInput = z.infer<typeof priceRuleInputSchema>;
export type PriceRule = z.infer<typeof priceRuleSchema>;
export type BlockInput = z.infer<typeof blockInputSchema>;
export type Block = z.infer<typeof blockSchema>;
