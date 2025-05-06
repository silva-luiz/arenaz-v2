import React from 'react';
import Table from 'react-bootstrap/Table';
import Link from 'next/link';
import { FaEdit, FaTrash } from 'react-icons/fa';
import WarningIcon from '@mui/icons-material/Warning';
import StringMask from 'string-mask';
import styles from '../ReservationTable/ReservationsTable.module.scss';

interface Reservation {
  res_id: string;
  arena: string;
  category: string;
  playerName: string;
  phone: string;
  date?: string;
  startTime: string;
  endTime: string;
  value?: number;
  paymentAdvance?: number;
}

interface ReservationsTableProps {
  reservationStatus: Reservation[] | null | undefined;
  handleDeleteClick: (reservation: Reservation) => void;
  emptyMessage?: string;
}

const formatPhone = (phone: string) => {
  const mask = new StringMask('(00) 0 0000-0000');
  const digits = phone.replace(/\D/g, '');
  return mask.apply(digits);
};

const ReservationsTable: React.FC<ReservationsTableProps> = ({
  reservationStatus,
  handleDeleteClick,
  emptyMessage,
}) => {
  if (!reservationStatus || reservationStatus.length === 0) {
    return (
      <div className={styles.noReservationsContainer}>
        <WarningIcon style={{ color: 'orange', fontSize: 48 }} />
        <p className={styles.noReservationsMessage}>
          {emptyMessage || 'Você ainda não tem reservas cadastradas.'}
        </p>
      </div>
    );
  }

  return (
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
        {reservationStatus.map((reserva, index) => (
          <tr key={index} className={styles.tableRow}>
            <td className={styles.tableData}>{reserva.arena}</td>
            <td className={styles.tableData}>{reserva.category}</td>
            <td className={styles.tableData}>{reserva.playerName}</td>
            <td className={styles.tableData}>{formatPhone(reserva.phone)}</td>
            <td className={styles.tableData}>
              {reserva.date || 'Data não disponível'}
            </td>
            <td className={styles.tableData}>
              {reserva.startTime} - {reserva.endTime}
            </td>
            <td className={styles.tableData}>
              R${' '}
              {reserva.value?.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              }) || 'N/D'}
            </td>
            <td className={styles.tableData}>
              R${' '}
              {reserva.paymentAdvance?.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              }) || '0,00'}
            </td>
            <td className={styles.tableData}>
              <Link
                className={styles.tableButton}
                href={`/home/update-reservation/${reserva.res_id}`}
              >
                <FaEdit className={styles.iconButton} title="Editar" />
              </Link>
            </td>
            <td className={styles.tableData}>
              <div className={styles.tableButton}>
                <FaTrash
                  className={styles.iconButtonTrash}
                  onClick={() => handleDeleteClick(reserva)}
                  title="Cancelar"
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default ReservationsTable;
