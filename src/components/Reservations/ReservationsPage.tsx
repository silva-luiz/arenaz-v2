'use client';
import Table from 'react-bootstrap/Table';
import styles from '../Reservations/ReservationsPage.module.scss';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';
import URLS from 'utils/apiRoutes';
import { useFetchReservations } from 'hooks/useFetchReservations';
import { useDeleteReservation } from 'hooks/useDeleteReservation';
import Link from 'next/link';
import WarningIcon from '@mui/icons-material/Warning';
import { CircularProgress } from '@mui/material';

import * as React from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';

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
  const [reservationPlayerNames, setReservationPlayerNames] = useState<
    string[]
  >([]);
  const [reservationPhones, setReservationPhones] = useState<string[]>([]);
  const [reservationDates, setReservationDates] = useState<string[]>([]);
  const [reservationValues, setReservationValues] = useState<number[]>([]);
  const [paymentAdvanceValues, setPaymentAdvanceValues] = useState<number[]>(
    [],
  );
  const [reservationIds, setReservationIds] = useState<number[]>([]);
  const [reservationStartTime, setReservationStartTime] = useState<string[]>(
    [],
  );
  const [reservationEndTime, setReservationEndTime] = useState<string[]>([]);
  const [reservationArenaNames, setReservationArenaNames] = useState<string[]>(
    [],
  );
  const [reservationArenaCategories, setReservationArenaCategories] = useState<
    string[]
  >([]);

  const { data, loadingReservations, error } =
    useFetchReservations(urlFetchReservations);

  const { deleteReservation: deleteReservationRequest, loadingDelete } =
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
        id: reserva.res_id,
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

  const router = useRouter();

  const handleDeleteClick = (reservation: any) => {
    setSelectedReservation(reservation);
    setModalMessage('Deseja excluir essa reserva?');
    setIsDeleteMode(true);
    setShowModal(true);
  };

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
  };

  const handleConfirmDelete = async () => {
    if (!selectedReservation) return;

    const { res, jsonData } = await deleteReservationRequest(
      selectedReservation.res_id,
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
                >
                  <Tab label="Reservas ativas" value="1" />
                  <Tab label="Reservas pendentes" value="2" />
                  <Tab label="Histórico de reservas" value="3" />
                </TabList>
              </Box>
              <TabPanel value="1">
                {' '}
                {activeReservations?.length > 0 ? (
                  <Table
                    striped
                    bordered
                    hover
                    variant="dark"
                    size="sm"
                    className={styles.customTable}
                  >
                    <thead>
                      <tr className={styles.tableHeaderRow}>
                        <th className={styles.tableHeader}>Arena</th>
                        <th className={styles.tableHeader}>Categoria</th>
                        <th className={styles.tableHeader}>Locador</th>
                        <th className={styles.tableHeader}>Contato</th>
                        <th className={styles.tableHeader}>Data</th>
                        <th className={styles.tableHeader}>Horário</th>
                        <th className={styles.tableHeader}>Valor</th>
                        <th className={styles.tableHeader}>Valor adiantado</th>
                        <th className={styles.tableHeader}>Editar</th>
                        <th className={styles.tableHeader}>Excluir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeReservations.map((reserva, index) => (
                        <tr key={index} className={styles.tableRow}>
                          <td className={styles.tableData}>{reserva.arena}</td>
                          <td className={styles.tableData}>
                            {reserva.category}
                          </td>
                          <td className={styles.tableData}>
                            {reserva.playerName}
                          </td>
                          <td className={styles.tableData}>{reserva.phone}</td>
                          <td className={styles.tableData}>
                            {reserva.date || 'Data não disponível'}
                          </td>
                          <td className={styles.tableData}>
                            {reserva.startTime} - {reserva.endTime}
                          </td>
                          <td className={styles.tableData}>
                            R$ {reserva.value || 'Valor não disponível'}
                          </td>
                          <td className={styles.tableData}>
                            R$ {reserva.paymentAdvance || 0}
                          </td>
                          <td className={styles.tableData}>
                            <Link
                              href={`/home/update-reservation/${reserva.res_id}`}
                            >
                              <FaEdit
                                className={styles.iconButton}
                                title="Editar"
                              />
                            </Link>
                          </td>
                          <td className={styles.tableData}>
                            <FaTrash
                              className={styles.iconButtonTrash}
                              onClick={() => handleDeleteClick(reserva)}
                              title="Cancelar"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <div className={styles.noReservationsContainer}>
                    <WarningIcon style={{ color: 'orange', fontSize: 48 }} />
                    <p className={styles.noReservationsMessage}>
                      Você ainda não tem reservas cadastradas.
                    </p>
                  </div>
                )}
              </TabPanel>
              <TabPanel value="2">
                <Table
                  striped
                  bordered
                  hover
                  variant="dark"
                  size="sm"
                  className={styles.customTable}
                >
                  <thead>
                    <tr className={styles.tableHeaderRow}>
                      <th className={styles.tableHeader}>Arena</th>
                      <th className={styles.tableHeader}>Categoria</th>
                      <th className={styles.tableHeader}>Locador</th>
                      <th className={styles.tableHeader}>Contato</th>
                      <th className={styles.tableHeader}>Data</th>
                      <th className={styles.tableHeader}>Horário</th>
                      <th className={styles.tableHeader}>Valor</th>
                      <th className={styles.tableHeader}>Valor adiantado</th>
                      <th className={styles.tableHeader}>Editar</th>
                      <th className={styles.tableHeader}>Excluir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingReservations.map((reserva, index) => (
                      <tr key={index} className={styles.tableRow}>
                        <td className={styles.tableData}>{reserva.arena}</td>
                        <td className={styles.tableData}>{reserva.category}</td>
                        <td className={styles.tableData}>
                          {reserva.playerName}
                        </td>
                        <td className={styles.tableData}>{reserva.phone}</td>
                        <td className={styles.tableData}>
                          {reserva.date || 'Data não disponível'}
                        </td>
                        <td className={styles.tableData}>
                          {reserva.startTime} - {reserva.endTime}
                        </td>
                        <td className={styles.tableData}>
                          R$ {reserva.value || 'Valor não disponível'}
                        </td>
                        <td className={styles.tableData}>
                          R$ {reserva.paymentAdvance || 0}
                        </td>
                        <td className={styles.tableData}>
                          <Link
                            href={`/home/update-reservation/${reserva.res_id}`}
                          >
                            <FaEdit
                              className={styles.iconButton}
                              title="Editar"
                            />
                          </Link>
                        </td>
                        <td className={styles.tableData}>
                          <FaTrash
                            className={styles.iconButtonTrash}
                            onClick={() => handleDeleteClick(reserva)}
                            title="Cancelar"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TabPanel>
              <TabPanel value="3">
                <Table
                  striped
                  bordered
                  hover
                  variant="dark"
                  size="sm"
                  className={styles.customTable}
                >
                  <thead>
                    <tr className={styles.tableHeaderRow}>
                      <th className={styles.tableHeader}>Arena</th>
                      <th className={styles.tableHeader}>Categoria</th>
                      <th className={styles.tableHeader}>Locador</th>
                      <th className={styles.tableHeader}>Contato</th>
                      <th className={styles.tableHeader}>Data</th>
                      <th className={styles.tableHeader}>Horário</th>
                      <th className={styles.tableHeader}>Valor</th>
                      <th className={styles.tableHeader}>Valor adiantado</th>
                      <th className={styles.tableHeader}>Editar</th>
                      <th className={styles.tableHeader}>Excluir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastReservations.map((reserva, index) => (
                      <tr key={index} className={styles.tableRow}>
                        <td className={styles.tableData}>{reserva.arena}</td>
                        <td className={styles.tableData}>{reserva.category}</td>
                        <td className={styles.tableData}>
                          {reserva.playerName}
                        </td>
                        <td className={styles.tableData}>{reserva.phone}</td>
                        <td className={styles.tableData}>
                          {reserva.date || 'Data não disponível'}
                        </td>
                        <td className={styles.tableData}>
                          {reserva.startTime} - {reserva.endTime}
                        </td>
                        <td className={styles.tableData}>
                          R$ {reserva.value || 'Valor não disponível'}
                        </td>
                        <td className={styles.tableData}>
                          R$ {reserva.paymentAdvance || 0}
                        </td>
                        <td className={styles.tableData}>
                          <Link
                            href={`/home/update-reservation/${reserva.res_id}`}
                          >
                            <FaEdit
                              className={styles.iconButton}
                              title="Editar"
                            />
                          </Link>
                        </td>
                        <td className={styles.tableData}>
                          <FaTrash
                            className={styles.iconButtonTrash}
                            onClick={() => handleDeleteClick(reserva)}
                            title="Cancelar"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TabPanel>
            </TabContext>
          </Box>
        </div>
      )}

      {/* Versão mobile: cards */}
      <div className={styles.mobileCardsContainer}>
        {data?.reservations?.map((reserva, index) => (
          <div key={index} className={styles.mobileCard}>
            <p>
              <strong>Arena:</strong> {reserva.arena}
            </p>
            <p>
              <strong>Categoria:</strong> {reserva.categoria}
            </p>
            <p>
              <strong>Locador:</strong> {reservationPlayerNames[index]}
            </p>
            <p>
              <strong>Contato:</strong> {reservationPhones[index]}
            </p>
            <p>
              <strong>Data:</strong>{' '}
              {reservationDates[index] || 'Data não disponível'}
            </p>
            <p>
              <strong>Horário:</strong> {reservationStartTime[index]} -{' '}
              {reservationEndTime[index]}
            </p>
            <p>
              <strong>Valor:</strong> R${' '}
              {reservationValues[index] || 'Valor não disponível'}
            </p>
            <p>
              <strong>Valor adiantado:</strong> R${' '}
              {paymentAdvanceValues[index] || 0}
            </p>
            <div className={styles.mobileActions}>
              <Link href={`/home/update-reservation/${reserva.res_id}`}>
                <FaEdit className={styles.iconButton} title="Editar" />
              </Link>
              <FaTrash
                className={styles.iconButton}
                onClick={() => handleDeleteClick(reserva)}
                title="Cancelar"
              />
            </div>
          </div>
        ))}
      </div>

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
