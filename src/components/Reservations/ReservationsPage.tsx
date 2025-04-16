'use client';
import Table from 'react-bootstrap/Table';
import Pagination from 'react-bootstrap/Pagination';
import styles from '../Reservations/ReservationsPage.module.scss';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const reservations = [
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  // ... outras reservas
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

  const router = useRouter();

  const handleCancelClick = (reservation: any) => {
    setSelectedReservation(reservation);
    setModalMessage('Deseja realmente cancelar essa reserva?');
    setShowModal(true);
  };

  const confirmCancel = () => {
    // Aqui você pode chamar sua API de cancelamento
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

      {/* Tabela para desktop */}
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
              <th className={styles.tableHeader}>Cancelar reserva</th>
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
                  <button
                    className={styles.cancelButton}
                    onClick={() => handleCancelClick(reserva)}
                  >
                    Cancelar reserva
                  </button>
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
            <p><strong>Arena:</strong> {reserva.arena}</p>
            <p><strong>Categoria:</strong> {reserva.categoria}</p>
            <p><strong>Locador:</strong> {reserva.locador}</p>
            <p><strong>Contato:</strong> {reserva.contato}</p>
            <p><strong>Data:</strong> {reserva.data}</p>
            <p><strong>Horário:</strong> {reserva.horarioEntrada} - {reserva.horarioSaida}</p>
            <p><strong>Valor:</strong> {reserva.valor}</p>
            <button
              className={styles.cancelButton}
              onClick={() => handleCancelClick(reserva)}
            >
              Cancelar
            </button>
          </div>
        ))}
      </div>

      {/* Modal de confirmação */}
      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>{modalMessage}</h2>

            {modalMessage === 'Deseja realmente cancelar essa reserva?' && (
              <div className={styles.modalActions}>
                <p className={styles.modalSubtitle}>Essa ação não poderá ser desfeita</p>
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

            {modalMessage === 'Reserva cancelada com sucesso!' && (
              <>
                <p className={styles.modalSubtitle}>A reserva foi cancelada.</p>
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
