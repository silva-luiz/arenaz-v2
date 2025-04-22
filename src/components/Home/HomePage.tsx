import { useState, useEffect } from 'react';
import styles from '../Home/HomePage.module.scss';
import arenaZLogo from '../../../public/images/arenaz-logo.png';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from 'lib/api';

function HomePage({ children }) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = sessionStorage.getItem('auth-token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    authService.logout();
    setShowModal(false);
    router.push('/login');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/home/dashboard" className={styles.arenazMainButton}>
          <Image src={arenaZLogo} alt="Logo" className={styles.arenazLogo} />
          <p className={styles.logoName}>Arena Z</p>
        </Link>

        <button className={styles.logoutBtn} onClick={() => setShowModal(true)}>
          Sair
        </button>
      </header>
      {/* Modal de Confirmação de Logout */}
      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Sair</h3>
            <p className={styles.modalSubtitle}>Tem certeza que deseja sair?</p>
            <div className={styles.modalActions}>
              <button
                className="outlinedButton"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button className="primaryButton" onClick={handleLogout}>
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <div className={styles.asdas}>
            <ul className={styles.navList}>
              <li className={styles.navItem}>
                <Link
                  href="/home/dashboard"
                  className={
                    pathname === '/home/dashboard'
                      ? `${styles.navLink} ${styles.active}`
                      : styles.navLink
                  }
                >
                  Início
                </Link>
              </li>

              <li className={styles.navItem}>
                <Link
                  href="/home/all-arenas"
                  className={
                    pathname === '/home/all-arenas'
                      ? `${styles.navLink} ${styles.active}`
                      : styles.navLink
                  }
                >
                  Todas as Arenas
                </Link>
              </li>

              <li className={styles.navItem}>
                <Link
                  href="/home/reservations"
                  className={
                    pathname === '/home/reservations'
                      ? `${styles.navLink} ${styles.active}`
                      : styles.navLink
                  }
                >
                  Reservas
                </Link>
              </li>
              <li className={styles.navItem}>
                <Link
                  href="/home/establishment-info"
                  className={
                    pathname === '/home/establishment-info'
                      ? `${styles.navLink} ${styles.active}`
                      : styles.navLink
                  }
                >
                  Estabelecimento
                </Link>
              </li>
              <li>
                <Link
                  href="/home/profile"
                  className={
                    pathname === '/home/profile'
                      ? `${styles.navLink} ${styles.active}`
                      : styles.navLink
                  }
                >
                  Perfil do usuário
                </Link>
              </li>
            </ul>
          </div>
        </aside>
        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}

export default HomePage;
