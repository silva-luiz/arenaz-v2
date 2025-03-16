'use client';
import { useState } from 'react';

import styles from './AccordionMenu.module.css';

function AccordionMenu({ title, children }) {
  const [isActive, setIsActive] = useState(false);

  return (
    <>
      <div className={styles.accordionIten}>
        <h3 className={styles.accordionTitleQuestion}>
          {title}
          <button
            className="secondaryButton"
            onClick={() => setIsActive(!isActive)}
          >
            {isActive ? '˄' : '˅'}
          </button>
        </h3>
        {isActive ? <p className={styles.accordionText}>{children}</p> : null}
      </div>
      <hr></hr>
    </>
  );
}

// AccordionMenu.propTypes = {
//   title: PropTypes.string.isRequired,
//   children: PropTypes.string.isRequired,
// }

export default AccordionMenu;
