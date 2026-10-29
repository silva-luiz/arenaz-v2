import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PublicTabBar } from '@/components/layout/public-tab-bar';

export const metadata: Metadata = { title: 'Minhas reservas' };

/** The bookings pages get the mobile tab bar, which the account shell lacks. */
export default function BookingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PublicTabBar />
    </>
  );
}
