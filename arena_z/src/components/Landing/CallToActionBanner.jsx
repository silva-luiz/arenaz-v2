import styles from './CallToActionBanner.module.css'
import PropTypes from 'prop-types'


const CallToActionBanner = ({ backgroundImage, message }) => {
  return (
    <div className={styles.ctaBanner} style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className={styles.ctaContainer}>
        <h3 className={styles.ctaMessage}>{message}</h3>
        <button className="primaryButton">Comece agora</button>
      </div>
    </div>
  )
}
CallToActionBanner.propTypes = {
  backgroundImage: PropTypes.string.isRequired,
  message: PropTypes.string
}

export default CallToActionBanner