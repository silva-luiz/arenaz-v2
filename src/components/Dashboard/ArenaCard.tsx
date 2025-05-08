'use client';
import Image from 'next/image';
import { FaEdit, FaTrash } from 'react-icons/fa';
import ArenaCardImg from '../../assets/arena_card_img.png';
import styles from '../Dashboard/DashboardPage.module.scss';
import CircularProgress from '@mui/material/CircularProgress';

const ArenaCard = ({
  arenaName,
  arenaCategory,
  arenaPrice,
  arenaPhoto,
  goToReservation,
  onEdit,
  onDelete,
  isRedirecting, // nova prop
}) => {
  return (
    <div className={styles.arenaCard}>
      <div className={styles.actionIcons}>
        <FaEdit
          className={styles.iconEdit}
          onClick={onEdit}
          title="Editar arena"
        />
        <FaTrash
          className={styles.iconDelete}
          onClick={onDelete}
          title="Excluir arena"
        />
      </div>

      <Image
        src={arenaPhoto?.includes('null') ? ArenaCardImg : arenaPhoto}
        alt="Arena Card Image"
        className={styles.arenaCardImage}
        width={400}
        height={300}
      />

      <div className={styles.arenaInfos}>
        <p className={styles.arenaName}>{arenaName}</p>
        <p className={styles.arenaCategory}>{arenaCategory}</p>
        <p className={styles.arenaPrice}>R$ {arenaPrice}/hora</p>
      </div>

      <button
        className={styles.newReservationLink}
        onClick={goToReservation}
        disabled={isRedirecting}
      >
        {isRedirecting ? (
          <CircularProgress size={20} color="inherit" />
        ) : (
          <h5 className={styles.netReservationLinkText}>+ Nova reserva</h5>
        )}
      </button>
    </div>
  );
};

export default ArenaCard;
