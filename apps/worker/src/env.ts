import { z } from 'zod';

/** A non-empty URL whose scheme is one of `protocols` (e.g. `['redis:']`). */
function urlWithProtocol(protocols: readonly string[], example: string) {
  return z
    .string()
    .min(1, 'não pode ser vazia')
    .refine((value) => {
      try {
        return protocols.includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }, `precisa ser uma URL válida, como ${example}`);
}

const envSchema = z.object({
  DATABASE_URL: urlWithProtocol(
    ['postgres:', 'postgresql:'],
    'postgres://usuario:senha@localhost:5432/banco',
  ),
  REDIS_URL: urlWithProtocol(['redis:', 'rediss:'], 'redis://localhost:6379'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type Env = z.infer<typeof envSchema>;

const REASONS: Record<string, string> = {
  invalid_type: 'ausente ou com tipo inválido',
  invalid_format: 'formato inválido',
  invalid_value: 'valor não permitido',
};

/** Validates the process environment; the message names every bad variable. */
export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => {
    const name = issue.path.map(String).join('.');
    const reason = REASONS[issue.code] ?? issue.message;
    return `  - ${name}: ${reason}`;
  });
  throw new Error(`Variáveis de ambiente inválidas:\n${lines.join('\n')}`);
}
