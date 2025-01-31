import styles from '../Register/Register.module.css';
import PropTypes from 'prop-types';

const StablishmentRegisterForm = ({ data, updateFieldHandler }) => {
  return (
    <div>
      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor='stablishment'>Nome do estabelecimento</span>
          <div className={styles.inputWrapper}>
            <input
            type='text'
            name='stablishment'
            id='stablishment'
            placeholder='Nome do estabelecimento'
            value={data.stablishmentName || ""}
            onChange={(e) => updateFieldHandler("stablishmentName", e.target.value)}
            required
            />
          </div>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor='email'>Telefone</span>
          <div className={styles.inputWrapper}>
            <input
            type="tel"
            id="phone"
            name="phone"
            pattern="(\(?\d{2}\)?\s?)?\d{5}-?\d{4}"
            placeholder="(99)99999-9999"
            value={data.phone || ""}
            onChange={(e) => updateFieldHandler("phone", e.target.value)}
            required
            />
          </div>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor='cep'>CEP</span>
          <div className={styles.inputWrapper}>
            <input
            type="text"
            id="cep"
            name="cep"
            pattern="\d{5}-?\d{3}"
            placeholder="12345-678"
            value={data.cep || ""}
            onChange={(e) => updateFieldHandler("cep", e.target.value)}
            required
            />
          </div>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor='address'>Endereço</span>
          <div className={styles.inputWrapper}>
            <input
            type='text'
            name='address'
            id='address'
            placeholder='Insira o endereço'
            value={data.address || ""}
            onChange={(e) => updateFieldHandler("address", e.target.value)}
            required
            />
          </div>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor='city'>Cidade</span>
          <div className={styles.inputWrapper}>
            <input
            type='text'
            name='city'
            id='city'
            placeholder='Insira a cidade'
            value={data.city || ""}
            onChange={(e) => updateFieldHandler("city", e.target.value)}
            required
            />
          </div>
        </div>
      </div>

    </div>
  )
}
StablishmentRegisterForm.propTypes = {
  data: PropTypes.shape({
    stablishmentName: PropTypes.string,
    phone: PropTypes.string,
    cep: PropTypes.string,
    address: PropTypes.string,
    city: PropTypes.string,
  }).isRequired,
  updateFieldHandler: PropTypes.func.isRequired,
};

export default StablishmentRegisterForm;