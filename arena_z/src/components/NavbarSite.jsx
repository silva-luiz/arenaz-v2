import arenaZLogo from '/arenaz-logo.png';

import styles from './NavbarSite.module.css';
import Button from './Button';


const NavbarSite = () => {

  const goToLogin = (e) =>{
    e.preventDefault();
    console.log('Foi pro login');
  }

  const goToRegister = (e) =>{
    e.preventDefault();
    console.log('Foi pro cadastro');
  }

  return (
    <div className={styles.siteNavbar}>
      <a href="#" className={styles.arenazMainButton}>
        <img src={arenaZLogo} alt="Logo" className={styles.arenazLogo} />
        <p>Arena Z</p>
      </a>
      <div>
        <Button className='primaryButton' text='Criar conta' action={goToRegister}/>
        <Button className='outlinedButton' text='Entrar' action={goToLogin}/>      
      </div>
    </div>
  )
}

export default NavbarSite