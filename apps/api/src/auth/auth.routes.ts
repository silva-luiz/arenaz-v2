import { emailSchema, signUpSchema, type Problem } from '@arenaz/contracts';
import type { z } from 'zod';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  fastifyClientStatus,
  sendProblem,
  titleFor,
} from '../common/problem.filter.js';
import { toFieldErrors } from '../common/zod.pipe.js';
import type { Auth } from './auth.js';
import { toFetchHeaders } from './fetch-bridge.js';

const AUTH_PREFIX = '/api/auth';
const SIGN_UP_PATH = `${AUTH_PREFIX}/sign-up/email`;
const SIGN_IN_PATH = `${AUTH_PREFIX}/sign-in/email`;

/**
 * The only Better Auth endpoints exposed (same normalised key as validation).
 * Everything else (change-password, update-user, ...) would skip our payload
 * rules, so it is answered with 404 until it gets its own validation.
 */
const ALLOWED_ENDPOINTS = new Set([
  SIGN_UP_PATH,
  SIGN_IN_PATH,
  `${AUTH_PREFIX}/sign-out`,
  `${AUTH_PREFIX}/get-session`,
]);

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Describe the incoming wire format, which no longer matches once re-built. */
const SKIPPED_REQUEST_HEADERS = ['content-length', 'transfer-encoding'];
/** Per-hop or recomputed by Fastify; copying them corrupts the reply. */
const SKIPPED_RESPONSE_HEADERS = new Set([
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'set-cookie',
]);

/** Better Auth error `code` → the status and pt-BR message we expose. */
const KNOWN_ERRORS: Record<string, { status: number; detail: string }> = {
  USER_ALREADY_EXISTS: {
    status: 422,
    detail: 'Já existe uma conta com este e-mail',
  },
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: {
    status: 422,
    detail: 'Já existe uma conta com este e-mail',
  },
  INVALID_EMAIL_OR_PASSWORD: {
    status: 401,
    detail: 'E-mail ou senha inválidos',
  },
};

const GENERIC_DETAILS: Record<number, string> = {
  400: 'Requisição inválida',
  401: 'Faça login para continuar',
  403: 'Você não tem permissão para esta ação',
  404: 'Recurso não encontrado',
  422: 'Dados inválidos',
  429: 'Muitas tentativas. Tente novamente em instantes',
};
const FALLBACK_DETAIL = 'Não foi possível concluir a requisição';

type AuthProblem = Problem & { code?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The path Better Auth will route, as a comparison key. It comes from the
 * WHATWG-resolved URL (dot segments such as `/./` or `/x/../` and `%2e`
 * already collapsed), then has percent-escapes decoded, repeated and trailing
 * slashes removed and case folded, so every spelling Better Auth could accept
 * for a route maps to the same key and cannot dodge validation.
 */
function routeKey(url: URL): string {
  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // Malformed escapes: keep the raw path; Better Auth will not route it.
  }
  return path
    .replace(/\/{2,}/g, '/')
    .replace(/(.)\/+$/, '$1')
    .toLowerCase();
}

type Normalized = { body: unknown } | { problem: Problem };

/**
 * Validates and normalises the sign-up / sign-in payloads before Better Auth
 * sees them (lowercased, trimmed e-mail; strong password).
 */
function normalizeBody(key: string, body: unknown): Normalized {
  const input = isRecord(body) ? body : {};
  if (key === SIGN_UP_PATH) {
    const result = signUpSchema.safeParse(input);
    if (!result.success) return { problem: invalidData(result.error) };
    // Only the known fields go through: no way to inject extra user fields.
    return { body: result.data };
  }
  if (key === SIGN_IN_PATH) {
    const result = emailSchema.safeParse(input.email);
    if (!result.success) {
      return { problem: invalidData(result.error, 'email') };
    }
    return { body: { ...input, email: result.data } };
  }
  return { body };
}

