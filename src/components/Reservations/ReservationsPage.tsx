'use client';
import Table from 'react-bootstrap/Table';
import styles from '../Reservations/ReservationsPage.module.scss';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';
import URLS from 'utils/apiRoutes';
import { useFetchReservations } from 'hooks/useFetchReservations';
import { useDeleteReservation } from 'hooks/useDeleteReservation';

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
  const [isEditMode, setIsEditMode] = useState(false);

  const [reservationPlayerNames, setReservationPlayerNames] = useState<
    string[]
  >([]);
  const [reservationPhones, setReservationPhones] = useState<string[]>([]);
  const [reservationDates, setReservationDates] = useState<string[]>([]);
  const [reservationValues, setReservationValues] = useState<number[]>([]);
  const [reservationIds, setReservationIds] = useState<number[]>([]);
  const [reservationStartTime, setReservationStartTime] = useState<string[]>(
    [],
  );
  const [reservationEndTime, setReservationEndTime] = useState<string[]>([]);
  const [reservationArenaNames, setReservationArenaNames] = useState<string[]>([]);
  const [reservationArenaCategories, setReservationArenaCategories] = useState<string[]>([]);

  const { data, loadingReservations, error } =
    useFetchReservations(urlFetchReservations);

  const { deleteReservation: deleteReservationRequest, loadingDelete } =
    useDeleteReservation(urlDeleteReservation);

  const reservations = data?.reservations || [];
  useEffect(() => {
    if (data?.reservations) {
      // Mapeando as propriedades de cada reserva
      const playerNames = data.reservations.map(
        (reserva) => reserva.res_player_name,
      );
      const dates = data.reservations.map((reserva) => reserva.res_date);
      const values = data.reservations.map((reserva) => reserva.res_value);
      const ids = data.reservations.map((reserva) => reserva.res_id);
      const arenas = data.reservations.map((reserva) => reserva.are_name);
      const categories = data.reservations.map(
        (reserva) => reserva.are_category,
      );
      const phones = data.reservations.map((reserva) => reserva.res_cel_phone);
      const startTimes = data.reservations.map(
        (reserva) => reserva.res_start_time,
      );
      const endTimes = data.reservations.map((reserva) => reserva.res_end_time);

      // Salvando no estado
      setReservationPlayerNames(playerNames);
      setReservationPhones(phones);
      setReservationDates(dates);
      setReservationValues(values);
      setReservationIds(ids);
      setReservationStartTime(startTimes);
      setReservationEndTime(endTimes);
      setReservationArenaNames(arenas);
      setReservationArenaCategories(categories);

    }
  }, [data]);

  const router = useRouter();

  const handleEditClick = (reservation: any) => {
    setSelectedReservation(reservation);
    setModalMessage('Editar reserva');
    setIsEditMode(true);
    setShowModal(true);
  };

  const handleDeleteClick = (reservation: any) => {
    setSelectedReservation(reservation);
    setModalMessage('Deseja excluir essa reserva?');
    setIsEditMode(false);
    setShowModal(true);
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
      <div className={styles.tableResponsive}>
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
              <th className={styles.tableHeader}>Editar</th>
              <th className={styles.tableHeader}>Excluir</th>
            </tr>
          </thead>
          <tbody>
            {data?.reservations?.map((reserva, index) => (
              <tr key={index} className={styles.tableRow}>
                <td className={styles.tableData}>{reservationArenaNames[index]}</td>{' '}
                <td className={styles.tableData}>{reservationArenaCategories[index]}</td>{' '}
                <td className={styles.tableData}>
                  {reservationPlayerNames[index]}
                </td>
                <td className={styles.tableData}>{reservationPhones[index]}</td>
                <td className={styles.tableData}>
                  {reservationDates[index] || 'Data não disponível'}
                </td>
                <td className={styles.tableData}>
                  {reservationStartTime[index]} - {reservationEndTime[index]}
                </td>
                <td className={styles.tableData}>
                  R$ {reservationValues[index] || 'Valor não disponível'}
                </td>
                <td className={styles.tableData}>
                  <FaEdit
                    className={styles.iconButton}
                    onClick={() => handleEditClick(reserva)}
                    title="Editar"
                  />
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
      </div>

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
            <div className={styles.mobileActions}>
              <FaEdit
                className={styles.iconButton}
                onClick={() => handleEditClick(reserva)}
                title="Editar"
              />
              <FaTrash
                className={styles.iconButton}
                onClick={() => handleDeleteClick(reserva)}
                title="Cancelar"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Modal de edição ou cancelamento */}
      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>{modalMessage}</h2>

            {isEditMode && selectedReservation && (
              <div className={styles.modalActions}>
                <p className={styles.modalSubtitle}>
                  <strong>Arena:</strong> {selectedReservation.arena}
                </p>
                <p className={styles.modalSubtitle}>
                  <strong>Categoria:</strong> {selectedReservation.categoria}
                </p>
                <div className={styles.formContainer}>
                  <div className={styles.inputContainer}>
                    <label htmlFor="playerName" className={styles.inputLabel}>
                      Jogador locador
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        type="text"
                        id="playerName"
                        value={reservationPlayerName}
                        onChange={(e) =>
                          setReservationPlayerName(e.target.value)
                        }
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.formContainer}>
                  <div className={styles.inputContainer}>
                    <label htmlFor="playerPhone" className={styles.inputLabel}>
                      Telefone de contato
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        type="text"
                        id="playerPhone"
                        value={reservationPlayerPhone}
                        onChange={(e) =>
                          setReservationPlayerPhone(e.target.value)
                        }
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.formContainer}>
                  <div className={styles.inputContainer}>
                    <label
                      htmlFor="reservationAmount"
                      className={styles.inputLabel}
                    >
                      Valor da reserva
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        type="text"
                        id="reservationAmount"
                        value={reservationAmount}
                        onChange={(e) => setReservationAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
                <button
                  className="outlinedButton"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button
                  className="primaryButton"
                  onClick={() => setShowModal(false)}
                >
                  Salvar
                </button>
              </div>
            )}

            {!isEditMode && modalMessage === 'Deseja excluir essa reserva?' && (
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

            {!isEditMode &&
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
