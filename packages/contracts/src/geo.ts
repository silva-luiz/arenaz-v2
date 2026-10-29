import { z } from 'zod';
import { UF } from './catalog.js';

export const CEP_MESSAGE = 'CEP inválido';
export const MINUTE_STEP_MESSAGE = 'Use horários em intervalos de 30 minutos';
export const LOCATION_MESSAGE = 'Localização fora do Brasil';

/** Strips non-digits and requires exactly 8: "01310-100" → "01310100". */
export const cepSchema = z
  .string({ error: CEP_MESSAGE })
  .transform((raw) => raw.replace(/\D/g, ''))
  .refine((digits) => digits.length === 8, { error: CEP_MESSAGE });

/** Minutes since midnight, 0–1440, in 30-minute steps. */
export const minuteOfDaySchema = z
  .number({ error: MINUTE_STEP_MESSAGE })
  .int({ error: MINUTE_STEP_MESSAGE })
  .min(0, { error: MINUTE_STEP_MESSAGE })
  .max(1440, { error: MINUTE_STEP_MESSAGE })
  .refine((minute) => minute % 30 === 0, { error: MINUTE_STEP_MESSAGE });

/** Bounding box of Brazil. */
export const locationSchema = z.object({
  lat: z
    .number({ error: LOCATION_MESSAGE })
    .min(-34, { error: LOCATION_MESSAGE })
    .max(6, { error: LOCATION_MESSAGE }),
  lng: z
    .number({ error: LOCATION_MESSAGE })
    .min(-74, { error: LOCATION_MESSAGE })
    .max(-28, { error: LOCATION_MESSAGE }),
});
export type LatLng = z.infer<typeof locationSchema>;

const ufSchema = z.enum(UF, { error: 'Selecione o estado' });

const addressShape = {
  cep: cepSchema,
  street: z
    .string({ error: 'Informe a rua' })
    .trim()
    .min(1, 'Informe a rua')
    .max(120, 'A rua pode ter no máximo 120 caracteres'),
  number: z
    .string({ error: 'Informe o número' })
    .trim()
    .min(1, 'Informe o número')
    .max(20, 'O número pode ter no máximo 20 caracteres'),
  neighborhood: z
    .string({ error: 'Informe o bairro' })
    .trim()
    .min(1, 'Informe o bairro')
    .max(80, 'O bairro pode ter no máximo 80 caracteres'),
  city: z
    .string({ error: 'Informe a cidade' })
    .trim()
    .min(1, 'Informe a cidade')
    .max(80, 'A cidade pode ter no máximo 80 caracteres'),
  state: ufSchema,
};

const complementSchema = z
  .string()
  .trim()
  .max(60, 'O complemento pode ter no máximo 60 caracteres');

export const addressSchema = z.object({
  ...addressShape,
  complement: complementSchema.optional(),
});

/** Same shape as the input, but the complement is explicit (`null` if unset). */
export const addressResponseSchema = z.object({
  ...addressShape,
  complement: complementSchema.nullable(),
});

export const cepLookupResponseSchema = z.object({
  cep: cepSchema,
  street: z.string(),
  neighborhood: z.string(),
  city: z.string(),
  state: ufSchema,
  location: locationSchema.nullable(),
});

export type AddressInput = z.infer<typeof addressSchema>;
export type Address = z.infer<typeof addressResponseSchema>;
export type CepLookupResponse = z.infer<typeof cepLookupResponseSchema>;
