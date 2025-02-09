import Button from '../Button';
import NavbarSite from '../NavbarSite';
import SiteFooter from '../SiteFooter';
import { FaUser, FaLock } from 'react-icons/fa';
import Cookies from 'js-cookie';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import URLS from '../routes/routes';

const loginUrl = URLS.LOGIN;


import arenaZLogo from '/arenaz-logo.png';
import styles from './LoginPage.module.css'

const LoginPage = () => {
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [credentialsError, setCredentialsError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        const userData = {
            email: email,
            password: password,
        };

        try {
            const loginRes = await fetch(loginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });
            const jsonData = await loginRes.json();

            if (loginRes.ok) {
                Cookies.set('auth_token', jsonData.token, { expires: 1 });
                navigate('../home/dashboard');
            } else {
                setCredentialsError(jsonData.message || 'Credenciais inválidas');
            }

            return { loginRes, jsonData };
        } catch (error) {
            console.log('teste' + error);
        }

    }

    return (
        <div className={styles.mainContainer}>
            <NavbarSite />
            <div className={styles.loginMainContainer}>
                <div className={styles.loginWallpaper}>
                </div>
                <div className={styles.formContainer}>
                    <form className={styles.loginForm} onSubmit={handleSubmit}>
                        <img src={arenaZLogo} alt="Logo" className={styles.arenaZLogo} />
                        <div className={styles.loginTitle}>
                            <h1>Olá, seja bem-vindo ao <span className={styles.siteName}>ArenaZ</span></h1>
                        </div>
                        <div className={styles.inputContainer}>
                            <span>E-mail</span>
                            <div className={styles.inputWrapper}>
                                <input type="email" placeholder='E-mail' name='email' onChange={(e) => setEmail(e.target.value)} required />

                                <FaUser className={styles.faIcon} />
                            </div>
                            {credentialsError && <p className={styles.errorText}>{credentialsError}</p>}

                        </div>
                        <div className={styles.inputContainer}>
                            <span>Senha</span>
                            <div className={styles.inputWrapper}>
                                <input type="password" placeholder='Senha' name='password' onChange={(e) => setPassword(e.target.value)} />
                                <FaLock className={styles.faIcon} />
                            </div>
                        </div>
                        <div className={styles.recallForget}>
                            <label>
                                <input type="checkbox" className={styles.checkbox} />
                                Lembrar login
                            </label>
                        </div>
                        <Button className={styles.loginPrimaryButton} text='Entrar' action={handleSubmit} />
                        <div className={styles.signUpLink}>
                            <p>Ainda não tem conta?</p> <Link to='/register'><a className={styles.startNowLink}>Comece agora mesmo!</a></Link>
                        </div>
                    </form>
                </div>
            </div>
            <SiteFooter />
        </div>
    )
}

export default LoginPage;
