import arenaZLogo from '../assets/arenaz-logo.png';

import styles from './NavbarSite.module.css';


const NavbarSite = () => {
  return (
    <div className={styles.siteNavbar}>
      <a href="#" className={styles.arenazMainButton}>
        <img src={arenaZLogo} alt="Logo" className={styles.arenazLogo} />
        <p>Arena Z</p>
      </a>
      <div>
        <button className="primaryButton">Criar conta</button>
        <button className="outlinedButton">Entrar</button>

      </div>
    </div>
  )
}

export default NavbarSite