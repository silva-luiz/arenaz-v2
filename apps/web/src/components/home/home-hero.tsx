'use client';

import { SearchBar } from '@arenaz/ui';
import { useRef, type MouseEvent } from 'react';
import { demoMarketingCounters, isDemoMode } from '@/lib/demo';
import { ConfirmedBookingCard, RachaCard } from './hero-cards';
import { HERO_SHOWCASE_MOCK, type HeroShowcase } from './hero-showcase';
import { LiveDot } from './live-dot';

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
 * The two floating cards read a {@link HeroShowcase} (today the illustration
 * {@link HERO_SHOWCASE_MOCK}, with no data about a real booking), so they show
 * in every mode from md; between md and 1100px they shrink beside a smaller
 * title. The 1100px step is written in rem (68.8125rem) like the other home
 * rails: a px breakpoint would sort before `lg` and lose to it. The hero is
 * 520px tall, lower than the prototype's 580px, so the search pill stays in
 * view on a 768px-tall laptop. The "312 quadras" counter shows only in the
 * demo mode.
 */
export function HomeHero({
  showcase = HERO_SHOWCASE_MOCK,
}: {
  showcase?: HeroShowcase;
}) {
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
      className="relative [--mx:0] [--my:0] md:h-[520px]"
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
          className="font-wordmark text-[52px] leading-[0.94] font-[750] tracking-[-0.05em] [text-shadow:0_6px_30px_rgba(0,0,0,0.35)] lg:text-[60px] min-[68.8125rem]:text-[76px]"
        >
          Bora jogar <br />
          hoje à noite?
        </h1>
        <p className="mt-[18px] max-w-[300px] text-lg leading-normal lg:max-w-[400px] min-[68.8125rem]:max-w-[460px] text-white/84">
          {isDemoMode
            ? 'Reserve a quadra na hora, chame o time e divida no Pix sem ficar cobrando ninguém.'
            : 'Reserve a quadra na hora, chame o time e pague no Pix.'}
        </p>
      </div>

      <RachaCard
        racha={showcase.racha}
        className="absolute top-[252px] right-[88px] w-[230px] [transform:translate(calc(var(--mx)*10px),calc(var(--my)*8px))_rotate(-2deg)] max-md:hidden lg:top-[284px] lg:right-[190px] lg:w-[240px] min-[68.8125rem]:top-[292px] min-[68.8125rem]:right-[250px] min-[68.8125rem]:w-[270px]"
      />

      <ConfirmedBookingCard
        booking={showcase.booking}
        className="absolute top-8 right-8 w-[240px] [transform:translate(calc(var(--mx)*22px),calc(var(--my)*16px))_rotate(1.5deg)] max-md:hidden lg:top-10 lg:right-10 lg:w-[260px] min-[68.8125rem]:top-12 min-[68.8125rem]:right-14 min-[68.8125rem]:w-[300px]"
      />

      <div className="absolute -bottom-10 left-1/2 z-10 w-[calc(100%-112px)] max-w-[940px] -translate-x-1/2 max-md:hidden">
        <SearchBar />
      </div>
    </section>
  );
}
