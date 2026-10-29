import { cn } from '@arenaz/ui';
import { AppLink } from '@/components/ui/next-link';
import { isDemoMode } from '@/lib/demo';
import { WHITE_FOCUS_RING } from './styles';

// Occupancy bars of the mini panel, 16h to 23h (Main.dc.html `occ`).
const OCCUPANCY = [0.35, 0.6, 1, 1, 1, 0.85, 1, 0.5];
const HIGHLIGHTED_BAR = 4;

/**
 * "Para donos de quadra": photo banner with the call to list a venue. The mini
 * panel on the right is a marketing illustration (aria-hidden, from 1100px
 * up), shown in every mode. "Mensalistas automáticos" do not exist yet, so the
 * prototype's sentence is demo only.
 */
export function OwnerBanner() {
  return (
    <section
      aria-labelledby="dono-titulo"
      className="relative flex min-h-[520px] items-end overflow-hidden rounded-section shadow-2 md:min-h-[480px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static file in /public, already sized for this slot */}
      <img
        src="/home/owner-sunset.jpg"
        alt="Campo de futebol vazio ao entardecer, com um gol ao fundo"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-cover object-[50%_60%]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,8,6,0.78)_0%,rgba(10,8,6,0.4)_50%,rgba(10,8,6,0.05)_100%)] max-md:bg-[linear-gradient(to_top,rgba(10,8,6,0.85)_0%,rgba(10,8,6,0.5)_60%,rgba(10,8,6,0.2)_100%)]"
      />
      <div className="relative max-w-[560px] p-7 text-white md:p-[52px]">
        <p className="mb-3 text-[15px] font-semibold text-white/80">
          Para donos de quadra
        </p>
        <h2
          id="dono-titulo"
          className="font-wordmark text-[38px] leading-[0.98] font-bold tracking-[-0.045em] md:text-[54px]"
        >
          Quadra vazia às 15h também paga as contas.
        </h2>
        <p className="mt-4 mb-[26px] text-[17px] leading-normal text-white/86">
          {isDemoMode
            ? 'Agenda online, pagamento antecipado no Pix e mensalistas automáticos. Você só abre o portão.'
            : 'Agenda online e pagamento antecipado no Pix. Você só abre o portão.'}
        </p>
        <AppLink
          href="/painel"
          className={cn(
            'inline-flex h-[54px] items-center rounded-button bg-white px-[26px] text-base font-semibold text-ink shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] transition-transform duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
            WHITE_FOCUS_RING,
          )}
        >
          Anunciar minha quadra
        </AppLink>
      </div>

      <div
        aria-hidden="true"
        className="az-glass absolute right-[52px] bottom-[52px] w-80 -rotate-[1.5deg] rounded-[22px] p-[18px] text-ink shadow-3 max-[1100px]:hidden"
      >
        <div className="flex justify-between text-[13px] text-[#555555]">
          <span>Hoje na Arena Vila Madalena</span>
          <span className="font-semibold text-brand">86%</span>
        </div>
        <div className="mt-3 grid h-[54px] grid-cols-8 items-end gap-1">
          {OCCUPANCY.map((value, index) => (
            <span
              key={index}
              style={{ height: `${String(Math.round(value * 100))}%` }}
              className={cn(
                'block rounded-[5px]',
                value === 1 ? 'bg-brand' : 'bg-brand/32',
                index === HIGHLIGHTED_BAR &&
                  'shadow-[0_0_0_2px_#ffffff,0_0_0_3px_var(--color-brand)]',
              )}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[11px] text-muted">
          <span>16h</span>
          <span>23h</span>
        </div>
        <div className="mt-3.5 flex items-baseline justify-between border-t border-black/8 pt-3.5">
          <span className="text-[13px] text-[#555555]">
            Repasse no Pix às 18h
          </span>
          <strong className="text-[22px] font-bold tracking-[-0.02em]">
            R$ 1.240
          </strong>
        </div>
      </div>
    </section>
  );
}
