'use client';

import Button from '../Button';
import { FaUser, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useState } from 'react';
import arenaZLogo from '/public/images/arenaz-logo.png';
import styles from './LoginPage.module.scss';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { authService } from 'lib/api';

const LoginPage = () => {
  const { login } = authService;
  const router = useRouter();

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [credentialsError, setCredentialsError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
    setCredentialsError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      await login(form);
      router.push('/home/dashboard');
    } catch (error) {
      console.error('Login Error', error);
      setCredentialsError(
        'Credenciais inválidas. Verifique seu e-mail e senha.'
      );
    } finally {
      setLoading(false);
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

          {/* EMAIL */}

          <div className={styles.inputContainer}>
            <span className={styles.inputLabel}>E-mail</span>

            <div className={styles.inputWrapper}>
              <FaUser className={styles.faIcon} />

              <input
                type="email"
                placeholder="E-mail"
                name="email"
                required
                value={form.email}
                onChange={handleChange('email')}
              />
            </div>

            {credentialsError && (
              <p className={styles.errorText}>{credentialsError}</p>
            )}
          </div>

          {/* PASSWORD */}

          <div className={styles.inputContainer}>
            <span className={styles.inputLabel}>Senha</span>

            <div className={styles.inputWrapper}>
              <FaLock className={styles.faIcon} />

              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Senha"
                name="password"
                required
                value={form.password}
                onChange={handleChange('password')}
              />

              <button
                type="button"
                className={styles.eyeButton}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <Button
            className={styles.loginPrimaryButton}
            text={loading ? 'Entrando...' : 'Entrar'}
            disabled={loading}
          />
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
