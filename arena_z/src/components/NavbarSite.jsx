import arenaZLogo from '/arenaz-logo.png';

import styles from './NavbarSite.module.css';
import Button from './Button';
import { Link } from 'react-router-dom';


const NavbarSite = () => {
  return (
    <div className={styles.siteNavbar}>
      <Link to="/" className={styles.arenazMainButton}>
        <a className={styles.arenazMainButton}>
          <img src={arenaZLogo} alt="Logo" className={styles.arenazLogo} />
          <p>Arena Z</p>
        </a>
      </Link>

      <div>
        <Link to="/home">
          Go to home
        </Link>

        <Link to="/register">
          <Button className='primaryButton' text='Criar conta' />
        </Link>
        <Link to="/login">
          <Button className='outlinedButton' text='Entrar' />
        </Link>
      </div>
    </div>
  )
}

export default NavbarSite