function invalidData(error: z.ZodError, field?: string): Problem {
  const errors =
    field === undefined
      ? toFieldErrors(error)
      : { [field]: error.issues.map((issue) => issue.message) };
  return {
    type: 'about:blank',
    title: titleFor(422),
    status: 422,
    errors,
  };
}

function buildRequest(
  request: FastifyRequest,
  url: URL,
  body: unknown,
): Request {
  const headers = toFetchHeaders(request.headers);
  for (const name of SKIPPED_REQUEST_HEADERS) headers.delete(name);

  const init: RequestInit = { method: request.method, headers };
  if (BODY_METHODS.has(request.method) && body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }
  return new Request(url, init);
}

function parseErrorBody(text: string): { code?: string } {
  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed) && typeof parsed.code === 'string') {
      return { code: parsed.code };
    }
  } catch {
    // Not JSON (e.g. a bare 404): fall through to a generic problem.
  }
  return {};
}

/** Converts Better Auth's `{ code, message }` error into a pt-BR Problem. */
function toProblem(status: number, text: string): AuthProblem {
  const { code } = parseErrorBody(text);
  const known = code === undefined ? undefined : KNOWN_ERRORS[code];
  const finalStatus = known?.status ?? status;
  const problem: AuthProblem = {
    type: 'about:blank',
    title: titleFor(finalStatus),
    status: finalStatus,
  };
  // Never explain server faults; client faults get a safe pt-BR sentence.
  if (finalStatus < 500) {
    problem.detail =
      known?.detail ?? GENERIC_DETAILS[finalStatus] ?? FALLBACK_DETAIL;
  }
  if (code !== undefined) problem.code = code;
  return problem;
}

async function sendResponse(
  target: FastifyReply,
  response: Response,
): Promise<FastifyReply> {
  const text = await response.text();
  const isError = response.status >= 400;

  for (const [name, value] of response.headers) {
    if (SKIPPED_RESPONSE_HEADERS.has(name)) continue;
    if (isError && name === 'content-type') continue;
    void target.header(name, value);
  }
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) void target.header('set-cookie', cookies);

  if (isError) {
    sendProblem(target, toProblem(response.status, text));
    return target;
  }
  void target.status(response.status);
  return text === '' ? target.send() : target.send(text);
}

/**
 * Mounts Better Auth under `/api/auth/*` on the Fastify instance (so helmet,
 * rate limiting and the request id still apply) and bridges Fastify requests
 * to Better Auth's Fetch handler.
 */
export function registerAuthRoutes(fastify: FastifyInstance, auth: Auth): void {
  fastify.route({
    method: ['GET', 'POST'],
    url: `${AUTH_PREFIX}/*`,
    handler: async (request, target) => {
      // Resolve the URL first: Better Auth routes on exactly this pathname, so
      // validation must key on it too (raw `request.url` can hide dot segments).
      const url = new URL(
        `${request.protocol}://${request.host}${request.url}`,
      );
      const key = routeKey(url);
      if (!ALLOWED_ENDPOINTS.has(key)) {
        sendProblem(target, {
          type: 'about:blank',
          title: titleFor(404),
          status: 404,
          detail: 'Não encontrado',
        });
        return target;
      }
      let body: unknown = request.body;
      if (request.method === 'POST') {
        const normalized = normalizeBody(key, body);
        if ('problem' in normalized) {
          sendProblem(target, normalized.problem);
          return target;
        }
        body = normalized.body;
      }
      const response = await auth.handler(buildRequest(request, url, body));
      return sendResponse(target, response);
    },
    // Fastify-level failures (malformed JSON, oversized body...) and anything
    // thrown above end up here; the stack goes to the log, never the client.
    errorHandler: (error, request, target) => {
      const status = fastifyClientStatus(error);
      if (status === undefined)
        request.log.error({ err: error }, 'Erro no auth');
      sendProblem(target, {
        type: 'about:blank',
        title: titleFor(status ?? 500),
        status: status ?? 500,
      });
    },
  });
}
