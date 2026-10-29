/**
 * Builds a query string from a filter object, leaving out what is not set:
 * `undefined`, `null`, empty and whitespace-only values (the search form sends
 * empty fields, and the API rejects a blank `q`). Kept values are trimmed. A
 * list becomes comma separated, its blank items dropped, and is left out when
 * nothing remains (`amenities: ['coberta', 'vestiario']` -> `coberta,vestiario`).
 * Use `.toString()` for the string; it has no leading `?`.
 */
export function toSearchParams(
  query: Record<string, string | number | readonly string[] | null | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null) continue;
    const value =
      typeof raw === 'object'
        ? raw
            .map((item) => item.trim())
            .filter((item) => item !== '')
            .join(',')
        : String(raw).trim();
    if (value !== '') params.set(key, value);
  }
  return params;
}
