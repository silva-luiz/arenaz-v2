import styles from "../Reservations/CreateReservationPage.module.css"
import PropTypes from 'prop-types';


const TImePickerComponent = ({ timePicked }) => {
  return (
    <div className={styles.TimePickerComponent} >
      <p>{timePicked}</p>
    </div>
  )
}
TImePickerComponent.propTypes = {
  timePicked: PropTypes.string.isRequired,
};

export default TImePickerComponent;