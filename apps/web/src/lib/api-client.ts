import { navigate } from './navigate';
import { GENERIC_ERROR, problemToFormError } from './problem';

const SESSION_EXPIRED = 'Sua sessão expirou. Entre novamente.';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** What a zod schema offers; keeps this module free of a direct zod import. */
export interface ResponseSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      /** HTTP status; 0 when the request never got an answer. */
      status: number;
      fieldErrors: Record<string, string[]>;
      message: string;
    };

function failure(
  status: number,
  message = GENERIC_ERROR,
  fieldErrors: Record<string, string[]> = {},
): ApiResult<never> {
  return { ok: false, status, fieldErrors, message };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * Browser-side call to the API through the same-origin `/api` proxy (the
 * session cookie is first-party). `content-type: application/json` is sent
 * only with a body: the API answers 400 to an empty body declared as JSON, so
 * publish/unpublish/delete must not send it.
 *
 * A 401 (expired session) sends the browser to the sign-in page, which brings
 * the user back to the current path.
 *
 * Never throws: network failures, problem+json answers and bodies that do not
 * match the schema all come back as `{ ok: false }`. Without a schema the
 * body is ignored (204 and fire-and-forget calls).
 */
export function apiSend(
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<ApiResult<undefined>>;
export function apiSend<T>(
  method: HttpMethod,
  path: string,
  body: unknown,
  schema: ResponseSchema<T>,
): Promise<ApiResult<T>>;
export async function apiSend<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  schema?: ResponseSchema<T>,
): Promise<ApiResult<T | undefined>> {
  // no-store: public reads here carry times that depend on the clock.
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
  };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    return failure(0);
  }

  if (response.status === 401) {
    // The session expired while the page was open: sign in again and come back.
    const here = encodeURIComponent(window.location.pathname).replaceAll(
      '%2F',
      '/',
    );
    navigate(`/entrar?next=${here}`);
    return failure(401, SESSION_EXPIRED);
  }

  if (!response.ok) {
    const { message, fieldErrors } = problemToFormError(
      await readJson(response),
      response.status,
    );
    return failure(response.status, message, fieldErrors);
  }

  if (schema === undefined) return { ok: true, data: undefined };

  const parsed = schema.safeParse(
    response.status === 204 ? undefined : await readJson(response),
  );
  return parsed.success
    ? { ok: true, data: parsed.data }
    : failure(response.status);
}
