'use client';

import styles from './PricingSection.module.scss';
import Link from 'next/link';

export default function PricingSection() {
  return (
    <section className={styles.pricing}>
      <div className={styles.container}>
        <h2 className={styles.title}>Planos e Preços</h2>
        <p className={styles.subtitle}>
          Escolha o plano ideal para o seu espaço esportivo
        </p>

        <div className={styles.cards}>
          <div className={styles.card}>
            <h3>Básico</h3>
            <p className={styles.price}>
              R$ 79<span>/mês</span>
            </p>
            <ul>
              <li>Cadastro de 1 arena</li>
              <li>Gestão de reservas</li>
              <li>Painel administrativo</li>
              <li>Suporte por e-mail</li>
            </ul>

            <Link
              href="https://wa.me/5512991144122?text=Ol%C3%A1%2C%20eu%20gostaria%20de%20saber%20mais%20sobre%20o%20Plano%20B%C3%A1sico%20do%20ArenaZ"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="primaryButton">Conhecer plano</button>
            </Link>
          </div>

          <div className={`${styles.card} ${styles.highlight}`}>
            <div className={styles.badge}>Mais Popular</div>
            <h3>Profissional</h3>
            <p className={styles.price}>
              R$ 149<span>/mês</span>
            </p>
            <ul>
              <li>Cadastro ilimitado de arenas</li>
              <li>Agentes de IA no WhatsApp</li>
              <li>Relatórios financeiros</li>
              <li>Gestão de recorrências</li>
              <li>Suporte prioritário</li>
            </ul>

            <Link
              href="https://wa.me/5512991144122?text=Ol%C3%A1%2C%20eu%20gostaria%20de%20saber%20mais%20sobre%20o%20Plano%20Profissional%20do%20ArenaZ"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="primaryButton">Conhecer plano</button>
            </Link>
          </div>

          <div className={styles.card}>
            <h3>Premium</h3>
            <p className={styles.price}>
              R$ 249<span>/mês</span>
            </p>
            <ul>
              <li>Tudo do plano Profissional</li>
              <li>Customização de marca</li>
              <li>Integração com pagamentos avançados</li>
              <li>Relatórios estratégicos avançados</li>
              <li>Suporte dedicado</li>
            </ul>

            <Link
              href="https://wa.me/5512991144122?text=Ol%C3%A1%2C%20eu%20gostaria%20de%20saber%20mais%20sobre%20o%20Plano%20Premium%20do%20ArenaZ"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="primaryButton">Conhecer plano</button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
