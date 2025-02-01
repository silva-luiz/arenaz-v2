
import styles from '../Register/Register.module.css';
import PropTypes from 'prop-types';

const ArenaRegisterForm = ({ data, updateFieldHandler }) => {
  return (
    <div>
      <h2 className={styles.arenaRegisterTitle}>Adicionar nova Arena</h2>
      <p className={styles.arenaRegisterParagraph}>Por favor, preencha os campos com os dados de sua nova Arena</p>
      <h3 className={styles.arenaRegisterSubtitle}>Informações gerais</h3>
      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor='arenaName'>Nome da Arena</span>
          <div className={styles.inputWrapper}>
            <input
              type='text'
              name='arenaName'
              id='arenaName'
              placeholder='Nome da Arena'
              value={data.arenaName || ""}
              onChange={(e) => updateFieldHandler("arenaName", e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.inputContainer}>
          <span htmlFor='arenaPrice'>Preço/hora</span>
          <div className={styles.inputWrapper}>
            <input
              type='number'
              name='arenaPrice'
              id='arenaPrice'
              placeholder='Preço'
              value={data.arenaPrice || ""}
              onChange={(e) => updateFieldHandler("arenaPrice", e.target.value)}
              required
            />
          </div>
        </div>
      </div>
      <h3 className={styles.arenaRegisterSubtitle}>Categoria</h3>
      <div className={styles.radioContainer}>
        <div className={styles.radioItem}>
          <input type="radio" id="society" name="category" value="society" checked={data.arenaCategory === 'society'} required onChange={(e) => updateFieldHandler("arenaCategory", e.target.value)} />
          <label htmlFor="society">Society</label>
        </div>
        <div className={styles.radioItem}>
          <input type="radio" id="beachSports" name="category" value="beachSports" required checked={data.arenaCategory === 'beachSports'} onChange={(e) => updateFieldHandler("arenaCategory", e.target.value)} />
          <label htmlFor="beachSports">Beach Sports</label>
        </div>
        <div className={styles.radioItem}>
          <input type="radio" id="tennis" name="category" value="tennis" required checked={data.arenaCategory === 'tennis'} onChange={(e) => updateFieldHandler("arenaCategory", e.target.value)} />
          <label htmlFor="tennis">Tênis</label>
        </div>
        <div className={styles.radioItem}>
          <input type="radio" id="other" name="category" value="other" required checked={data.arenaCategory === 'other'} onChange={(e) => updateFieldHandler("arenaCategory", e.target.value)} />
          <label htmlFor="other">Outra</label>
        </div>
      </div>
    </div>
  )
}

ArenaRegisterForm.propTypes = {
  data: PropTypes.shape({
    arenaName: PropTypes.string,
    arenaPrice: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    arenaCategory: PropTypes.string,
  }).isRequired,
  updateFieldHandler: PropTypes.func.isRequired,
};

export default ArenaRegisterForm;