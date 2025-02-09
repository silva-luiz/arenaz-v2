import Button from '../../components/Button';
import styles from '../Dashboard/DashboardPage.module.css';
import ArenaCard from './ArenaCard';
import Modal from 'react-modal';
import { Link } from 'react-router-dom';
import { useFetch } from '../Register/hooks/useFetch';
import { useState } from 'react';
import PropTypes from 'prop-types';

const url = 'http://localhost:3000/arenas';

const DashboardPage = ({ isExpiredSession, setIsExpiredSession }) => {
  const { data: arenas } = useFetch(url);

  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");


  const closeModal = () => {
    setModalIsOpen(false);
}

  return (
    <div>
      <h2>Minhas Arenas</h2>
      <div>
        <div className={styles.actionButtonContainer}>
          <Link to='../new-arena'>
            <Button text='+ Nova arena' className='secondaryButton' />
          </Link>
          <Button text='+ Nova reserva' className='primaryButton' />
        </div>

        {/* Condicional para verificar se não há arenas */}
        {arenas && arenas.length === 0 ? (
          <p className={styles.noArenasMessage}>Você ainda não tem nenhuma Arena cadastrada. Adicione uma nova!</p>
        ) : (
          <div className={styles.cardsContainer}>
            {arenas && arenas.map((arena) => (
              <ArenaCard
                key={arena.id}
                arenaName={arena.arenaName}
                arenaCategory={arena.arenaCategory}
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
  isExpiredSession: PropTypes.bool.isRequired,
  setIsExpiredSession: PropTypes.func.isRequired,
};

export default DashboardPage;
