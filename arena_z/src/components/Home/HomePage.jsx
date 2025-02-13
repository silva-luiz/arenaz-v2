import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import styles from '../Home/HomePage.module.css';
import arenaZLogo from '/arenaz-logo.png';

function HomePage() {
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    // Lógica de logout, como limpar o token ou o estado do usuário.
    setShowModal(false);
    navigate('/'); // Redireciona para a página inicial
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link to="dashboard" className={styles.arenazMainButton}>
          <img src={arenaZLogo} alt="Logo" className={styles.arenazLogo} />
          <p>Arena Z</p>
        </Link>

        <button 
          className={styles.logoutBtn} 
          onClick={() => setShowModal(true)}
        >
          Sair
        </button>
      </header>

      {/* Modal de Confirmação de Logout */}
      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Sair</h3>
            <p>Tem certeza que deseja sair?</p>
            <div className={styles.modalActions}>
              <button 
                className="outlinedButton" 
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="primaryButton" 
                onClick={handleLogout}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <ul className={styles.navList}>
            <li className={styles.navItem}>
              <NavLink to="/home/dashboard" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}>Início</NavLink>
            </li>
            <li className={styles.navItem}>
              <NavLink to="/home/reservations" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}>Reservas ativas</NavLink>
            </li>
            <li className={styles.navItem}>
              <NavLink to="/home/profile" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}>Perfil</NavLink>
            </li>
          </ul>
        </aside>
        <main className={styles.mainContent}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default HomePage;
