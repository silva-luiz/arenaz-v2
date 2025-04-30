'use client';
import styles from '../Dashboard/DashboardPage.module.scss';
import ArenaCard from './ArenaCard';
import Modal from 'react-modal';
import { useDashboardHooks } from '../../hooks/useDashboardHooks';
import { useState } from 'react';
import URLS from '../../utils/apiRoutes';
import Link from 'next/link';
import Button from 'components/Button';
import WarningIcon from '@mui/icons-material/Warning';
import { CircularProgress } from '@mui/material';

const url = URLS.LOAD_DASHBOARD;

interface IDashboardPageProps {
  isExpiredSession?: boolean;
  setIsExpiredSession?: () => void;
}

const DashboardPage = ({
  isExpiredSession,
  setIsExpiredSession,
}: IDashboardPageProps) => {
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
          <h2 className={styles.dashboardTitle}>Minhas Arenas</h2>
          <Link
            href={{
              pathname: 'new-arena',
            }}
          >
            <Button text="+ Nova arena" className="secondaryButton" />
          </Link>
        </div>

        {/* Verificação de carregamento e erro */}
        {loading ? (
          <div>
            <CircularProgress color="warning" />
            <p>Carregando dados...</p>
          </div>
        ) : error ? (
          <p className={styles.errorMessage}>
            Erro ao carregar arenas: {error}
          </p>
        ) : dashboardData && arenas.length === 0 ? (
          <div className={styles.noArenasContainer}>
          <WarningIcon style={{ color: 'orange', fontSize: 48 }} />
          <p className={styles.noArenasMessage}>
            Você ainda não tem nenhuma Arena cadastrada. Adicione uma nova!
          </p>
        </div>
        ) : (
          <div className={styles.cardsContainer}>
            {dashboardData &&
              arenas.slice(0, 5).map((arena, index) => (
                <ArenaCard
                  key={`${index}-${arena.are_id} `}
                  arenaName={arena.are_name}
                  arenaCategory={arena.are_category}
                  arenaPrice={arena.are_price}
                  goToReservation={`/reservations/arena/${arena.are_id}`}
                />
              ))}
            {arenas.length > 5 && (
              <div className={styles.seeAllButtonContainer}>
                <Link href="/home/all-arenas">
                  <Button text="Ver todas" className="secondaryButton" />
                </Link>
              </div>
            )}
          </div>
        )}

      </div>

      <h2 className={styles.dashboardTitle}>Reservas ativas</h2>
      <div className={styles.reservationStatusContainer}>
        {dashboardData && arenas.length > 0 && (
          <>
            <div className={styles.reservationIndicator}>
              <p className={styles.valueTitle}>Total de reservas</p>
              <p className={styles.reservationValue}>
                {dashboardData.indicators.total_reservations}
              </p>
            </div>
            <div className={styles.reservationIndicator}>
              <p className={styles.valueTitle}>Valor recebido</p>
              <p className={styles.receivedValue}>
                R$ {dashboardData.indicators.total_received},00
              </p>
            </div>
            <div className={styles.reservationIndicator}>
              <p className={styles.valueTitle}>Valor a receber</p>
              <p className={styles.overdueValue}>
                R$ {dashboardData.indicators.total_pending},00
              </p>
            </div>
          </>
        )}

        {dashboardData && arenas.length === 0 && (
          <p className={styles.noReservationsMessage}>
            Você ainda não tem reservas ativas.
          </p>
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

export default DashboardPage;
