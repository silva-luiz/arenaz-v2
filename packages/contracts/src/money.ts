// "R$", optional; integer part either plain digits or dot-grouped thousands
// ("1.234"); optional comma followed by 1-2 decimal digits.
const BRL_PATTERN =
  /^\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*$/i;

/**
 * Parses what a person types as a price ("R$ 1.234,50", "120", "120,5") into
 * integer cents. Returns null for anything ambiguous or invalid. No floats:
 * the integer is assembled from the digit groups.
 */
export function parseBrlToCents(input: string): number | null {
  const match = BRL_PATTERN.exec(input);
  if (!match) return null;
  const [, integerPart = '', fractionPart = ''] = match;
  const reais = Number(integerPart.replaceAll('.', ''));
  const cents = Number(fractionPart.padEnd(2, '0'));
  const total = reais * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** "R$ 1.234,50" — ICU emits NBSP / narrow NBSP; we want a regular space. */
export function formatCents(cents: number): string {
  return brl.format(cents / 100).replace(/\s/g, ' ');
}
