'use client';

import Form from 'react-bootstrap/Form';
import DatePicker from 'react-datepicker';
import { registerLocale } from 'react-datepicker';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { format } from 'date-fns';

import 'react-datepicker/dist/react-datepicker-cssmodules.css';
import 'react-datepicker/dist/react-datepicker.css';
import styles from '../Reservations/CreateReservationPage.module.scss';
import URLS from 'utils/apiRoutes';
import { useCreateReservation } from 'hooks/useCreateReservation';
import { useRouter } from 'next/navigation';
import { useFetchArenaInfo } from 'hooks/useFetchArenaInfo';
import { useFetchAvailableHours } from 'hooks/useFetchAvailableHours';
import { CategoryLabel } from './CategoryLabel';

registerLocale('pt-BR', ptBR);

const reservationUrl = URLS.CREATE_RESERVATION;
const arenaInfoUrl = URLS.GET_SINGLE_ARENA_INFO;
const availableHoursURL = URLS.FETCH_AVAILABLE_HOURS;

interface Props {
  arenaId: number;
}

const CreateReservationPage = ({ arenaId }: Props) => {
  const [startDate, setStartDate] = useState(new Date());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  const [price, setPrice] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [availableTimes, setAvailableTimes] = useState([]);

  const { arenaData, loadingArena, error } = useFetchArenaInfo(
    `${arenaInfoUrl}/${arenaId}`,
  );

  const { createReservation, loadingReservation, reservationError } =
    useCreateReservation(reservationUrl);

  const { fetchAvailableHours } = useFetchAvailableHours(availableHoursURL);

  const router = useRouter();

  const handleStartTimeChange = (e) => {
    setStartTime(e.target.value);
    console.log('Horário de início selecionado:', e.target.value);
  };

  const handleEndTimeChange = (e) => {
    setEndTime(e.target.value);
    console.log('Horário de término selecionado:', e.target.value);
  };

  const handleDateChange = async (date) => {
    setStartDate(date); // salva a data selecionada

    if (!arenaId) {
      console.error('Arena ID not available');
      return;
    }

    const reservationHoursData = {
      are_id: arenaId,
      res_date: format(date, 'dd-MM-yyyy'),
    };

    try {
      const { res, jsonData } = await fetchAvailableHours(reservationHoursData);
      if (res.ok) {
        console.log('Horários disponíveis:', jsonData);
        setAvailableTimes(jsonData.available_hours);
      } else {
        console.error('Erro ao buscar horários disponíveis:', res.statusText);
      }
    } catch (err) {
      console.error('Erro na requisição de horários:', err);
    }
  };

  const arena = arenaData?.arena;

  const arenaName = arena?.are_name || 'Arena não encontrada';
  const arenaCategory = arena?.are_category || 'Categoria não encontrada';
  const arenaPrice = arena?.are_price || 'Preço não encontrado';
  const userId = arenaData?.usr_id || 'Usuário não encontrado';

  const are_id = arenaId;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loadingReservation) return; // Evita múltiplos envios

    if (!are_id) {
      console.error('Arena ID not available');
      return;
    }

    try {
      const formattedDate = format(startDate, 'dd-MM-yyyy');
      const reservation = {
        are_id: arenaId,
        usr_cod_cad: userId,
        usr_id: userId,
        res_player_name: playerName,
        res_cel_phone: playerPhone,
        res_value: price,
        res_date: formattedDate,
        res_start_time: startTime,
        res_end_time: endTime,

      };

      const { res, jsonData } = await createReservation(reservation);

      if (res.ok) {
        setShowModal(true);
      } else {
        setShowModal(true);
      }
    } catch (error) {
      console.error('Erro inesperado ao registrar reserva:', error);
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
      <h2 className={styles.pageTitle}>Criar nova reserva</h2>
      <h2 className={styles.pageTitle}>Informações da Arena</h2>
      <div className={styles.arenaInfosContainer}>
        <div className={styles.singleInfoContainer}>
          <h4 className={styles.arenaInfo}>Nome da Arena</h4>
          <p>{arenaName}</p>
        </div>
        <div className={styles.singleInfoContainer}>
          <h4 className={styles.arenaInfo}>Categoria</h4>
            <CategoryLabel category={arenaCategory} />

        </div>
        <div className={styles.singleInfoContainer}>
          <h4 className={styles.arenaInfo}>Valor / hora</h4>
          <p>R$ {arenaPrice}/hora</p>
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
            <div className={styles.timePickerContainer}>
              <h4 className={styles.arenaInfo}>Data da reserva</h4>
              <DatePicker
                selected={startDate}
                onChange={(date) => {
                  setStartDate(date);
                  handleDateChange(date);
                }}
                dateFormat="dd/MM/yyyy"
                locale="pt-BR"
                minDate={new Date()}
                className={styles.datePickerInput}
                wrapperClassName={styles.datePickerWrapper}
              />
            </div>

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
                  {availableTimes.map((time) => (
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
                  {availableTimes
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

            <div className={styles.inputContainer}>
              <label className={styles.inputLabel}>Jogador responsável</label>
              <div className={styles.inputWrapper}>
                <input
                  required
                  type="text"
                  placeholder="Nome"
                  name="responsiblePlayer"
                  className={styles.inputText}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.inputContainer}>
              <label className={styles.inputLabel}>Telefone para contato</label>
              <div className={styles.inputWrapper}>
                <input
                  required
                  type="text"
                  placeholder="Telefone para contato"
                  name="contactPhone"
                  className={styles.inputText}
                  value={playerPhone}
                  onChange={(e) => setPlayerPhone(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.inputContainer}>
              <label className={styles.inputLabel}>Valor (R$)</label>
              <div className={styles.inputWrapper}>
                <input
                  required
                  type="text"
                  placeholder="Valor"
                  name="price"
                  step="0.01"
                  className={styles.inputText}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                className="primaryButton"
                disabled={loadingReservation}
              >
                {loadingReservation ? 'Reservando...' : 'Criar reserva'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Reserva criada com sucesso!</h2>
            <p className={styles.modalSubtitle}>
              Você pode retornar para a tela principal.
            </p>
            <button
              className="primaryButton"
              onClick={() => {
                router.push('/home/dashboard');
                setShowModal(false);
              }}
            >
              Ir para o Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateReservationPage;
