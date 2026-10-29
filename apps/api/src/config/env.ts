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

/** "true" or "false" (nothing else), parsed to a boolean. */
function booleanString() {
  return z
    .enum(['true', 'false'], 'precisa ser "true" ou "false"')
    .transform((value) => value === 'true');
}

const envSchema = z
  .object({
    DATABASE_URL: urlWithProtocol(
      ['postgres:', 'postgresql:'],
      'postgres://usuario:senha@localhost:5432/banco',
    ),
    REDIS_URL: urlWithProtocol(['redis:', 'rediss:'], 'redis://localhost:6379'),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, 'precisa ter ao menos 32 caracteres'),
    BETTER_AUTH_URL: z.url(),
    API_PORT: z.coerce
      .number()
      .int('porta inválida')
      .min(1, 'porta inválida')
      .max(65535, 'porta inválida')
      .default(4000),
    WEB_ORIGIN: z.url(),
    S3_ENDPOINT: urlWithProtocol(['http:', 'https:'], 'http://localhost:9000'),
    S3_REGION: z.string().min(1, 'não pode ser vazia').default('us-east-1'),
    S3_BUCKET: z.string().min(1, 'não pode ser vazia'),
    S3_ACCESS_KEY_ID: z.string().min(1, 'não pode ser vazia'),
    S3_SECRET_ACCESS_KEY: z.string().min(1, 'não pode ser vazia'),
    /** Public base URL of the bucket, e.g. http://localhost:9000/arenaz-photos. */
    S3_PUBLIC_URL: urlWithProtocol(
      ['http:', 'https:'],
      'http://localhost:9000/arenaz-photos',
    ),
    S3_FORCE_PATH_STYLE: booleanString().default(true),
    /** `fake` is a fixed table for tests and e2e; never allowed in production. */
    GEO_PROVIDER: z.enum(['http', 'fake']).default('http'),
    /**
     * Shared secret of server-to-server callers (the web's SSR). A request with
     * the same `x-internal-token` skips the rate limits. Absent or empty = off.
     */
    INTERNAL_API_TOKEN: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(32, 'precisa ter ao menos 32 caracteres').optional(),
    ),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
  })
  .refine(
    (env) => !(env.GEO_PROVIDER === 'fake' && env.NODE_ENV === 'production'),
    {
      path: ['GEO_PROVIDER'],
      error: 'não pode ser "fake" com NODE_ENV=production',
    },
  );

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
