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
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className={styles.ctaContainer}>
        <h3 className={styles.ctaMessage}>{message}</h3>
        <Link href="/register">
          <button className="primaryButton">Comece agora</button>
        </Link>
      </div>
    </div>
  );
};

export default CallToActionBanner;
