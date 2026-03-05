'use client';

import Link from 'next/link';
import styles from './SiteFooter.module.scss';

export default function SiteFooter() {
  return (
    <footer className={styles.siteFooter}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <h2>ArenaZ</h2>
          <span>Gerenciamento inteligente de arenas esportivas</span>
        </div>

        <div className={styles.links}>
          <Link
            href="https://wa.me/5512991144122?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20ArenaZ"
            target="_blank"
            rel="noopener noreferrer"
          >
            Fale conosco
          </Link>
          <Link href="/terms">Termos de uso</Link>
          <Link href="/privacy">Políticas de privacidade</Link>
        </div>
      </div>

      <div className={styles.bottom}>
        © {new Date().getFullYear()} ArenaZ. Todos os direitos reservados.
      </div>
    </footer>
  );
}
