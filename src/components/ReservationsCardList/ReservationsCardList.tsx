import React from 'react';
import Link from 'next/link';
import { FaEdit, FaTrash } from 'react-icons/fa';
import styles from '../ReservationsCardList/ReservationsCardList.module.scss';

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

interface ReservationsCardListProps {
  reservations: Reservation[];
  title?: string;
  handleDeleteClick: (reservation: Reservation) => void;
}

const ReservationsCardList: React.FC<ReservationsCardListProps> = ({
  reservations,
  title,
  handleDeleteClick,
}) => {
  if (!reservations || reservations.length === 0) return null;

  return (
    <div className={styles.mobileCardsContainer}>
      {title && <h3 className={styles.cardListTitle}>{title}</h3>}
      {reservations.map((reserva, index) => (
        <div key={index} className={styles.mobileCard}>
          <p><strong>Arena:</strong> {reserva.arena}</p>
          <p><strong>Categoria:</strong> {reserva.category}</p>
          <p><strong>Locador:</strong> {reserva.playerName}</p>
          <p><strong>Contato:</strong> {reserva.phone}</p>
          <p><strong>Data:</strong> {reserva.date || 'Data não disponível'}</p>
          <p>
            <strong>Horário:</strong> {reserva.startTime} - {reserva.endTime}
          </p>
          <p>
            <strong>Valor:</strong> R$ {reserva.value ?? 'Valor não disponível'}
          </p>
          <p>
            <strong>Valor adiantado:</strong> R$ {reserva.paymentAdvance ?? 0}
          </p>
          <div className={styles.mobileActions}>
            <Link href={`/home/update-reservation/${reserva.res_id}`}>
              <FaEdit className={styles.iconButton} title="Editar" />
            </Link>
            <FaTrash
              className={styles.iconButtonTrash}
              onClick={() => handleDeleteClick(reserva)}
              title="Cancelar"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReservationsCardList;
