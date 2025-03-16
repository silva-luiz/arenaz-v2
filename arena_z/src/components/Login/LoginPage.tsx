import Button from '../Button';
import { FaUser, FaLock } from 'react-icons/fa';
// import Cookies from 'js-cookie';
import { useState } from 'react';
import URLS from '../../api/routes';

const loginUrl = URLS.LOGIN;

import arenaZLogo from '../../../public/images/arenaz-logo.png';
import styles from './LoginPage.module.css';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [credentialsError, setCredentialsError] = useState('');
  const router = useRouter();
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
        sessionStorage.setItem('auth-token', jsonData.token);
        router.push('../home/dashboard');
      } else {
        setCredentialsError(jsonData.message || 'Credenciais inválidas');
      }

      return { loginRes, jsonData };
    } catch (error) {
      console.log('teste' + error);
    }
  };

  return (
    <div className={styles.mainContainer}>
      <div className={styles.loginMainContainer}>
        <div className={styles.loginWallpaper}></div>
        <div className={styles.formContainer}>
          <form className={styles.loginForm} onSubmit={handleSubmit}>
            <Image src={arenaZLogo} alt="Logo" className={styles.arenaZLogo} />
            <div className={styles.loginTitle}>
              <h1>
                Olá, seja bem-vindo ao{' '}
                <span className={styles.siteName}>ArenaZ</span>
              </h1>
            </div>
            <div className={styles.inputContainer}>
              <span>E-mail</span>
              <div className={styles.inputWrapper}>
                <input
                  type="email"
                  placeholder="E-mail"
                  name="email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <FaUser className={styles.faIcon} />
              </div>
              {credentialsError && (
                <p className={styles.errorText}>{credentialsError}</p>
              )}
            </div>
            <div className={styles.inputContainer}>
              <span>Senha</span>
              <div className={styles.inputWrapper}>
                <input
                  type="password"
                  placeholder="Senha"
                  name="password"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <FaLock className={styles.faIcon} />
              </div>
            </div>
            <div className={styles.recallForget}>
              <label>
                <input type="checkbox" className={styles.checkbox} />
                Lembrar login
              </label>
            </div>
            <Button
              className={styles.loginPrimaryButton}
              text="Entrar"
              action={handleSubmit}
            />
            <div className={styles.signUpLink}>
              <p>Ainda não tem conta?</p>{' '}
              <Link href="/register" className={styles.startNowLink}>
                Comece agora mesmo!
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
