import type { OwnerVenueSummary } from '@arenaz/contracts';
import { cn, formatPrice } from '@arenaz/ui';
import type { ReactNode } from 'react';
import { demoOwnerStats, isDemoMode } from '@/lib/demo';

function Indicator({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-line bg-bg px-5 py-[18px] shadow-1 transition-[transform,box-shadow] duration-[400ms] ease-out hover:-translate-y-[3px] hover:shadow-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-2 text-[30px] leading-tight font-[650] tracking-[-0.03em]">
        {value}
      </dd>
      {children}
    </div>
  );
}

function Note({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'brand';
}) {
  return (
    <dd
      className={cn(
        'mt-2 text-[13px]',
        tone === 'brand' ? 'font-semibold text-brand-deep' : 'text-muted',
      )}
    >
      {children}
    </dd>
  );
}

/**
 * The owner's numbers of Painel.dc.html. "Ocupação hoje" and "Recebido na
 * semana" come from the API; "Repasse de sexta" and "Mensalistas ativos" do
 * not exist yet and are shown only in the demo. The grid fills the row with
 * whatever cards there are.
 */
export function OwnerIndicators({ summary }: { summary: OwnerVenueSummary }) {
  const { occupancyPct, weekRevenueCents } = summary;
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
      <Indicator label="Ocupação hoje" value={`${String(occupancyPct)}%`}>
        <dd aria-hidden="true" className="mt-3 h-1.5 rounded-md bg-line">
          <span
            className="block h-1.5 rounded-md bg-brand"
            style={{ width: `${String(occupancyPct)}%` }}
          />
        </dd>
      </Indicator>
      <Indicator
        label="Recebido na semana"
        value={formatPrice(weekRevenueCents)}
      >
        {weekRevenueCents > 0 ? (
          <Note tone="brand">Tudo já pago no Pix</Note>
        ) : (
          <Note>Nenhum pagamento pelo app ainda</Note>
        )}
      </Indicator>
      {isDemoMode ? (
        <>
          <Indicator
            label="Repasse de sexta"
            value={formatPrice(demoOwnerStats.payoutCents)}
          >
            <Note>{`Cai na conta ${demoOwnerStats.payoutDay}`}</Note>
          </Indicator>
          <Indicator
            label="Mensalistas ativos"
            value={`${String(demoOwnerStats.monthlyTeams)} times`}
          >
            <Note>{`${String(demoOwnerStats.renewingThisWeek)} renovam esta semana`}</Note>
          </Indicator>
        </>
      ) : null}
    </dl>
  );
}
