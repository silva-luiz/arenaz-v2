'use client';
import Button from '../Button';
import styles from '../Dashboard/DashboardPage.module.scss';
import Modal from 'react-modal';
import { useDashboardHooks } from '../../hooks/useDashboardHooks';
import { useState } from 'react';
import URLS from '../../utils/apiRoutes';
import Link from 'next/link';
import ArenaCard from 'components/Dashboard/ArenaCard';

const url = URLS.LOAD_DASHBOARD;

interface IAllArenasPageProps {
  isExpiredSession?: boolean;
  setIsExpiredSession?: () => void;
}

const AllArenasPage = ({
  isExpiredSession,
  setIsExpiredSession,
}: IAllArenasPageProps) => {
  const {
    data: dashboardData,
    loading,
    error,
  } = useDashboardHooks({ url, method: 'GET' });

  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const arenas = dashboardData?.arenas ?? [];

  const closeModal = () => {
    setModalIsOpen(false);
  };
  return (
    <div className={styles.dashboardMainContent}>
      <div>
        <div className={styles.actionButtonContainer}>
          <h2 className={styles.dashboardTitle}>Todas as Arenas</h2>
          <Link
            href={{
              pathname: 'new-arena',
            }}
            >
            <Button text="+ Nova arena" className="secondaryButton" />
          </Link>
        </div>
            <p className={styles.subtitle}>Listagem completa de todas as Arenas de seu estabelecimento</p>

        {/* Verificação de carregamento e erro */}
        {loading ? (
          <p>Carregando...</p>
        ) : error ? (
          <p className={styles.errorMessage}>
            Erro ao carregar arenas: {error}
          </p>
        ) : dashboardData && arenas.length === 0 ? (
          <p className={styles.noArenasMessage}>
            Você ainda não tem nenhuma Arena cadastrada. Adicione uma nova!
          </p>
        ) : (
          <div className={styles.cardsContainer}>
            {dashboardData &&
              arenas.map((arena, index) => (
                <ArenaCard
                  key={`${index}-${arena.are_id} `}
                  arenaName={arena.are_name}
                  arenaCategory={arena.are_category}
                  arenaPrice={arena.are_price}
                  goToReservation={`/reservations/arena/${arena.are_id}`}
                />
              ))}
          </div>
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
          <h2 className={styles.header}>
            {isExpiredSession ? 'Sucesso' : 'Erro'}
          </h2>
          <p>{modalMessage}</p>
          {isExpiredSession ? (
            <div className={styles.modalActions}>
              <Link href="/login" className="primaryButton">
                Ir para Login
              </Link>
            </div>
          ) : (
            <div className={styles.modalActions}>
              <button onClick={closeModal} className="primaryButton">
                Fechar
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default AllArenasPage;
