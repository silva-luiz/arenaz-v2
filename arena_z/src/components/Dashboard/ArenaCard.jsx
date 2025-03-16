
import ArenaCardImg from '../../assets/arena_card_img.jpg'

import styles from '../Dashboard/DashboardPage.module.css'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'

const ArenaCard = ({ arenaName, arenaCategory, arenaPrice, goToReservation }) => {
    return (
        <div className={styles.arenaCard}>
            <img src={ArenaCardImg} alt='Arena Card Image' className={styles.arenaCardImage} />
            <div className={styles.arenaInfos}>
                <p className={styles.arenaName}>{arenaName}</p>
                <p className={styles.arenaCategory}>{arenaCategory}</p>
                <p className={styles.arenaPrice}>R$ {arenaPrice}</p>
            </div>
            <Link className={styles.newReservationLink} to={goToReservation}>
                <h5 className={styles.netReservationLinkText}>
                    + Nova reserva
                </h5>
            </Link>


        </div>
    )
}

ArenaCard.propTypes = {
    arenaName: PropTypes.string.isRequired,
    arenaCategory: PropTypes.string.isRequired,
    goToReservation: PropTypes.string.isRequired,
    arenaPrice: PropTypes.string.isRequired,
};

export default ArenaCard