/** "Bom dia" 05–11 h, "Boa tarde" 12–17 h, "Boa noite" 18–04 h. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour <= 11) return 'Bom dia';
  if (hour >= 12 && hour <= 17) return 'Boa tarde';
  return 'Boa noite';
}

/** "Marcos" from "Marcos Almeida". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

const hourFormats = new Map<string, Intl.DateTimeFormat>();

function hourIn(timeZone: string, now: Date): number {
  let format = hourFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    });
    hourFormats.set(timeZone, format);
  }
  return Number(format.format(now));
}

/** "Boa noite, Marcos", by the hour on the venue's clock. */
export function ownerGreeting(
  name: string,
  timeZone: string,
  now: Date = new Date(),
): string {
  const greeting = greetingFor(hourIn(timeZone, now));
  const first = firstName(name);
  return first ? `${greeting}, ${first}` : greeting;
}

const WEEKDAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/** "Quarta, 28 de outubro" for a "YYYY-MM-DD" date key. */
export function dashboardDateLabel(dateKey: string): string {
  const [year = 0, month = 1, day = 1] = dateKey.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return `${WEEKDAYS[date.getUTCDay()] ?? ''}, ${String(day)} de ${MONTHS[month - 1] ?? ''}`;
}
