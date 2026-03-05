'use client';

import styles from './TermsOfUse.module.scss';

export default function TermsOfUse() {
  return (
    <div className={styles.terms}>
      <div className={styles.container}>
        <h1>Termos de Uso</h1>

        <p className={styles.lastUpdate}>
          Última atualização: {new Date().toLocaleDateString()}
        </p>

        <section>
          <h2>1. Aceitação dos Termos</h2>
          <p>
            Ao acessar e utilizar a plataforma ArenaZ, você concorda com os
            presentes Termos de Uso e com todas as leis e regulamentos
            aplicáveis. Caso não concorde com qualquer condição aqui descrita,
            recomendamos que não utilize nossos serviços.
          </p>
        </section>

        <section>
          <h2>2. Sobre a Plataforma</h2>
          <p>
            A ArenaZ é uma plataforma digital voltada ao gerenciamento de
            espaços esportivos, permitindo que proprietários cadastrem suas
            arenas e que jogadores realizem consultas, reservas e pagamentos,
            inclusive por meio de agentes de inteligência artificial e
            integração com aplicativos de mensagens.
          </p>
        </section>

        <section>
          <h2>3. Cadastro e Responsabilidades</h2>
          <p>
            Para utilizar determinadas funcionalidades, poderá ser necessário
            realizar cadastro, fornecendo informações verdadeiras, completas e
            atualizadas. O usuário é responsável pela confidencialidade de suas
            credenciais de acesso e por todas as atividades realizadas em sua
            conta.
          </p>
        </section>

        <section>
          <h2>4. Uso Adequado</h2>
          <p>
            O usuário compromete-se a utilizar a plataforma de forma ética e
            legal, não podendo:
          </p>
          <ul>
            <li>Praticar atividades ilícitas;</li>
            <li>Inserir informações falsas ou enganosas;</li>
            <li>Violar direitos de terceiros;</li>
            <li>Tentar acessar áreas restritas sem autorização.</li>
          </ul>
        </section>

        <section>
          <h2>5. Pagamentos e Reservas</h2>
          <p>
            A ArenaZ poderá intermediar reservas e pagamentos entre jogadores e
            proprietários. A responsabilidade pela disponibilidade do espaço e
            pela prestação do serviço esportivo é exclusivamente do proprietário
            da arena.
          </p>
        </section>

        <section>
          <h2>6. Propriedade Intelectual</h2>
          <p>
            Todo o conteúdo da plataforma, incluindo textos, layouts, marcas,
            logotipos e funcionalidades, é protegido por direitos de propriedade
            intelectual, sendo proibida sua reprodução sem autorização prévia.
          </p>
        </section>

        <section>
          <h2>7. Limitação de Responsabilidade</h2>
          <p>
            A ArenaZ não se responsabiliza por danos indiretos, lucros cessantes
            ou prejuízos decorrentes do uso indevido da plataforma ou da
            indisponibilidade temporária do sistema.
          </p>
        </section>

        <section>
          <h2>8. Alterações dos Termos</h2>
          <p>
            Reservamo-nos o direito de modificar estes Termos de Uso a qualquer
            momento. As alterações entrarão em vigor após sua publicação na
            plataforma.
          </p>
        </section>

        <section>
          <h2>9. Contato</h2>
          <p>
            Para dúvidas relacionadas a estes Termos de Uso, entre em contato
            através do canal{' '}
            <a
              href="https://wa.me/5512991144122?text=Ol%C3%A1%2C%20eu%20gostaria%20de%20saber%20mais%20sobre%20os%20Termos%20de%20uso%20do%20ArenaZ"
              target="_blank"
              rel="noopener noreferrer"
            >
              Fale conosco
            </a>{' '}
            disponível na plataforma.
          </p>
        </section>
      </div>
    </div>
  );
}
