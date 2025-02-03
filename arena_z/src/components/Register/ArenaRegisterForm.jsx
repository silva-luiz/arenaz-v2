
import styles from '../Register/ArenaRegisterForm.module.css';
import PropTypes from 'prop-types';
import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch'


const url = 'http://localhost:3000/arenas'


const ArenaRegisterForm = () => {

  const [arenaName, setArenaName] = useState('');
  const [arenaPrice, setArenaPrice] = useState('');
  const [arenaCategory, setArenaCategory] = useState('');

  const { data: arenas, httpConfig, loading, error } = useFetch(url);


  const handleSubmit = async (e) => {
    e.preventDefault();

    const arena = {
      arenaName,
      arenaPrice,
      arenaCategory
    }

    httpConfig(arena, 'POST');

    // const res = await fetch(url, {
    //   method: 'POST',
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify(arena),
    // });

    // const addedArena = await res.json();

    // setArenaCategory((preventArenas) => [...preventArenas, addedArena]);
  }

  return (
    <>
      <h2 className={styles.arenaRegisterTitle}>Adicionar nova Arena</h2>
      <p className={styles.arenaRegisterParagraph}>Por favor, preencha os campos com os dados de sua nova Arena</p>
      <form onSubmit={handleSubmit}>
        <div className={styles.contentWrapper}>
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
                  value={arenaName}
                  onChange={(e) => setArenaName(e.target.value)}
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
                  value={arenaPrice}
                  onChange={(e) => setArenaPrice(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
          <h3 className={styles.arenaRegisterSubtitle}>Categoria</h3>
          <div className={styles.radioContainer}>
            <div className={styles.radioItem}>
              <input type="radio" id="society" name="category" value="society" required onChange={(e) => setArenaCategory(e.target.value)} />
              <label htmlFor="society">Society</label>
            </div>
            <div className={styles.radioItem}>
              <input type="radio" id="beachSports" name="category" value="beachSports" required onChange={(e) => setArenaCategory(e.target.value)} />
              <label htmlFor="beachSports">Beach Sports</label>
            </div>
            <div className={styles.radioItem}>
              <input type="radio" id="tennis" name="category" value="tennis" required onChange={(e) => setArenaCategory(e.target.value)} />
              <label htmlFor="tennis">Tênis</label>
            </div>
            <div className={styles.radioItem}>
              <input type="radio" id="other" name="category" value="other" required onChange={(e) => setArenaCategory(e.target.value)} />
              <label htmlFor="other">Outra</label>
            </div>
          </div>
          <div className={styles.actionButtonContainer}>
            {loading && <button className='primaryButton' type='submit' disabled>Criando...</button>}
            {!loading && <button className='primaryButton' type='submit'>Criar nova Arena</button>}
          </div>
        </div>
      </form>
    </>

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