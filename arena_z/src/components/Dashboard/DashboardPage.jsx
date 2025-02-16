import Button from '../../components/Button';
import styles from '../Dashboard/DashboardPage.module.css';
import ArenaCard from './ArenaCard';
import Modal from 'react-modal';
import { Link } from 'react-router-dom';
import { useDashboardHooks } from './hooks/DashboardHooks'; // Atualize para o nome correto do hook
import { useState } from 'react';
import PropTypes from 'prop-types';
import URLS from '../routes/routes';

const url = URLS.LOAD_DASHBOARD;

const DashboardPage = ({ isExpiredSession, setIsExpiredSession }) => {
  const { data: arenas, loading, error } = useDashboardHooks(url, 'GET'); // Pega os dados de arenas a partir do hook

  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  const closeModal = () => {
    setModalIsOpen(false);
  }

  
  return (
    <div className={styles.dashboardMainContent}>
      <div>
        <p>bem vindo rafael</p>
        <select name="" id=""><option value="">estab1</option>
          <option value="estab2">estab2</option></select>

        <div className={styles.actionButtonContainer}>
          <h2>Minhas Arenas</h2>
          <Link to='../new-arena'>
            <Button text='+ Nova arena' className='secondaryButton' />
          </Link>
        </div>

        {/* Verificação de carregamento e erro */}
        {loading ? (
          <p>Carregando...</p>
        ) : error ? (
          <p className={styles.errorMessage}>Erro ao carregar arenas: {error}</p>
        ) : arenas && arenas.length === 0 ? (
          <p className={styles.noArenasMessage}>Você ainda não tem nenhuma Arena cadastrada. Adicione uma nova!</p>
        ) : (
          <div className={styles.cardsContainer}>
            {arenas && arenas.map((arena) => (
              <ArenaCard
                key={arena.id}
                arenaName={arena.arenaName}
                arenaCategory={arena.arenaCategory}
                arenaPrice={arena.arenaPrice}
                goToReservation={`/reservations/${arena.id}`}
              />
            ))}
          </div>
        )}
      </div>

      <h2>Reservas ativas</h2>
      <div className={styles.reservationStatusContainer}>
        {arenas && arenas.length > 0 && (
          <>
            <div className={styles.reservationIndicator}>
              <p className={styles.valueTitle}>Total de reservas</p>
              <p className={styles.reservationValue}>18</p>
            </div>
            <div className={styles.reservationIndicator}>
              <p className={styles.valueTitle}>Valor recebido</p>
              <p className={styles.reservationValue}>R$ 1500,00</p>
            </div>
            <div className={styles.reservationIndicator}>
              <p className={styles.valueTitle}>Valor a receber</p>
              <p className={styles.reservationValue}>R$ 300,00</p>
            </div>
          </>
        )}

        {arenas && arenas.length === 0 && (
          <p className={styles.noReservationsMessage}>Você ainda não tem reservas ativas.</p>
        )}
      </div>

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="Resultado do Cadastro"
        className={styles.modal}
        overlayClassName={styles.modalOverlay}
      >
        <div className={styles.modalContent}>
          <h2 className={styles.header}>{isExpiredSession ? "Sucesso" : "Erro"}</h2>
          <p>{modalMessage}</p>
          {isExpiredSession ? (
            <div className={styles.modalActions}>
              <Link to="/login" className='primaryButton'>
                Ir para Login
              </Link>
            </div>

          ) : (
            <div className={styles.modalActions}>
              <button onClick={closeModal} className='primaryButton'>Fechar</button>
            </div>
          )}
        </div>

      </Modal>
    </div>
  );
}

DashboardPage.propTypes = {
  isExpiredSession: PropTypes.bool,
  setIsExpiredSession: PropTypes.func,
};

export default DashboardPage;
