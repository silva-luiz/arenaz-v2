import { useState } from 'react';
import styles from '../Register/Register.module.css';
import PropTypes from 'prop-types';
import URLS  from '../routes/routes';
import {Icon} from 'react-icons-kit';
import {eyeOff} from 'react-icons-kit/feather/eyeOff';
import {eye} from 'react-icons-kit/feather/eye'

const UserRegisterForm = ({ data, updateFieldHandler, emailError, setEmailError }) => {
  
  const [passwordError, setPasswordError] = useState('');

  const [passwordVisibility, setPasswordVisibility] = useState({
    password: { type: 'password', icon: eyeOff },
    confirmPassword: { type: 'password', icon: eyeOff },
  });

  const handleToggle = (field) => {
    setPasswordVisibility((prevState) => ({
      ...prevState,
      [field]: {
        type: prevState[field].type === 'password' ? 'text' : 'password',
        icon: prevState[field].type === 'password' ? eye : eyeOff,
      },
    }));
  };

  const validateEmail = async () => {
    if (!data.email) return;

    try {
      const response = await fetch(URLS.EMAIL_VALIDATION, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email }),
      });

      if (!response.ok) {
        const result = await response.json();
        setEmailError(result.erro);
      } else {
        setEmailError("");
      }
    } catch (error) {
      console.error("Erro na validação do e-mail:", error);
      setEmailError("Erro ao validar e-mail. Tente novamente.");
    }
  };

const validatePasswords = () => {
    if (data.password !== data.confirmPassword) {
      setPasswordError("As senhas não coincidem.");
    } else {
      setPasswordError("");
    } 
}

  return (
    <div>
      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor="name">Nome completo</span>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              name="name"
              id="name"
              placeholder="Nome completo"
              value={data.name || ""}
              onChange={(e) => updateFieldHandler("name", e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor="email">E-mail</span>
          <div className={styles.inputWrapper}>
          <input
              type="email"
              name="email"
              id="email"
              placeholder="E-mail"
              value={data.email || ""}
              onChange={(e) => {
                updateFieldHandler("email", e.target.value);
                if (e.target.value === "") {
                  setEmailError("");
                }
              }}
              onBlur={validateEmail} 
              className={emailError ? styles.errorInput : ""} 
              required
            />
          </div>
          {emailError && <p className={styles.errorText}>{emailError}</p>}
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor="password">Senha</span>
          <div className={styles.inputWrapper}>
            <input
              type={passwordVisibility.password.type}
              name="password"
              id="password"
              placeholder="Digite uma senha"
              pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}"
              value={data.password || ""}
              autoComplete="current-password"
              onChange={(e) => updateFieldHandler("password", e.target.value)}
              required
            />
             <Icon class="absolute mr-10" icon={passwordVisibility.password.icon} size={22} onClick={() => handleToggle('password')} />
          </div>
          <p className={styles.p}>
            <strong>Atenção: </strong>A senha deve ter pelo menos 8 caracteres, incluindo um número, uma letra maiúscula, uma letra minúscula e um caractere especial.
          </p>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor="repassword">Confirme sua senha</span>
          <div className={styles.inputWrapper}>
            <input
              type={passwordVisibility.confirmPassword.type}
              name="repassword"
              id="repassword"
              placeholder="Digite novamente a senha"
              value={data.confirmPassword || ""}
              onChange={(e) => {
                updateFieldHandler("confirmPassword", e.target.value);
                if (e.target.value === "") {
                  setPasswordError("");
                }
              }}
              onBlur={validatePasswords}
              className={passwordError ? styles.errorInput : ""} 
              required
            />
             <Icon class="absolute mr-10" icon={passwordVisibility.confirmPassword.icon} size={22} onClick={() => handleToggle('confirmPassword')} />
          </div>
          {passwordError && <p className={styles.errorText}>{passwordError}</p>}

        </div>
      </div>
    </div>
  );
};

UserRegisterForm.propTypes = {
  data: PropTypes.shape({
    name: PropTypes.string,
    email: PropTypes.string,
    password: PropTypes.string,
    confirmPassword: PropTypes.string,
  }).isRequired,
  updateFieldHandler: PropTypes.func.isRequired,
};

export default UserRegisterForm;
