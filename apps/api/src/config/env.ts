import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'não pode ser vazia'),
  REDIS_URL: z.string().min(1, 'não pode ser vazia'),
  BETTER_AUTH_SECRET: z.string().min(32, 'precisa ter ao menos 32 caracteres'),
  BETTER_AUTH_URL: z.url(),
  API_PORT: z.coerce
    .number()
    .int('porta inválida')
    .min(1, 'porta inválida')
    .max(65535, 'porta inválida')
    .default(4000),
  WEB_ORIGIN: z.url(),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
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
