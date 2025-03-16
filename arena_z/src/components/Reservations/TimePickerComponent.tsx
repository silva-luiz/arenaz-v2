import styles from "../Reservations/CreateReservationPage.module.css"
import PropTypes from 'prop-types';


const TimePickerComponent = ({ timePicked }) => {
  return (
    <div className={styles.TimePickerComponent} >
      <p>{timePicked}</p>
    </div>
  )
}
TimePickerComponent.propTypes = {
  timePicked: PropTypes.string.isRequired,
};

export default TimePickerComponent;