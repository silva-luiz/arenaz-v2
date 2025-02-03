import Button from '../../components/Button';
import styles from '../Dashboard/DashboardPage.module.css';
import ArenaCard from './ArenaCard';
import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';

const url = 'http://localhost:3000/arenas';

const DashboardPage = () => {
  const { data: arenas } = useFetch(url);

  return (
    <div>
      <h2>Minhas Arenas</h2>
      <div>
        <div className={styles.actionButtonContainer}>
          <Link to='../new-arena'>
            <Button text='+ Nova arena' className='secondaryButton' />
          </Link>
          <Button text='+ Nova reserva' className='primaryButton' />
        </div>

        {/* Condicional para verificar se não há arenas */}
        {arenas && arenas.length === 0 ? (
          <p className={styles.noArenasMessage}>Você ainda não tem nenhuma Arena cadastrada. Adicione uma nova!</p>
        ) : (
          <div className={styles.cardsContainer}>
            {arenas && arenas.map((arena) => (
              <ArenaCard 
                key={arena.id} 
                arenaName={arena.arenaName} 
                arenaCategory={arena.arenaCategory} 
              />
            ))}
          </div>
        )}
      </div>

      <h2>Reservas ativas</h2>
      <div className={styles.reservationStatusContainer}>
        {arenas && arenas.length > 0 && (
          <>
            <div className={styles.reservationIndicator}>
              <p className={styles.valueTitle}>Total de reservas</p>
              <p className={styles.reservationValue}>18</p>
            </div>
            <div className={styles.reservationIndicator}>
              <p className={styles.valueTitle}>Valor recebido</p>
              <p className={styles.reservationValue}>R$ 1500,00</p>
            </div>
            <div className={styles.reservationIndicator}>
              <p className={styles.valueTitle}>Valor a receber</p>
              <p className={styles.reservationValue}>R$ 300,00</p>
            </div>
          </>
        )}

        {arenas && arenas.length === 0 && (
          <p className={styles.noReservationsMessage}>Você ainda não tem reservas ativas.</p>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
