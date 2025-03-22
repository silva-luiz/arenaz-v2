'use client';
import NavbarSite from 'components/NavbarSite';
import cta1 from '../../public/images/cta-1.png';
import cta2 from '../../public/images/cta-2.png';

import CallToActionBanner from 'components/Landing/CallToActionBanner';
import SiteDescription from 'components/Landing/SiteDescription';

export default function Home() {
  return (
    <>
      <NavbarSite />
      <CallToActionBanner
        message={
          'Cadastre sua arena e conecte-se com atletas de todos os esportes em sua região'
        }
        backgroundImage={cta1}
      />
      <SiteDescription
        DescriptionTitle={'Por que utilizar nossa plataforma?'}
        Title1={'Visibilidade'}
        Description1={
          'Ter sua arena em nossa plataforma coloca seu estabelecimento em evidência na região, permitindo que praticantes de todos os esportes o encontrem com facilidade. Aumente sua visibilidade e atraia novos clientes de forma eficaz!'
        }
        Title2={'Gerenciamento simplificado'}
        Description2={
          'Ao cadastrar sua arena em nossa plataforma, você ganha controle total sobre suas reservas. Nossa interface oferece tabelas organizadas e um dashboard simples e intuitivo, permitindo que você gerencie horários, eventos e disponibilidade com facilidade. Mantenha o controle e otimize a administração do seu espaço de forma prática e eficiente!'
        }
        Title3={'Variedade'}
        Description3={
          'Na nossa plataforma, a variedade é a chave. Você pode cadastrar Arenas de todos os esportes, desde futebol. até quadras de areia. Seja qual for o tipo de espaço que você oferece, nossa plataforma permite que você alcance uma ampla gama de praticantes! '
        }
      />
      <SiteDescription
        DescriptionTitle={'Como funciona?'}
        Title1={'Controle total'}
        Description1={
          'Nosso produto oferece uma solução prática e eficiente para proprietários de arenas esportivas. Ao se cadastrar, o proprietário pode adicionar sua arena ao sistema, permitindo o controle total das reservas feitas para o dia e para o mês inteiro. Isso proporciona uma visão clara e organizada dos horários disponíveis e das reservas confirmadas, facilitando a gestão do espaço.'
        }
        Title2={'Dashboard completo'}
        Description2={
          'Além disso, o proprietário terá acesso a um dashboard exclusivo que exibe informações importantes sobre as reservas. Esse painel inclui detalhes como a quantidade de reservas realizadas, horários mais populares e dados financeiros, ajudando o proprietário a entender melhor o uso do espaço e a tomar decisões informadas para otimizar a ocupação.'
        }
      />
      <CallToActionBanner
        message={
          'Todos os esportes em um só lugar, com muito mais visibilidade!'
        }
        backgroundImage={cta2}
      />
    </>
  );
}
