'use client';

import { SearchBar } from '@arenaz/ui';
import { useRef, type MouseEvent } from 'react';
import { demoMarketingCounters, isDemoMode } from '@/lib/demo';
import { LiveDot } from './live-dot';
import { FACE_TONES } from './styles';

const HERO_FACES = ['GR', 'AL', 'JP', 'MT', 'BS'];

function setPointer(element: HTMLElement, x: string, y: string) {
  element.style.setProperty('--mx', x);
  element.style.setProperty('--my', y);
}

/**
 * The night hero of Main.dc.html (desktop): photo with a subtle parallax,
 * the title, two floating marketing cards and the search pill overlapping its
 * bottom edge. Below md only the title remains, visually hidden, as the page's
 * h1 (the mobile home starts with the "Bora jogar?" pill instead).
 *
 * The floating cards are illustrations (no data about a real venue), so they
 * show in every mode; the "312 quadras" counter only in the demo mode.
 */
export function HomeHero() {
  const heroRef = useRef<HTMLElement>(null);

  function onMove(event: MouseEvent<HTMLElement>) {
    const hero = heroRef.current;
    if (!hero) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = hero.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    setPointer(
      hero,
      (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3),
      (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3),
    );
  }

  function onLeave() {
    if (heroRef.current) setPointer(heroRef.current, '0', '0');
  }

  return (
    <section
      ref={heroRef}
      aria-labelledby="hero-titulo"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative [--mx:0] [--my:0] md:h-[580px]"
    >
      <div className="absolute inset-0 overflow-hidden rounded-section bg-[#0B1A12] shadow-2 max-md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- static file in /public, already sized for this slot */}
        <img
          src="/home/hero-night.jpg"
          alt="Campo de futebol iluminado por um refletor à noite, com jogadores em campo"
          fetchPriority="high"
          className="absolute inset-0 size-full [transform:scale(1.08)_translate(calc(var(--mx)*-10px),calc(var(--my)*-8px))] object-cover object-[50%_30%] transition-transform duration-[800ms] ease-out motion-reduce:transition-none"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_100%,rgba(4,14,9,0.88)_0%,rgba(4,14,9,0.5)_42%,rgba(4,14,9,0)_70%),linear-gradient(to_top,rgba(4,14,9,0.55),rgba(4,14,9,0)_45%)]"
        />
      </div>

      <div className="relative flex h-full max-w-[640px] flex-col justify-end px-14 pb-[104px] text-white max-md:sr-only">
        {isDemoMode ? (
          <p className="az-glass-dark mb-[18px] inline-flex items-center gap-2.5 self-start rounded-full border border-white/18 py-2 pr-3.5 pl-2.5 text-sm font-semibold">
            <LiveDot />
            {`${String(demoMarketingCounters.freeCourtsToday)} quadras com horário livre hoje`}
          </p>
        ) : null}
        <h1
          id="hero-titulo"
          className="font-wordmark text-[76px] leading-[0.94] font-[750] tracking-[-0.05em] [text-shadow:0_6px_30px_rgba(0,0,0,0.35)]"
        >
          Bora jogar <br />
          hoje à noite?
        </h1>
        <p className="mt-[18px] max-w-[460px] text-lg leading-normal text-white/84">
          {isDemoMode
            ? 'Reserve a quadra na hora, chame o time e divida no Pix sem ficar cobrando ninguém.'
            : 'Reserve a quadra na hora, chame o time e pague no Pix.'}
        </p>
      </div>

      <div
        aria-hidden="true"
        className="az-glass-dark absolute top-[300px] right-[250px] w-[270px] [transform:translate(calc(var(--mx)*10px),calc(var(--my)*8px))_rotate(-2deg)] rounded-[20px] border border-white/16 p-4 text-white shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)] transition-transform duration-[800ms] ease-out motion-reduce:transition-none max-[1100px]:hidden"
      >
        <div className="flex items-center justify-between text-[13px] text-white/72">
          <span>Racha no Pix</span>
          <span className="font-mono">R$ 33/cada</span>
        </div>
        <div className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">
          9 de 14 pagaram
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-[9px] bg-white/16">
          <span className="block h-full w-[64%] rounded-[9px] bg-live shadow-[0_0_12px_rgba(61,220,132,0.7)]" />
        </div>
        <div className="mt-3.5 flex items-center">
          {HERO_FACES.map((initials, index) => (
            <span
              key={initials}
              style={{ background: FACE_TONES[index % FACE_TONES.length] }}
              className="grid size-7 place-items-center rounded-full border-2 border-night text-[10px] font-semibold text-white shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)] not-first:-ml-2"
            >
              {initials}
            </span>
          ))}
          <span className="ml-2.5 text-[13px] text-white/72">+4</span>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute top-16 right-14 w-[300px] [transform:translate(calc(var(--mx)*22px),calc(var(--my)*16px))_rotate(1.5deg)] rounded-[22px] bg-white p-3 shadow-3 transition-transform duration-[800ms] ease-out motion-reduce:transition-none max-[1100px]:hidden"
      >
        <div className="relative h-[150px] overflow-hidden rounded-[14px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static file in /public, already sized for this slot */}
          <img
            src="/home/reserva-confirmada.jpg"
            alt=""
            className="block size-full object-cover"
          />
          <span className="az-glass absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-xs font-semibold text-ink">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0B7A4B"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 12 10 18 20 6" />
            </svg>
            Reserva confirmada
          </span>
        </div>
        <div className="flex items-end justify-between gap-2.5 px-1.5 pt-3 pb-1">
          <div>
            <div className="text-[15px] font-semibold text-ink">
              Arena Vila Madalena
            </div>
            <div className="mt-0.5 text-[13px] text-muted">
              Hoje · 20h às 22h · quadra 2
            </div>
          </div>
          <div className="rounded-lg bg-[#F1F6F3] px-2 py-1.5 font-mono text-[13px] font-semibold text-brand">
            #AZ-4821
          </div>
        </div>
      </div>

      <div className="absolute -bottom-10 left-1/2 z-10 w-[calc(100%-112px)] max-w-[940px] -translate-x-1/2 max-md:hidden">
        <SearchBar />
      </div>
    </section>
  );
}
