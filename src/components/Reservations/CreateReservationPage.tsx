'use client';

import { registerLocale } from 'react-datepicker';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import DatePicker from 'react-datepicker';
import Form from 'react-bootstrap/Form';

import styles from '../Reservations/CreateReservationPage.module.scss';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-datepicker/dist/react-datepicker-cssmodules.css';

registerLocale('pt-BR', ptBR);

const CreateReservationPage = () => {
  const [startDate, setStartDate] = useState(new Date());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const handleStartTimeChange = (e) => {
    setStartTime(e.target.value);
    console.log('Horário de início selecionado:', e.target.value);
  };

  const handleEndTimeChange = (e) => {
    setEndTime(e.target.value);
    console.log('Horário de término selecionado:', e.target.value);
  };

  const timeOptions = Array.from({ length: 30 }, (_, i) => {
    const totalMinutes = 8 * 60 + i * 30; // começa às 08:00
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const formatted = `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`;
    return formatted;
  });

  console.log(`PERMANENCIA: ${startTime}-${endTime}`);

  return (
    <div>
      <h2>Informações da Arena</h2>
      <div className={styles.arenaInfosContainer}>
        <div className={styles.singleInfoContainer}>
          <h4>Nome da Arena</h4>
          <p>Arena name 1</p>
        </div>
        <div className={styles.singleInfoContainer}>
          <h4>Categoria</h4>
          <p className={styles.arenaCategory}>Society</p>
        </div>
        <div className={styles.singleInfoContainer}>
          <h4>Valor / hora</h4>
          <p>R$ 100/hora</p>
        </div>
      </div>

      <h2>Datas e horários disponíveis</h2>
      <p>
        Escolha o dia, horário de início e horário de término para o seu
        agendamento:
      </p>

      <div className={styles.arenaInfosContainer}>
        <div className={styles.reservationContainer}>
          <div className={styles.timePickerContainer}>
            <h4>Escolha a data</h4>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              dateFormat="dd/MM/yyyy"
              locale="pt-BR"
              minDate={new Date()}
              className="form-control"
              wrapperClassName={styles.datePickerWrapper}
            />
          </div>

          <div className={styles.selectTimeContainer}>
            <div className={styles.timePickerContainer}>
              <h4>Horário de início</h4>
              <Form.Select
                aria-label="Selecione o horário de início"
                onChange={handleStartTimeChange}
                value={startTime}
              >
                <option value="">Selecione um horário...</option>
                {timeOptions.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </Form.Select>
            </div>
            <div className={styles.timePickerContainer}>
              <h4>Horário de saída</h4>
              <Form.Select
                aria-label="Selecione o horário de término"
                onChange={handleEndTimeChange}
                value={endTime}
                disabled={!startTime}
              >
                <option value="">Selecione um horário...</option>
                {timeOptions
                  .filter((time) => time > startTime)
                  .map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
              </Form.Select>
            </div>
          </div>

          <button className="primaryButton">Prosseguir para agendamento</button>
        </div>
      </div>
    </div>
  );
};

export default CreateReservationPage;
