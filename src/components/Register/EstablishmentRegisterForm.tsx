import styles from '../Register/Register.module.scss';
import PropTypes from 'prop-types';

const EstablishmentRegisterForm = ({ data, updateFieldHandler }) => {
  return (
    <div>
      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <label htmlFor="establishment" className={styles.inputLabel}>
            Nome do estabelecimento
          </label>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              name="establishment"
              id="establishment"
              placeholder="Nome do estabelecimento"
              value={data.establishmentName || ''}
              onChange={(e) =>
                updateFieldHandler('establishmentName', e.target.value)
              }
              required
            />
          </div>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <label htmlFor="phone" className={styles.inputLabel}>
            Telefone
          </label>
          <div className={styles.inputWrapper}>
            <input
              type="tel"
              id="phone"
              name="phone"
              pattern="(\(?\d{2}\)?\s?)?\d{5}-?\d{4}"
              placeholder="(99)99999-9999"
              value={data.establishmentPhone || ''}
              onChange={(e) =>
                updateFieldHandler('establishmentPhone', e.target.value)
              }
              required
            />
          </div>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <label htmlFor="cep" className={styles.inputLabel}>
            CEP
          </label>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              id="cep"
              name="cep"
              pattern="\d{5}-?\d{3}"
              placeholder="12345-678"
              value={data.establishmentCep || ''}
              onChange={(e) =>
                updateFieldHandler('establishmentCep', e.target.value)
              }
              required
            />
          </div>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <label htmlFor="address" className={styles.inputLabel}>
            Endereço
          </label>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              name="address"
              id="address"
              placeholder="Insira o endereço"
              value={data.establishmentAddress || ''}
              onChange={(e) =>
                updateFieldHandler('establishmentAddress', e.target.value)
              }
              required
            />
          </div>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <label htmlFor="city" className={styles.inputLabel}>
            Cidade
          </label>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              name="city"
              id="city"
              placeholder="Insira a cidade"
              value={data.establishmentCity || ''}
              onChange={(e) =>
                updateFieldHandler('establishmentCity', e.target.value)
              }
              required
            />
          </div>
        </div>
      </div>
    </div>
  );
};
EstablishmentRegisterForm.propTypes = {
  data: PropTypes.shape({
    establishmentName: PropTypes.string,
    establishmentPhone: PropTypes.string,
    establishmentCep: PropTypes.string,
    establishmentAddress: PropTypes.string,
    establishmentCity: PropTypes.string,
  }).isRequired,
  updateFieldHandler: PropTypes.func.isRequired,
};

export default EstablishmentRegisterForm;
