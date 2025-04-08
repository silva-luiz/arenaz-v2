import Button from '../Button';
import { FaUser, FaLock } from 'react-icons/fa';
// import Cookies from 'js-cookie';
import { useState } from 'react';

import arenaZLogo from '/public/images/arenaz-logo.png';
import styles from './LoginPage.module.scss';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { authService } from 'lib/api';

const LoginPage = () => {
  const { login } = authService;
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
      await login(userData);
      router.push('home/dashboard');
    } catch (error) {
      console.error('Login Error' + error);
    }
  };

  return (
    <div className={styles.loginMainContainer}>
      <Image
        src="/images/login-wallpaper.png"
        width={661}
        height={781}
        alt="login image"
      />
      <div className={styles.formContainer}>
        <form className={styles.loginForm} onSubmit={handleSubmit}>
          <Image src={arenaZLogo} alt="Logo" className={styles.arenaZLogo} />
          <div className={styles.loginTitle}>
            <h1 className={styles.loginWelcomeMessage}>
              Olá, seja bem-vindo ao{' '}
              <span className={styles.siteName}>ArenaZ</span>
            </h1>
          </div>
          <div className={styles.inputContainer}>
            <span className={styles.inputLabel}>E-mail</span>
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
            <span className={styles.inputLabel}>Senha</span>
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
          {/* <div className={styles.recallForget}>
            <label>
              <input type="checkbox" className={styles.checkbox} />
              Lembrar login
            </label>
          </div> */}
          <Button
            className={styles.loginPrimaryButton}
            text="Entrar"
            handleClick={handleSubmit}
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
  );
};

export default LoginPage;
