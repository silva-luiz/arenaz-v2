'use client';
import styles from '../Reservations/ReservationsPage.module.scss';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import URLS from 'utils/apiRoutes';
import { useFetchReservations } from 'hooks/useFetchReservations';
import { useDeleteReservation } from 'hooks/useDeleteReservation';
import { CircularProgress } from '@mui/material';

import * as React from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import ReservationsTable from 'components/ReservationTable/ReservationTable';
import ReservationsCardList from 'components/ReservationsCardList/ReservationsCardList';

const urlFetchReservations = URLS.GET_RESERVATIONS;
const urlDeleteReservation = URLS.DELETE_RESERVATION;

interface IReservationsPageProps {
  isExpiredSession?: boolean;
  setIsExpiredSession?: () => void;
}

const ReservationsPage = ({
  isExpiredSession,
  setIsExpiredSession,
}: IReservationsPageProps) => {
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [value, setValue] = React.useState('1');

  const { data, loadingReservations } =
    useFetchReservations(urlFetchReservations);

  const { deleteReservation: deleteReservationRequest } =
    useDeleteReservation(urlDeleteReservation);

  const [activeReservations, setActiveReservations] = useState([]);
  const [pendingReservations, setPendingReservations] = useState([]);
  const [pastReservations, setPastReservations] = useState([]);

  useEffect(() => {
    const processReservations = (reservations) => {
      if (!reservations) return null;

      return reservations.map((reserva) => ({
        playerName: reserva.res_player_name,
        phone: reserva.res_cel_phone,
        date: reserva.res_date,
        value: reserva.res_value,
        paymentAdvance: reserva.res_payment_advance,
        res_id: reserva.res_id,
        arena: reserva.are_name,
        category: reserva.are_category,
        startTime: reserva.res_start_time,
        endTime: reserva.res_end_time,
      }));
    };

    if (data) {
      setActiveReservations(processReservations(data.active_reservations));
      setPendingReservations(processReservations(data.pending_reservations));
      setPastReservations(processReservations(data.reservations));
    }
  }, [data]);

  const handleDeleteClick = (reservation: any) => {
    setSelectedReservation(reservation);
    console.log('Reserva selecionada para exclusão:', reservation.res_id); // Aqui deve ser res_id, não id
    setModalMessage('Deseja excluir essa reserva?');
    setIsDeleteMode(true);
    setShowModal(true);
  };

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
  };

  const handleConfirmDelete = async () => {
    if (!selectedReservation) return;

    console.log('ID da reserva para exclusão:', selectedReservation.res_id); // Acessando res_id aqui

    const { res, jsonData } = await deleteReservationRequest(
      selectedReservation.res_id, // Passando o res_id
    );

    console.log('Resposta da API:', res, jsonData);

    if (res && res.ok) {
      setModalMessage('Reserva excluída com sucesso!');
      setShowModal(true);
      window.location.reload();
    } else {
      setModalMessage(
        jsonData?.message ||
          'Erro ao excluir a reserva. Tente novamente mais tarde.',
      );
      setShowModal(true);
    }

    setShowModal(false);
  };

  const confirmCancel = () => {
    setShowModal(false);
    setModalMessage('Reserva cancelada com sucesso!');
    setTimeout(() => {
      setModalMessage('');
      setSelectedReservation(null);
    }, 2000);
  };

  return (
    <>
      <h2 className={styles.reservationsTitle}>Reservas</h2>
      <p className={styles.reservationsSubtitle}>
        Confira aqui as informações de todas as suas reservas.
      </p>
      {/* Tabela desktop */}
      {loadingReservations ? (
        <div className={styles.loadingContainer}>
          <CircularProgress color="warning" />
          <p className={styles.loadingText}>Carregando reservas...</p>
        </div>
      ) : (
        <div className={styles.tableResponsive}>
          <Box sx={{ width: '100%', typography: 'body1' }}>
            <TabContext value={value}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <TabList
                  onChange={handleChange}
                  aria-label="reservations"
                  centered
                  textColor="inherit"
                  indicatorColor="primary"
                >
                  <Tab label="Reservas ativas" value="1" />
                  <Tab label="Reservas pendentes" value="2" />
                  <Tab label="Histórico de reservas" value="3" />
                </TabList>
              </Box>
              <TabPanel value="1">
                {' '}
                <p className={styles.reservationsSubtitle}>
                  Aqui são listadas todas as reservas ativas, ou seja, que ainda
                  estão em andamento.
                </p>
                <ReservationsTable
                  reservationStatus={activeReservations}
                  handleDeleteClick={handleDeleteClick}
                  emptyMessage="Você ainda não tem reservas ativas."
                />
              </TabPanel>
              <TabPanel value="2">
                <p className={styles.reservationsSubtitle}>
                  Aqui são listadas todas as reservas pendentes, ou seja,
                  reservas que ainda existe parte do pagamento em aberto.
                </p>
                <ReservationsTable
                  reservationStatus={pendingReservations}
                  handleDeleteClick={handleDeleteClick}
                  emptyMessage="Você ainda não tem reservas pendentes."
                />
              </TabPanel>

              <TabPanel value="3">
                <p className={styles.reservationsSubtitle}>
                  Aqui são listadas todas as reservas finalizadas, ou seja, com
                  pagamento integral concluído e com a utilização do espaço já
                  realizada.
                </p>
                <ReservationsTable
                  reservationStatus={pastReservations}
                  handleDeleteClick={handleDeleteClick}
                  emptyMessage="Você ainda não tem reservas em seu histórico."
                />
              </TabPanel>
            </TabContext>
          </Box>
        </div>
      )}

      {/* Versão mobile: cards */}
      <h2 className={styles.reservationsCategory}>Reservas ativas</h2>
      {activeReservations.length > 0 ? (
        <ReservationsCardList
          reservations={activeReservations}
          title="Reservas Ativas"
          handleDeleteClick={handleDeleteClick}
        />
      ) : (
        <p className={styles.emptyMessage}>Nenhuma reserva ativa encontrada.</p>
      )}

      <h2 className={styles.reservationsCategory}>Reservas pendentes</h2>
      {pendingReservations.length > 0 ? (
        <ReservationsCardList
          reservations={pendingReservations}
          title="Reservas Pendentes"
          handleDeleteClick={handleDeleteClick}
        />
      ) : (
        <p className={styles.emptyMessage}>
          Nenhuma reserva pendente encontrada.
        </p>
      )}

      <h2 className={styles.reservationsCategory}>Histórico de reservas</h2>
      {pastReservations.length > 0 ? (
        <ReservationsCardList
          reservations={pastReservations}
          title="Reservas Passadas"
          handleDeleteClick={handleDeleteClick}
        />
      ) : (
        <p className={styles.emptyMessage}>
          Nenhum histórico de reserva encontrado.
        </p>
      )}

      {/* Modal de cancelamento */}
      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>{modalMessage}</h2>
            {isDeleteMode &&
              modalMessage === 'Deseja excluir essa reserva?' && (
                <div className={styles.modalActions}>
                  <p className={styles.modalSubtitle}>
                    Essa ação não poderá ser desfeita
                  </p>
                  <button className="outlinedButton" onClick={confirmCancel}>
                    Voltar
                  </button>
                  <button
                    className="primaryButton"
                    onClick={async () => {
                      handleConfirmDelete();
                    }}
                  >
                    Confirmar
                  </button>
                </div>
              )}

            {isDeleteMode &&
              modalMessage === 'Reserva excluída com sucesso!' && (
                <>
                  <p className={styles.modalSubtitle}>
                    A reserva foi cancelada.
                  </p>
                  <button
                    className="primaryButton"
                    onClick={() => setShowModal(false)}
                  >
                    Fechar
                  </button>
                </>
              )}
          </div>
        </div>
      )}
    </>
  );
};

export default ReservationsPage;
