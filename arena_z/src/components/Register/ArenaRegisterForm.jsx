import styles from '../Register/ArenaRegisterForm.module.css';
import { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRegisterArena } from './hooks/registerArenaHook';
import URLS from '../routes/routes';


const url = URLS.REGISTER_ARENA;

const ArenaRegisterForm = () => {
  const location = useLocation();
  const  est_id  = location.state || {}; 
  const [arenaName, setArenaName] = useState('');
  const [arenaPrice, setArenaPrice] = useState('');
  const [arenaCategory, setArenaCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
 
  
  const { registerArena, loading, error } = useRegisterArena(url);  // Chame o hook no nível superior
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const arena = {
      are_name: arenaName,
      are_price: arenaPrice,
      are_category: arenaCategory,
      usr_cod_cad: 3,
      est_id: est_id,
    };

    // Envia a arena para a API
    const { res, jsonData } = await registerArena(arena);  
  
    if (res.ok) {
      setShowModal(true);
    } else {
      console.error('Erro ao registrar arena:', jsonData);
    }
  };
  

  return (
    <>
      <h2 className={styles.arenaRegisterTitle}>Adicionar nova Arena</h2>
      <p className={styles.arenaRegisterParagraph}>Por favor, preencha os campos com os dados de sua nova Arena</p>
      <form onSubmit={handleSubmit}>
        <div className={styles.contentWrapper}>
          <h3 className={styles.arenaRegisterSubtitle}>Informações gerais</h3>
          <div className={styles.formContainer}>
            <div className={styles.inputContainer}>
              <span htmlFor="arenaName">Nome da Arena</span>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  name="arenaName"
                  id="arenaName"
                  placeholder="Nome da Arena"
                  value={arenaName || ""}
                  onChange={(e) => setArenaName(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className={styles.formContainer}>
            <div className={styles.inputContainer}>
              <span htmlFor="arenaPrice">Preço/hora</span>
              <div className={styles.inputWrapper}>
                <input
                  type="number"
                  name="arenaPrice"
                  id="arenaPrice"
                  placeholder="Preço"
                  value={arenaPrice || ""}
                  onChange={(e) => setArenaPrice(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <h3 className={styles.arenaRegisterSubtitle}>Categoria</h3>
          <div className={styles.radioContainer}>
            <div className={styles.radioItem}>
              <input
                type="radio"
                id="society"
                name="category"
                value="society"
                required
                onChange={(e) => setArenaCategory(e.target.value)}
              />
              <label htmlFor="society">Society</label>
            </div>
            <div className={styles.radioItem}>
              <input
                type="radio"
                id="beachSports"
                name="category"
                value="beachSports"
                required
                onChange={(e) => setArenaCategory(e.target.value)}
              />
              <label htmlFor="beachSports">Beach Sports</label>
            </div>
            <div className={styles.radioItem}>
              <input
                type="radio"
                id="tennis"
                name="category"
                value="tennis"
                required
                onChange={(e) => setArenaCategory(e.target.value)}
              />
              <label htmlFor="tennis">Tênis</label>
            </div>
            <div className={styles.radioItem}>
              <input
                type="radio"
                id="other"
                name="category"
                value="other"
                required
                onChange={(e) => setArenaCategory(e.target.value)}
              />
              <label htmlFor="other">Outra</label>
            </div>
          </div>

          <div className={styles.actionButtonContainer}>
            {loading && (
              <button className="primaryButton" type="submit" disabled>
                Criando...
              </button>
            )}
            {!loading && (
              <button className="primaryButton" type="submit">
                Criar nova Arena
              </button>
            )}
          </div>
        </div>
      </form>

      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Arena criada com sucesso!</h2>
            <p className={styles.modalSubtitle}>Você pode retornar para a tela principal.</p>
            <button
              className='primaryButton'
              onClick={() => {
                navigate('/home/dashboard');
                setShowModal(false);
              }}
            >
              Ir para o Dashboard
            </button>
          </div>
        </div>
      )}
    </>
  );
};

ArenaRegisterForm.propTypes = {
    arenaName: PropTypes.string,
    arenaPrice: PropTypes.string,
    arenaCategory: PropTypes.string,
};

export default ArenaRegisterForm;
