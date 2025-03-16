import arenaZLogo from '../../public/images/arenaz-logo.png';

import styles from './NavbarSite.module.css';
import Button from './Button';
import Image from 'next/image';
import Link from 'next/link';

const NavbarSite = () => {
  return (
    <div className={styles.siteNavbar}>
      <Link href="/" className={styles.arenazMainButton}>
        <Image src={arenaZLogo} alt="Logo" className={styles.arenazLogo} />
        <p>Arena Z</p>
      </Link>

      <div>
        <Link href="/home">Go to home</Link>

        <Link href="/register">
          <Button className="primaryButton" text="Criar conta" />
        </Link>
        <Link href="/login">
          <Button className="outlinedButton" text="Entrar" />
        </Link>
      </div>
    </div>
  );
};

export default NavbarSite;
