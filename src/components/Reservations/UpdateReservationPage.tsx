'use client';

import Form from 'react-bootstrap/Form';
import DatePicker from 'react-datepicker';
import { registerLocale } from 'react-datepicker';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { format, parse } from 'date-fns';

import 'react-datepicker/dist/react-datepicker-cssmodules.css';
import 'react-datepicker/dist/react-datepicker.css';
import styles from '../Reservations/CreateReservationPage.module.scss';
import URLS from 'utils/apiRoutes';
import { useCreateReservation } from 'hooks/useCreateReservation';
import { useRouter } from 'next/navigation';
import { useFetchAvailableHours } from 'hooks/useFetchAvailableHours';
import { useFetchReservationInfo } from 'hooks/useFetchReservationInfo';
import { useUpdateReservation } from 'hooks/useUpdateReservation';

registerLocale('pt-BR', ptBR);

const updateReservationUrl = URLS.UPDATE_RESERVATION;
const availableHoursURL = URLS.FETCH_AVAILABLE_HOURS;
const fetchReservationInfoUrl = URLS.GET_RESERVATION_INFO;

interface Props {
  arenaId: number;
}

const CreateReservationPage = ({ arenaId }: Props) => {
  const [showModal, setShowModal] = useState(false);

  const [arenaName, setArenaName] = useState('');
  const [arenaPrice, setArenaPrice] = useState('');
  const [arenaCategory, setArenaCategory] = useState('');

  const [reservationUserId, setReservationUserId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [reservationPlayerName, setReservationPlayerName] = useState('');
  const [reservationCellphone, setReservationCellphone] = useState('');
  const [reservationValue, setReservationValue] = useState('');
  const [reservationDate, setReservationDate] = useState(new Date());
  const [reservationStartTime, setReservationStartTime] = useState('');
  const [reservationEndTime, setReservationEndTime] = useState('');

  const [originalStartTime, setOriginalStartTime] = useState('');
  const [originalEndTime, setOriginalEndTime] = useState('');

  const [reservationAvailableHours, setReservationAvailableHours] = useState(
    [],
  );

  const { updateReservation, loadingReservation, reservationError } =
    useUpdateReservation(`${updateReservationUrl}/${reservationId}`);

  const { data } = useFetchReservationInfo(
    `${fetchReservationInfoUrl}/${arenaId}`,
  );
  console.log('AQUIIII Data fetched:', data);

  const arenaInfo = data?.arena;
  const reservationInfo = data?.reservation;
  const availableHoursInfo = data?.available_hours || [];

  useEffect(() => {
    if (data?.arena) {
      const arena = data.arena;
      const reservation = data.reservation;
      const availableHours = data.available_hours || [];

      setArenaName(arena.are_name);
      setArenaPrice(arena.are_price);
      setArenaCategory(arena.are_category);

      setReservationUserId(reservation.usr_id);
      setReservationId(reservation.res_id);
      setReservationId(reservation.res_id);
      setReservationPlayerName(reservation.res_player_name);
      setReservationCellphone(reservation.res_cel_phone);
      setReservationValue(reservation.res_value);
      setReservationDate(reservation.res_date);
      setReservationStartTime(reservation.res_start_time || '');
      setReservationEndTime(reservation.res_end_time || '');
      setOriginalStartTime(reservation.res_start_time || '');
      setOriginalEndTime(reservation.res_end_time || '');

      setReservationAvailableHours(availableHours);

      if (data?.reservation?.res_date) {
        const resDateStr = data.reservation.res_date;
        const parsedDate = parse(resDateStr, 'dd-MM-yyyy', new Date()); // Converte a string em um objeto Date
        setReservationDate(parsedDate); // Atualiza o estado com a data convertida
      }
    }
  }, [data]);

  const { fetchAvailableHours } = useFetchAvailableHours(availableHoursURL);

  const router = useRouter();

  const handleStartTimeChange = (e) => {
    setReservationStartTime(e.target.value);
    console.log('Horário de início selecionado:', e.target.value);
  };

  const handleEndTimeChange = (e) => {
    setReservationEndTime(e.target.value);
    console.log('Horário de término selecionado:', e.target.value);
  };

  const handleDateChange = async (date: Date) => {
    setReservationDate(date);

    const formattedDate = format(date, 'dd-MM-yyyy');

    if (!arenaId) {
      console.error('Arena ID not available');
      return;
    }

    const reservationHoursData = {
      are_id: arenaId,
      res_date: formattedDate,
    };

    try {
      const { res, jsonData } = await fetchAvailableHours(reservationHoursData);
      if (res.ok) {
        console.log('Horários disponíveis:', jsonData);
        setReservationAvailableHours(jsonData.available_hours);
      } else {
        console.error('Erro ao buscar horários disponíveis:', res.statusText);
      }
    } catch (err) {
      console.error('Erro na requisição de horários:', err);
    }
  };

  const are_id = arenaId;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loadingReservation) return; // Evita múltiplos envios

    if (!are_id) {
      console.error('Arena ID not available');
      return;
    }

    try {
      const formattedDate = format(reservationDate, 'dd-MM-yyyy');
      const reservation = {
        usr_cod_alt: reservationUserId,
        usr_id: reservationUserId,
        res_player_name: reservationPlayerName,
        res_cel_phone: reservationCellphone,
        res_value: reservationValue,
        res_date: formattedDate,
        res_qrcode: '',
      };

      // Só adiciona se for diferente
      if (reservationStartTime !== originalStartTime) {
        reservation.res_start_time = reservationStartTime;
      }

      if (reservationEndTime !== originalEndTime) {
        reservation.res_end_time = reservationEndTime;
      }

      console.log('Dados da reserva:', reservation);

      const { res, jsonData } = await updateReservation(reservation);

      if (res.ok) {
        setShowModal(true);
      } else {
        setShowModal(true);
      }
    } catch (error) {
      console.error('Erro inesperado ao atualizar reserva:', error);
    }
  };

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
          <p className={styles.arenaCategory}>{arenaCategory}</p>
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
                selected={reservationDate}
                onChange={(date: Date | null) => {
                  if (date) {
                    setReservationDate(date);
                    handleDateChange(date);
                  }
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
                  value={reservationStartTime}
                  className={styles.selectTime}
                >
                  <option value="" className={styles.optionDefault}>
                    Selecione um horário...
                  </option>
                  {reservationAvailableHours.map((time) => (
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
                  value={reservationEndTime}
                  disabled={!reservationStartTime}
                  className={styles.selectTime}
                >
                  <option value="" className={styles.optionDefault}>
                    Selecione um horário...
                  </option>
                  {reservationAvailableHours
                    .filter((time) => time > reservationStartTime)
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
                  value={reservationPlayerName}
                  onChange={(e) => setReservationPlayerName(e.target.value)}
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
                  value={reservationCellphone}
                  onChange={(e) => setReservationCellphone(e.target.value)}
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
                  value={reservationValue}
                  onChange={(e) => setReservationValue(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                className="primaryButton"
                disabled={loadingReservation}
              >
                {loadingReservation ? 'Atualizando...' : 'Atualizar reserva'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>
              Reserva atualizada com sucesso!
            </h2>
            <p className={styles.modalSubtitle}>
              Você pode retornar para a tela de reservas.
            </p>
            <button
              className="primaryButton"
              onClick={() => {
                router.push('/home/reservations');
                setShowModal(false);
              }}
            >
              Ir para Reservas
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateReservationPage;
