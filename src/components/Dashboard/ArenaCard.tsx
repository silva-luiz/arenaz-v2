import Link from 'next/link';
import Image from 'next/image';
import { FaEdit, FaTrash } from 'react-icons/fa';

import ArenaCardImg from '../../assets/arena_card_img.jpg';
import styles from '../Dashboard/DashboardPage.module.scss';

const ArenaCard = ({
  arenaName,
  arenaCategory,
  arenaPrice,
  goToReservation,
  onEdit,
  onDelete,
}) => {
  return (
    <div className={styles.arenaCard}>
      <div className={styles.actionIcons}>
        <FaEdit className={styles.iconEdit} onClick={onEdit} title="Editar arena" />
        <FaTrash className={styles.iconDelete} onClick={onDelete} title="Excluir arena" />
      </div>

      <Image
        src={ArenaCardImg}
        alt="Arena Card Image"
        className={styles.arenaCardImage}
      />
      <div className={styles.arenaInfos}>
        <p className={styles.arenaName}>{arenaName}</p>
        <p className={styles.arenaCategory}>{arenaCategory}</p>
        <p className={styles.arenaPrice}>R$ {arenaPrice}/hora</p>
      </div>
      <Link className={styles.newReservationLink} href={goToReservation || ''}>
        <h5 className={styles.netReservationLinkText}>+ Nova reserva</h5>
      </Link>
    </div>
  );
};

export default ArenaCard;
