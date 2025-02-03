import { Outlet, Link, NavLink } from "react-router-dom";
import styles from '../Home/HomePage.module.css';
import arenaZLogo from '/arenaz-logo.png';


function HomePage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link to="dashboard" className={styles.arenazMainButton}>
          <img src={arenaZLogo} alt="Logo" className={styles.arenazLogo} />
          <p>Arena Z</p>
        </Link>

        <button className={styles.logoutBtn}>Sair</button>
      </header>
      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <ul className={styles.navList}>
            <li className={styles.navItem}>
              <NavLink to="dashboard" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}>Início</NavLink>
            </li>
            <li className={styles.navItem}>
              <NavLink to="reservations" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}>Reservas ativas</NavLink>
            </li>
            <li className={styles.navItem}>
              <NavLink to="profile" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}>Perfil</NavLink>
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
