import Button from '../Button';
import NavbarSite from '../NavbarSite';
import SiteFooter from '../SiteFooter';
import { FaUser, FaLock } from 'react-icons/fa';
import { useState } from 'react';

import arenaZLogo from '/arenaz-logo.png';
import styles from './LoginPage.module.css'



const LoginPage = () => {
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');


    const handleSubmit = (e) => {
        e.preventDefault();
    
        alert(`Login feito!! Email: ${email} // Password: ${password}`);
    }

    return (
    <div className={styles.mainContainer}>
        <NavbarSite/>
        <div className={styles.loginMainContainer}>
        <div className={styles.loginWallpaper}>  
        </div>
        <form className={styles.loginForm} onSubmit={handleSubmit}>
            <img src={arenaZLogo} alt="Logo" className={styles.arenaZLogo}/>
            <div className={styles.loginTitle}>
            <h1>Olá, seja bem-vindo ao <span>ArenaZ</span></h1>
            </div>
            <div className={styles.inputContainer}>
                <span>E-mail</span>
                <div className={styles.inputWrapper}>
                    <input type="email" placeholder='E-mail' name='email' onChange={(e) => setEmail(e.target.value)}/>
                    <FaUser className={styles.faIcon} />
                </div>
            </div>

            <div className={styles.inputContainer}>
                <span>Senha</span>
                <div className={styles.inputWrapper}>
                    <input type="password" placeholder='Senha' name='password' onChange={(e) => setPassword(e.target.value)}/>
                    <FaLock className={styles.faIcon} />
                </div>
            </div>
            <div className={styles.recallForget}>
                <label htmlFor="">
                    <input type="checkbox" className={styles.checkbox}/>
                    Lembrar login
                </label>
                <a href="#" className={styles.forgetPasswordLink}>Esqueci minha senha</a>
            </div>
            <Button className={styles.loginPrimaryButton} text='Entrar' action={handleSubmit}/>
            <div className={styles.signUpLink}>
                <p>Ainda não tem conta?</p> <a href="#" className={styles.startNowLink}>Comece agora mesmo!</a>
            </div>
        </form>
    </div>
    <SiteFooter/>
    </div>
   
  )
}

export default LoginPage