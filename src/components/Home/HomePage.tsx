'use client';

import { useState, useEffect } from 'react';
import { Drawer, IconButton, Modal, Button as MuiButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import styles from '../Home/HomePage.module.scss';
import arenaZLogo from '../../../public/images/arenaz-logo.png';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from 'lib/api';

const navLinks = [
  { href: '/home/dashboard', label: 'Início' },
  { href: '/home/all-arenas', label: 'Todas as Arenas' },
  { href: '/home/reservations', label: 'Reservas' },
  { href: '/home/establishment-info', label: 'Estabelecimento' },
  { href: '/home/profile', label: 'Perfil do usuário' },
];

function HomePage({ children }) {
  const [showModal, setShowModal] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 767);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem('auth-token');
    if (!token) router.push('/login');
  }, [router]);

  const handleLogout = () => {
    authService.logout();
    setShowModal(false);
    router.push('/login');
  };

  const toggleDrawer = (open) => () => {
    setDrawerOpen(open);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <IconButton onClick={toggleDrawer(true)} className={styles.menuBtn}>
          <MenuIcon fontSize="large" />
        </IconButton>

        <Link href="/home/dashboard" className={styles.arenazMainButton}>
          <Image src={arenaZLogo} alt="Logo" className={styles.arenazLogo} />
          <p className={styles.logoName}>Arena Z</p>
        </Link>

        <button className={styles.logoutBtn} onClick={() => setShowModal(true)}>
          Sair
        </button>
      </header>

      {/* Drawer personalizado */}
      <Drawer
        anchor={isMobile ? 'top' : 'left'}
        open={drawerOpen}
        onClose={toggleDrawer(false)}
      >
        <div
          className={styles.sidebar}
          onClick={toggleDrawer(false)}
          onKeyDown={toggleDrawer(false)}
        >
          <div className={styles.asdas}>
            <ul className={styles.navList}>
              {navLinks.map((item) => (
                <li key={item.href} className={styles.navItem}>
                  <Link
                    href={item.href}
                    className={
                      pathname === item.href
                        ? `${styles.navLink} ${styles.active}`
                        : styles.navLink
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Drawer>

      {/* Modal de Logout */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
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
      </Modal>

      {/* Conteúdo principal */}
      <main className={styles.mainContent}>{children}</main>
    </div>
  );
}

export default HomePage;
