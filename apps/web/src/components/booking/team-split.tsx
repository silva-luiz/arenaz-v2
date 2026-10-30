'use client';

import { formatCents } from '@arenaz/contracts';
import { useState } from 'react';
import { perPersonCents } from '@/lib/booking-client';
import { demoSquad, isDemoMode } from '@/lib/demo';

/**
 * The team-split parts of Checkout.dc.html. They are demo only: nothing in
 * the product charges the team yet (Plano 4), so outside the demo mode they
 * render nothing. The prototype's switch and the "Pago/Pendente" chips work
 * on the page only, like in the prototype.
 */

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink';

/** "Receber de volta do time": the switch under the price. */
export function SplitOption({
  totalCents,
  players,
}: {
  totalCents: number;
  players: number;
}) {
  const [on, setOn] = useState(true);
  if (!isDemoMode) return null;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        setOn((value) => !value);
      }}
      className={`flex min-h-11 w-full cursor-pointer items-center gap-3.5 rounded-[22px] border border-line bg-bg px-[18px] py-4 text-left text-ink ${FOCUS}`}
    >
      <span
        aria-hidden="true"
        className="grid size-[42px] shrink-0 place-items-center rounded-xl bg-brand-soft"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="8" r="3.5" />
          <circle cx="17" cy="9.5" r="2.5" />
          <path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
          <path d="M16 14.6c2.7.1 4.8 1.8 5.5 4.9" />
        </svg>
      </span>
      <span className="flex-1">
        <strong className="block text-[15px] font-semibold">
          Receber de volta do time
        </strong>
        <span className="text-[13px] text-muted">
          {on
            ? `Você paga tudo e o app cobra ${formatCents(perPersonCents(totalCents, players))} de cada um`
            : 'Você paga o valor inteiro sozinho'}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`flex h-7 w-[46px] shrink-0 rounded-full p-[3px] ${on ? 'justify-end bg-brand' : 'justify-start bg-line-control'}`}
      >
        <span className="size-[22px] rounded-full bg-white" />
      </span>
    </button>
  );
}

/** "Racha do time": who already paid, and the link to ask the others. */
export function SquadRacha({
  players,
  totalCents,
  shareMessage,
}: {
  players: number;
  totalCents: number;
  /** What the WhatsApp message to the group says. */
  shareMessage: string;
}) {
  const [paid, setPaid] = useState<Readonly<Record<string, boolean>>>(() =>
    Object.fromEntries(demoSquad.map((member) => [member.id, member.paid])),
  );
  if (!isDemoMode || demoSquad.length === 0) return null;

  const count = Object.values(paid).filter(Boolean).length;
  return (
    <section aria-labelledby="racha" className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="racha" className="text-lg font-[650]">
          Racha do time
        </h2>
        <span className="text-sm text-muted">{`${String(count)} de ${String(players)} pagaram`}</span>
      </div>
      <span
        role="progressbar"
        aria-label="Pagamentos do racha"
        aria-valuemin={0}
        aria-valuemax={players}
        aria-valuenow={count}
        className="block h-2 overflow-hidden rounded-lg bg-line"
      >
        <span
          className="block h-2 rounded-lg bg-brand"
          style={{ width: `${String(Math.round((count / players) * 100))}%` }}
        />
      </span>
      <p className="text-sm text-muted">
        Cada um paga{' '}
        <strong className="text-ink">
          {formatCents(perPersonCents(totalCents, players))}
        </strong>
        . O dinheiro cai direto na sua conta.
      </p>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-[#1fa855] text-[15px] font-[650] text-ink no-underline ${FOCUS}`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />
        </svg>
        Mandar link no grupo
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
      <ul className="mt-1 flex flex-col">
        {demoSquad.map((member) => {
          const ok = paid[member.id] === true;
          return (
            <li
              key={member.id}
              className="flex items-center gap-3 border-b border-line py-2.5"
            >
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: member.color }}
              >
                {member.initials}
              </span>
              <span className="flex-1 text-[15px]">{member.name}</span>
              <button
                type="button"
                aria-label={`${member.name}: ${ok ? 'pago' : 'pendente'}. Alternar status (protótipo)`}
                onClick={() => {
                  setPaid((current) => ({ ...current, [member.id]: !ok }));
                }}
                className={`min-h-11 min-w-[88px] cursor-pointer rounded-full border px-3 text-[13px] font-semibold ${FOCUS} ${ok ? 'border-[#cfe8d9] bg-brand-soft text-brand-deep' : 'border-line-strong bg-bg text-muted'}`}
              >
                {ok ? 'Pago' : 'Pendente'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
