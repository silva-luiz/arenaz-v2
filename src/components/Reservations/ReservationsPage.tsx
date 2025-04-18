'use client';
import Table from 'react-bootstrap/Table';
import styles from '../Reservations/ReservationsPage.module.scss';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';

const reservations = [
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José Aldo',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  {
    arena: 'Arena 2',
    categoria: 'Tênis',
    locador: 'Anderson Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 140,00',
  },
  {
    arena: 'Arena 3',
    categoria: 'Beach Sports',
    locador: 'Connor McGregor',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 200,00',
  },
];

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
  const [reservationPlayerName, setReservationPlayerName] = useState('');
  const [reservationPlayerPhone, setReservationPlayerPhone] = useState('');
  const [reservationAmount, setReservationAmount] = useState('');

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
      <h2 className={styles.reservationsTitle}>Reservas ativas</h2>
      <p className={styles.reservationsSubtitle}>
        Confira aqui as informações de todas as suas reservas ativas
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
            {reservations.map((reserva, index) => (
              <tr key={index} className={styles.tableRow}>
                <td className={styles.tableData}>{reserva.arena}</td>
                <td className={styles.tableData}>{reserva.categoria}</td>
                <td className={styles.tableData}>{reserva.locador}</td>
                <td className={styles.tableData}>{reserva.contato}</td>
                <td className={styles.tableData}>{reserva.data}</td>
                <td className={styles.tableData}>
                  {reserva.horarioEntrada} - {reserva.horarioSaida}
                </td>
                <td className={styles.tableData}>{reserva.valor}</td>
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
        {reservations.map((reserva, index) => (
          <div key={index} className={styles.mobileCard}>
            <p>
              <strong>Arena:</strong> {reserva.arena}
            </p>
            <p>
              <strong>Categoria:</strong> {reserva.categoria}
            </p>
            <p>
              <strong>Locador:</strong> {reserva.locador}
            </p>
            <p>
              <strong>Contato:</strong> {reserva.contato}
            </p>
            <p>
              <strong>Data:</strong> {reserva.data}
            </p>
            <p>
              <strong>Horário:</strong> {reserva.horarioEntrada} -{' '}
              {reserva.horarioSaida}
            </p>
            <p>
              <strong>Valor:</strong> {reserva.valor}
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

            {!isEditMode &&
              modalMessage === 'Deseja excluir essa reserva?' && (
                <div className={styles.modalActions}>
                  <p className={styles.modalSubtitle}>
                    Essa ação não poderá ser desfeita
                  </p>
                  <button
                    className="outlinedButton"
                    onClick={() => setShowModal(false)}
                  >
                    Voltar
                  </button>
                  <button className="primaryButton" onClick={confirmCancel}>
                    Confirmar
                  </button>
                </div>
              )}

            {!isEditMode &&
              modalMessage === 'Reserva cancelada com sucesso!' && (
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
