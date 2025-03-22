import { useState } from 'react';
import styles from '../Reservations/ConfirmReservationPage.module.scss';
import Button from '../Button';
import TimePickerComponent from './TimePickerComponent';
import Link from 'next/link';

const ConfirmReservationPage = () => {
  const [selectedOption, setSelectedOption] = useState('');

  const handleOptionChange = (event) => {
    setSelectedOption(event.target.value);
  };
  return (
    <div>
      <h2>Detalhes da Reserva</h2>
      <p>Por favor, preencha os dados da reserva</p>
      <div className={styles.confirmReservationContainer}>
        <h2 className={styles.arenaName}>Nome da Arena</h2>
        <h4>Categoria</h4>
        <p>Badge com a categoria</p>
        <h4>Informações gerais</h4>
        <form action="">
          <div className={styles.inputContainer}>
            <span>Jogador responsável</span>
            <div className={styles.inputWrapper}>
              <input
                type="text"
                placeholder="Nome"
                name="establishmentCep"
                // onChange={(e) => setEstablishmentCep(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.inputContainer}>
            <span>Valor (R$)</span>
            <div className={styles.inputWrapper}>
              <input
                type="text"
                placeholder="Valor"
                name="establishmentCep"
                // onChange={(e) => setEstablishmentCep(e.target.value)}
              />
            </div>
          </div>
          <h4>Pagamento adiantado?</h4>
          <div className={styles.paymentContainer}>
            <label>
              <input
                className={styles.radioItem}
                type="radio"
                name="opcao"
                value="sim"
                checked={selectedOption === 'sim'}
                onChange={handleOptionChange}
              />
              Sim
            </label>
            <label>
              <input
                className={styles.radioItem}
                type="radio"
                name="opcao"
                value="nao"
                checked={selectedOption === 'nao'}
                onChange={handleOptionChange}
              />
              Não
            </label>
          </div>
          <h4>Horário da reserva</h4>
          <div>
            <TimePickerComponent timePicked="10/10/2025 - 20:00 às 21:00" />
          </div>
          <div className={styles.actionButtonsContainer}>
            <Link href="../dashboard">
              <Button className="outlinedButton" text="Cancelar" />
            </Link>
            <Link href="/register">
              <Button className="primaryButton" text="Criar reserva" />
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConfirmReservationPage;
