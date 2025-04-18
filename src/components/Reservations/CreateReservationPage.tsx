'use client';

import { registerLocale } from 'react-datepicker';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import DatePicker from 'react-datepicker';
import Form from 'react-bootstrap/Form';
import { format } from 'date-fns';

import styles from '../Reservations/CreateReservationPage.module.scss';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-datepicker/dist/react-datepicker-cssmodules.css';
import { Link } from 'react-router-dom';
import Button from 'components/Button';
import URLS from 'utils/apiRoutes';
import { useCreateReservation } from 'hooks/useCreateReservation';

registerLocale('pt-BR', ptBR);

const reservationUrl = URLS.CREATE_RESERVATION;

const CreateReservationPage = () => {
  const [startDate, setStartDate] = useState(new Date());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  const [price, setPrice] = useState('');
  const [showModal, setShowModal] = useState(false);

  const { createReservation, loadingReservation, reservationError } =
    useCreateReservation(reservationUrl);

  const handleStartTimeChange = (e) => {
    setStartTime(e.target.value);
    console.log('Horário de início selecionado:', e.target.value);
  };

  const handleEndTimeChange = (e) => {
    setEndTime(e.target.value);
    console.log('Horário de término selecionado:', e.target.value);
  };

  const are_id = '18'; // ALTERAR PARA PEGAR O ID DA ARENA SELECIONADA

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!are_id) {
      console.error('Arena ID not available');
      return;
    }
    console.log('URL de fetch:', URLS.ESTABLISHMENT_INFO);

    // const userId = data.usr_id;
    const userId = 1;

    const formattedDate = format(startDate, 'dd-MM-yyyy');

    const reservation = {
      are_id: '18', // TODO: PEGAR OS DADOS DA ARENA
      usr_cod_cad: userId, // TODO: PEGAR OS DADOS DA ARENA
      usr_id: userId, // TODO: PEGAR OS DADOS DA ARENA
      res_player_name: playerName,
      res_cel_phone: playerPhone,
      res_value: price,
      res_date: formattedDate,
      res_start_time: startTime,
      res_end_time: endTime,
      res_qrcode: '', // vazio por enquanto
    };

    // Envia a arena para a API
    const { res, jsonData } = await createReservation(reservation);

    if (res.ok) {
      setShowModal(true);
    } else {
      setShowModal(true);
      console.error('Erro ao registrar reserva:', jsonData);
    }
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
      <h2 className={styles.pageTitle}>Informações da Arena</h2>
      <div className={styles.arenaInfosContainer}>
        <div className={styles.singleInfoContainer}>
          <h4 className={styles.arenaInfo}>Nome da Arena</h4>
          <p>Arena name 1</p>
        </div>
        <div className={styles.singleInfoContainer}>
          <h4 className={styles.arenaInfo}>Categoria</h4>
          <p className={styles.arenaCategory}>Society</p>
        </div>
        <div className={styles.singleInfoContainer}>
          <h4 className={styles.arenaInfo}>Valor / hora</h4>
          <p>R$ 100/hora</p>
        </div>
      </div>

      <h2 className={styles.pageTitle}>Datas e horários disponíveis</h2>
      <p className={styles.pageSubtitle}>
        Escolha o dia, horário de início e horário de término para o seu
        agendamento:
      </p>

      <div className={styles.arenaInfosContainer}>
        <div className={styles.reservationContainer}>
          <form onSubmit={handleSubmit} className={styles.reservationForm}>
            {/* Data da reserva */}
            <div className={styles.timePickerContainer}>
              <h4 className={styles.arenaInfo}>Data da reserva</h4>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                dateFormat="dd/MM/yyyy"
                locale="pt-BR"
                minDate={new Date()}
                className={styles.datePickerInput}
                wrapperClassName={styles.datePickerWrapper}
              />
            </div>

            {/* Horário de início */}
            <div className={styles.selectTimeContainer}>
              <div className={styles.timePickerContainer}>
                <h4 className={styles.arenaInfo}>Horário de início</h4>
                <Form.Select
                  aria-label="Selecione o horário de início"
                  onChange={handleStartTimeChange}
                  value={startTime}
                  className={styles.selectTime}
                >
                  <option value="" className={styles.optionDefault}>
                    Selecione um horário...
                  </option>
                  {timeOptions.map((time) => (
                    <option
                      key={time}
                      value={time}
                      className={styles.optionTime}
                    >
                      {time}
                    </option>
                  ))}
                </Form.Select>
              </div>

              {/* Horário de término */}
              <div className={styles.timePickerContainer}>
                <h4 className={styles.arenaInfo}>Horário de saída</h4>
                <Form.Select
                  aria-label="Selecione o horário de término"
                  onChange={handleEndTimeChange}
                  value={endTime}
                  disabled={!startTime}
                  className={styles.selectTime}
                >
                  <option value="" className={styles.optionDefault}>
                    Selecione um horário...
                  </option>
                  {timeOptions
                    .filter((time) => time > startTime)
                    .map((time) => (
                      <option
                        key={time}
                        value={time}
                        className={styles.optionTime}
                      >
                        {time}
                      </option>
                    ))}
                </Form.Select>
              </div>
            </div>

            {/* Nome do jogador */}
            <div className={styles.inputContainer}>
              <label className={styles.inputLabel}>Jogador responsável</label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  placeholder="Nome"
                  name="responsiblePlayer"
                  className={styles.inputText}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>
            </div>

            {/* Telefone */}
            <div className={styles.inputContainer}>
              <label className={styles.inputLabel}>Telefone para contato</label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  placeholder="Telefone para contato"
                  name="contactPhone"
                  className={styles.inputText}
                  value={playerPhone}
                  onChange={(e) => setPlayerPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Valor */}
            <div className={styles.inputContainer}>
              <label className={styles.inputLabel}>Valor (R$)</label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  placeholder="Valor"
                  name="price"
                  className={styles.inputText}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>

            {/* Botão */}
            <div className={styles.formActions}>
              <button type="submit" className="primaryButton">
                Confirmar agendamento
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateReservationPage;
