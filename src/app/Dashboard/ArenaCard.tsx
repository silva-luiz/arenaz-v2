import Link from 'next/link';
import ArenaCardImg from '../../assets/arena_card_img.png';

import styles from '../Dashboard/DashboardPage.module.scss';
import Image from 'next/image';

const ArenaCard = ({
  arenaName,
  arenaCategory,
  arenaPrice,
  goToReservation,
}) => {
  return (
    <div className={styles.arenaCard}>
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

// ArenaCard.propTypes = {
//   arenaName: PropTypes.string.isRequired,
//   arenaCategory: PropTypes.string.isRequired,
//   goToReservation: PropTypes.string.isRequired,
//   arenaPrice: PropTypes.string.isRequired,
// };

export default ArenaCard;
