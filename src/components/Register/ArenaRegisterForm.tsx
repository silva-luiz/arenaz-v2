import styles from './ArenaRegisterForm.module.scss';
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useRegisterArena } from '../../hooks/useRegisterArena';
import { useFetchEstablishmentInfo } from '../../hooks/useFetchEstablishmentInfo';
import URLS from '../../utils/apiRoutes';
import { useRouter } from 'next/navigation';
import { CircularProgress } from '@mui/material';

const url = URLS.REGISTER_ARENA;

const ArenaRegisterForm = () => {
  // const location = useLocation();

  const { data } = useFetchEstablishmentInfo(
    URLS.ESTABLISHMENT_INFO,
  );

  const [arenaName, setArenaName] = useState('');
  const [arenaPrice, setArenaPrice] = useState('');
  const [arenaCategory, setArenaCategory] = useState('');
  const [showModal, setShowModal] = useState(false);

  const { registerArena, loading, error } = useRegisterArena(url);
  const router = useRouter();

  const est_id = data ? data.est_id : null;

  useEffect(() => {
    console.log('📡 establishmentInfo:', est_id);
    console.log('🧯 loading:', loading);
    console.log('💥 error:', error);
  }, [data, loading, error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!est_id) {
      console.error('Establishment ID não disponível');
      return;
    }
    console.log('URL de fetch:', URLS.ESTABLISHMENT_INFO);

    const userId = data.usr_id;

    const arena = {
      are_name: arenaName,
      are_price: arenaPrice,
      are_category: arenaCategory,
      usr_cod_cad: userId,
      est_id: est_id,
    };

    // Envia a arena para a API
    const { res, jsonData } = await registerArena(arena);

    if (res.ok) {
      setShowModal(true);
    } else {
      setShowModal(true);
      console.error('Erro ao registrar arena:', jsonData);
    }
  };

  return (
    <>
      <h2 className={styles.arenaRegisterTitle}>Adicionar nova Arena</h2>
      <p className={styles.arenaRegisterParagraph}>
        Por favor, preencha os campos com os dados de sua nova Arena
      </p>
      <form onSubmit={handleSubmit}>
        <div className={styles.contentWrapper}>
          <h3 className={styles.arenaRegisterSubtitle}>Informações gerais</h3>
          <div className={styles.formContainer}>
            <div className={styles.inputContainer}>
              <label htmlFor="arenaName" className={styles.inputLabel}>
                Nome da Arena
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  name="arenaName"
                  id="arenaName"
                  placeholder="Nome da Arena"
                  value={arenaName || ''}
                  onChange={(e) => setArenaName(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className={styles.formContainer}>
            <div className={styles.inputContainer}>
              <label htmlFor="arenaPrice" className={styles.inputLabel}>
                Preço/hora
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="number"
                  name="arenaPrice"
                  id="arenaPrice"
                  placeholder="Preço"
                  value={arenaPrice || ''}
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
                value="Society"
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
                value="Beach Sports"
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
                value="Tênis"
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
                value="Outra"
                required
                onChange={(e) => setArenaCategory(e.target.value)}
              />
              <label htmlFor="other">Outra</label>
            </div>
          </div>

          <div className={styles.actionButtonContainer}>
            {loading && (
              <button className="primaryButton" type="submit" disabled>
                <CircularProgress color="inherit" size="20px"/>
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
            <p className={styles.modalSubtitle}>
              Você pode retornar para a tela principal.
            </p>
            <button
              className="primaryButton"
              onClick={() => {
                router.push('/home/dashboard');
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
