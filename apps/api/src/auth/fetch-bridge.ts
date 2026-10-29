import type { IncomingHttpHeaders } from 'node:http';

/** Converts Node/Fastify headers (multi-value aware) to a Fetch `Headers`. */
export function toFetchHeaders(source: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      headers.append(name, item);
    }
  }
  return headers;
}
