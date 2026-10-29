import { z } from 'zod';

export const PHOTO_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_MAX_PER_VENUE = 20;

export const photoUploadRequestSchema = z.object({
  contentType: z.enum(PHOTO_CONTENT_TYPES, {
    error: 'Use uma imagem JPEG, PNG ou WebP',
  }),
  size: z
    .number({ error: 'Tamanho inválido' })
    .int('Tamanho inválido')
    .min(1, 'O arquivo está vazio')
    .max(PHOTO_MAX_BYTES, 'A foto pode ter no máximo 10 MB'),
});

/** Presigned POST: the browser uploads straight to object storage. */
export const photoUploadResponseSchema = z.object({
  url: z.string(),
  fields: z.record(z.string(), z.string()),
  key: z.string(),
  expiresAt: z.iso.datetime({ offset: true }),
});

export const photoConfirmSchema = z.object({
  key: z.string().min(1, 'Chave da foto inválida'),
});

export const photoOrderSchema = z.object({
  photoIds: z.array(z.uuid()),
});

export const photoSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  position: z.number().int().nonnegative(),
});

export type PhotoUploadRequest = z.infer<typeof photoUploadRequestSchema>;
export type PhotoUploadResponse = z.infer<typeof photoUploadResponseSchema>;
export type PhotoConfirm = z.infer<typeof photoConfirmSchema>;
export type PhotoOrder = z.infer<typeof photoOrderSchema>;
export type Photo = z.infer<typeof photoSchema>;
