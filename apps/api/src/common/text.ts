/** An empty or blank optional text becomes NULL, so "no text" is stored one way. */
export function textOrNull(value: string | null | undefined): string | null {
  return value === undefined || value === null || value.trim() === ''
    ? null
    : value;
}

/**
 * "Joana Maria Jogadora" -> "Joana J.": first name and the initial of the last
 * one, all the owner's agenda needs to tell players apart.
 */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  if (!first) return 'Jogador';
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}
