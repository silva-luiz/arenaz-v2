import { Link } from "react-router-dom";
import styles from '../error/ErrorPage.module.css';
import SiteFooter from "../SiteFooter";
import errorImg from '../../../public/404_img.jpg'; // Certifique-se do caminho correto da imagem

const ErrorPage = () => {
  return (
    <div className={styles.container}>
      <div className={styles.errorContainer}>
        <img src={errorImg} alt="Logo" className={styles.errorImg} />
        <div className={styles.errorMessageContainer}>
          <h1 className={styles.heading}>404</h1>
          <p className={styles.message}>Ops! Não foi possível encontrar essa página</p>
          <Link to="/" className={styles.link}>Voltar para a página inicial</Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
};

export default ErrorPage;
