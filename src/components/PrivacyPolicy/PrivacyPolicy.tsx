'use client';

import styles from './PrivacyPolicy.module.scss';

export default function PrivacyPolicy() {
  return (
    <div className={styles.privacy}>
      <div className={styles.container}>
        <h1>Política de Privacidade</h1>

        <p className={styles.lastUpdate}>
          Última atualização: {new Date().toLocaleDateString()}
        </p>

        <section>
          <h2>1. Introdução</h2>
          <p>
            A ArenaZ valoriza a privacidade e a proteção dos dados pessoais de
            seus usuários. Esta Política de Privacidade explica como coletamos,
            utilizamos, armazenamos e protegemos suas informações ao utilizar
            nossa plataforma de gerenciamento de arenas esportivas.
          </p>
        </section>

        <section>
          <h2>2. Dados Coletados</h2>
          <p>Podemos coletar os seguintes dados:</p>
          <ul>
            <li>Informações de cadastro (nome, e-mail, telefone);</li>
            <li>Dados de reservas e pagamentos;</li>
            <li>Informações fornecidas via WhatsApp ou chatbots;</li>
            <li>Dados técnicos como IP, navegador e dispositivo;</li>
            <li>Dados financeiros necessários para processamento de pagamentos.</li>
          </ul>
        </section>

        <section>
          <h2>3. Finalidade do Uso dos Dados</h2>
          <p>Os dados coletados são utilizados para:</p>
          <ul>
            <li>Processar reservas e pagamentos;</li>
            <li>Permitir a comunicação entre jogadores e proprietários;</li>
            <li>Melhorar a experiência do usuário;</li>
            <li>Garantir segurança e prevenção contra fraudes;</li>
            <li>Cumprir obrigações legais e regulatórias.</li>
          </ul>
        </section>

        <section>
          <h2>4. Compartilhamento de Dados</h2>
          <p>
            A ArenaZ poderá compartilhar dados com:
          </p>
          <ul>
            <li>Proprietários de arenas, para viabilizar reservas;</li>
            <li>Prestadores de serviço de pagamento;</li>
            <li>Fornecedores de tecnologia e hospedagem;</li>
            <li>Autoridades legais, quando exigido por lei.</li>
          </ul>
          <p>
            Não comercializamos dados pessoais com terceiros.
          </p>
        </section>

        <section>
          <h2>5. Armazenamento e Segurança</h2>
          <p>
            Adotamos medidas técnicas e administrativas adequadas para proteger
            os dados pessoais contra acessos não autorizados, perda,
            alteração ou destruição. Os dados são armazenados apenas pelo
            tempo necessário para cumprir as finalidades descritas nesta
            política.
          </p>
        </section>

        <section>
          <h2>6. Direitos do Titular</h2>
          <p>
            Nos termos da Lei Geral de Proteção de Dados (LGPD), o usuário pode:
          </p>
          <ul>
            <li>Solicitar acesso aos seus dados pessoais;</li>
            <li>Corrigir dados incompletos ou desatualizados;</li>
            <li>Solicitar a exclusão de seus dados;</li>
            <li>Revogar o consentimento quando aplicável;</li>
            <li>Solicitar informações sobre compartilhamento de dados.</li>
          </ul>
        </section>

        <section>
          <h2>7. Cookies e Tecnologias de Rastreamento</h2>
          <p>
            Podemos utilizar cookies e tecnologias similares para melhorar a
            navegação, personalizar conteúdo e analisar o uso da plataforma.
            O usuário pode gerenciar as preferências de cookies diretamente em
            seu navegador.
          </p>
        </section>

        <section>
          <h2>8. Alterações nesta Política</h2>
          <p>
            Esta Política de Privacidade poderá ser atualizada periodicamente.
            Recomendamos que o usuário revise este documento regularmente para
            manter-se informado sobre como protegemos seus dados.
          </p>
        </section>

        <section>
          <h2>9. Contato</h2>
          <p>
            Em caso de dúvidas sobre esta Política de Privacidade ou sobre o
            tratamento de dados pessoais, entre em contato através do canal
            “Fale Conosco” disponível na plataforma.
          </p>
        </section>
      </div>
    </div>
  );
}
