import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';

/** Centered column with the logo on top; pages put a ui `Card` inside it. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 px-4 py-10">
      <Link
        href="/"
        aria-label="arenaz, página inicial"
        className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      >
        <Logo />
      </Link>
      {children}
    </main>
  );
}
