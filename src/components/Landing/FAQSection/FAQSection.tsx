'use client';

import { useState } from 'react';
import styles from './FAQSection.module.scss';

const faqs = [
  {
    question: 'Preciso instalar algum aplicativo para usar a ArenaZ?',
    answer:
      'Não. Toda a gestão pode ser feita pelo painel web, e seus clientes realizam reservas diretamente pelo WhatsApp através dos nossos agentes de IA.',
  },
  {
    question: 'Como os jogadores fazem a reserva?',
    answer:
      'Os jogadores interagem com um agente de inteligência artificial no WhatsApp, consultam horários disponíveis, escolhem a arena, confirmam a reserva e realizam o pagamento de forma automatizada.',
  },
  {
    question: 'Posso cadastrar mais de uma arena?',
    answer:
      'Sim. Dependendo do plano escolhido, você pode cadastrar múltiplas arenas e gerenciar todas em um único dashboard centralizado.',
  },
  {
    question: 'Como recebo os pagamentos das reservas?',
    answer:
      'Os pagamentos podem ser integrados a provedores financeiros, permitindo que você receba diretamente na sua conta, com total controle pelo painel administrativo.',
  },
  {
    question: 'A ArenaZ substitui meu controle manual?',
    answer:
      'Sim. A plataforma elimina anotações manuais e planilhas, automatizando reservas, reduzindo erros e liberando seu tempo para focar no crescimento do seu negócio.',
  },
];

export default function FAQSection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <section className={styles.faq}>
      <div className={styles.container}>
        <h2 className={styles.title}>Perguntas Frequentes</h2>
        <p className={styles.subtitle}>
          Tire suas dúvidas e descubra como a ArenaZ pode transformar a gestão da sua arena
        </p>

        <div className={styles.accordion}>
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`${styles.item} ${
                activeIndex === index ? styles.active : ''
              }`}
            >
              <button
                className={styles.question}
                onClick={() => toggle(index)}
              >
                {faq.question}
                <span className={styles.icon}>
                  {activeIndex === index ? '−' : '+'}
                </span>
              </button>

              <div className={styles.answer}>
                <p>{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
