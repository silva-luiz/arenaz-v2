import styles from '../error/ErrorPage.module.scss';
import SiteFooter from '../SiteFooter';
import errorImg from '../../assets/404_img.jpg';
import Image from 'next/image';
import Link from 'next/link';

const ErrorPage = () => {
  return (
    <div className={styles.container}>
      <div className={styles.errorContainer}>
        <Image src={errorImg} alt="Logo" className={styles.errorImg} />
        <div className={styles.errorMessageContainer}>
          <h1 className={styles.heading}>404</h1>
          <p className={styles.message}>
            Ops! Não foi possível encontrar essa página
          </p>
          <Link href="/" className={styles.link}>
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
