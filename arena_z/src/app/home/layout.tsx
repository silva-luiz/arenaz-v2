'use client';

import HomePage from 'components/Home/HomePage';

export default function HomeLayout({ children }) {
  return (
    <section id="home">
      <HomePage>{children}</HomePage>
    </section>
  );
}
