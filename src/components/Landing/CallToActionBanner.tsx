import { StaticImageData } from 'next/image';
import styles from './CallToActionBanner.module.scss';
import Link from 'next/link';

const CallToActionBanner = ({
  backgroundImage,
  message,
}: {
  backgroundImage: StaticImageData;
  message: string;
}) => {
  return (
    <div
      className={styles.ctaBanner}
      style={{ backgroundImage: `url(${backgroundImage.src})` }}
    >
      <div className={styles.ctaContainer}>
        <h3 className={styles.ctaMessage}>{message}</h3>
        <Link
          href="https://wa.me/5512991144122?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20ArenaZ"
          target="_blank"
          rel="noopener noreferrer"
        >
          <button className="primaryButton">Comece agora</button>
        </Link>
      </div>
    </div>
  );
};

export default CallToActionBanner;
