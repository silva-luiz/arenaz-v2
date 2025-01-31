import styles from '../Register/Register.module.css';
import PropTypes from 'prop-types';

const UserRegisterForm = ({ data, updateFieldHandler }) => {
  return (
    <div>
      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor='name'>Nome completo</span>
          <div className={styles.inputWrapper}>
            <input
              type='text'
              name='name'
              id='name'
              placeholder='Nome completo'
              value={data.name || ""}
              onChange={(e) => updateFieldHandler("name", e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor='email'>E-mail</span>
          <div className={styles.inputWrapper}>
            <input
              type='email'
              name='email'
              id='email'
              placeholder='E-mail'
              value={data.email || ""}
              onChange={(e) => updateFieldHandler("email", e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor='password'>Senha</span>
          <div className={styles.inputWrapper}>
            <input
              type='password'
              name='password'
              id='password'
              placeholder='Digite uma senha'
              pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}"
              value={data.password || ""}
              onChange={(e) => updateFieldHandler("password", e.target.value)}
              required
            />
          </div>
          <p className={styles.p}><strong>Atenção: </strong>A senha deve ter pelo menos 8 caracteres, incluindo um número, uma letra maiúscula, uma letra minúscula e um caractere especial.</p>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor='repassword'>Senha</span>
          <div className={styles.inputWrapper}>
            <input
              type='password'
              name='repassword'
              id='repassword'
              placeholder='Digite novamente a senha'
              value={data.confirmPassword || ""}
              onChange={(e) => updateFieldHandler("confirmPassword", e.target.value)}
              required
            />
          </div>
        </div>
      </div>
    </div>


  )
}
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