import AccordionMenu from './AccordionMenu';
import styles from './SiteFaq.module.scss';

const SiteFaq = () => {
  return (
    <div className={styles.faqMainContainer}>
      <h1 className={styles.faqTitle}>Perguntas frequentes</h1>
      <div className={styles.accordionListContainer}>
        <AccordionMenu title="Que tipo de esporte minha arena deve possuir?">
          Todas os esportes são bem-vindos no ArenaZ. Aqui você pode cadastrar
          arenas de todas as modalidades, desde as mais convencionais, até as
          mais diferenciadas.
        </AccordionMenu>
        <AccordionMenu title="Só posso gerenciar as reservas feitas pelo App?">
          Não! Você pode utilizar o sistema para gerenciar também as reservas
          feitas através de outros meios (WhatsApp, telefone, etc).
        </AccordionMenu>
        <AccordionMenu title="Qual o valor das taxas do ArenaZ?">
          O ArenaZ recolhe uma taxa mensal no valor de R$ 50,00 (cinquenta
          reais) para o gerenciamento do estabelecimento no geral, e 7% do valor
          total da reserva, quando feita através de nosso aplicativo.
        </AccordionMenu>
      </div>
    </div>
  );
};

export default SiteFaq;
