import CallToActionBanner from "./components/CallToActionBanner"
import NavbarSite from "./components/NavbarSite"

import cta1 from '../src/assets/cta-1.png'
import cta2 from '../src/assets/cta-2.png'

function App() {


  return (
    <>
      <NavbarSite />
      <CallToActionBanner
        message={'Cadastre sua arena e conecte-se com atletas de todos os esportes em sua região'}
        backgroundImage={cta1}
      />
      <CallToActionBanner
        message={'Todos os esportes em um só lugar, com muito mais visibilidade!'}
        backgroundImage={cta2}
      />
    </>
  )
}

export default App
