import PropTypes from 'prop-types';

import styles from './SiteDescription.module.css';

const SiteDescription = ({ 
  DescriptionTitle, 
  Title1, 
  Title2, 
  Title3, 
  Description1, 
  Description2, 
  Description3
 }) => {
  return (
    <div className={styles.mainContainer}>
      <h2 className={styles.descriptionTitle}>{DescriptionTitle}</h2>
      <div className={styles.descriptionContainer}>
        <div className={styles.descriptionTopic}>
          <h3 className={styles.topicTitle}>{Title1}</h3>
          <p className={styles.topicDescription}>{Description1}</p>
        </div>
        <div className={styles.descriptionTopic}>
          <h3 className={styles.topicTitle}>{Title2}</h3>
          <p className={styles.topicDescription}>{Description2}</p>
        </div>
        {/* Renderiza o terceiro bloco apenas se Title3 e Description3 forem passados */}
        {Title3 && Description3 && (
          <div className={styles.descriptionTopic}>
            <h3 className={styles.topicTitle}>{Title3}</h3>
            <p className={styles.topicDescription}>{Description3}</p>
          </div>
        )}
      </div>
    </div>

  );
}

// PROPTYPES
SiteDescription.propTypes = {
  DescriptionTitle: PropTypes.string.isRequired,
  Title1: PropTypes.string.isRequired,
  Description1: PropTypes.string.isRequired,
  Title2: PropTypes.string.isRequired,
  Description2: PropTypes.string.isRequired,
  Title3: PropTypes.string,
  Description3: PropTypes.string,
};

// DEFAULT VALUES 
SiteDescription.defaultProps = {
  Title3: '',           // Se não for passado, o terceiro título será vazio
  Description3: '',     // Se não for passado, a terceira descrição será vazia
};

export default SiteDescription;
