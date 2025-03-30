import { useParams } from "react-router-dom"
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import TimePickerComponent from "./TimePickerComponent";
import useReservationHooks from "./hooks/useReservationHooks";
import Form from 'react-bootstrap/Form';

import styles from "../Reservations/CreateReservationPage.module.css"
import "react-datepicker/dist/react-datepicker.css";

import 'react-datepicker/dist/react-datepicker-cssmodules.css';

registerLocale("pt-BR", ptBR);


const CreateReservationPage = () => {

  // const { id } = useParams();

  const timePickerUrl = "http://localhost:3000/reservationTime";
  
  // const url = `http://localhost:3000/arenas/${id}`;
  const url = `http://localhost:3000/arenas/`;

  // const { data: arena, loading, error } = useDashboardHooks(url);
  // const { data: timepickers } = useReservationHooks(timePickerUrl); // Pega os dados de horarios a partir do hook
  const { data: arena } = useReservationHooks(url); // Pega os dados de horarios a partir do hook
  const [ startTime, setStartTime ] = useState();
  const [ endTime, setEndTime ] = useState();
  const [startDate, setStartDate] = useState(new Date());

  const options = { weekday: 'short', year: 'numeric', month: '2-digit', day: 'numeric' };

  const handleStartTimeChange = (e) => {
    const selectedTime = e.target.value;
    setStartTime(selectedTime);
    console.log("Horário de início selecionado:", selectedTime);
  }
  
  const handleEndTimeChange = (e) => {
    const selectedTime = e.target.value;
    setEndTime(selectedTime);
    console.log("Horário de término selecionado:", selectedTime);
  }

  // Função para verificar se o horário está no intervalo entre início e fim
  const isTimeInRange = (time) => {
    if (startTime && endTime) {
      return time >= startTime && time <= endTime;
    }
    return false;
  };


  if (!arena) return <p>Carregando detalhes...</p>;
  if (!timepickers) return <p>Carregando horários...</p>;

  return (
    <div>
      <h2>Informações da Arena</h2>
      <div className={styles.arenaInfosContainer}>
        <div className={styles.singleInfoContainer}>
          <h4>Nome da Arena</h4>
          <p>{arena.arenaName}</p>
        </div>
        <div className={styles.singleInfoContainer}>
          <h4>Categoria</h4>
          <p className={`${styles.arenaCategory} ${arena.arenaCategory === 'society'
            ? styles.arenaCategorySoccer
            : arena.arenaCategory === 'beachSports'
              ? styles.arenaCategoryBeach
              : arena.arenaCategory === 'tennis'
                ? styles.arenaCategoryTennis
                : styles.arenaCategoryOther
            }`}>
            {arena.arenaCategory}
          </p>
        </div>
        <div className={styles.singleInfoContainer}>
          <h4>Valor / hora</h4>
          <p>R$ {arena.arenaPrice}/hora</p>
        </div>
      </div>
      <h2>Datas e horários disponíveis</h2>
      <p>Escolha o dia, horário de início e horário de término para o seu agendamento:</p>
      <div className={styles.arenaInfosContainer}>
        <DatePicker locale="pt-BR" selected={startDate} onChange={(date) => {
          setStartDate(date);
          const formattedDate = date.toLocaleDateString('pt-BR', options);
          console.log(formattedDate)
        }} inline />
        <div className={styles.reservationContainer}>
          <div className={styles.selectTimeContainer}>
            <div className={styles.timePickerContainer}>
              <h4>Horário de início</h4>
              <Form.Select aria-label="Default select example" onChange={handleStartTimeChange}>
                <option>Selecione um horário...</option>
                {timepickers && timepickers.map((timepicker) => (
                  <option key={timepicker.id} value={timepicker.timePicked}>{timepicker.timePicked}</option>
                ))}
              </Form.Select>
            </div>
            <div className={styles.timePickerContainer}>
              <h4>Horário de saída</h4>
              <Form.Select aria-label="Default select example" onChange={handleEndTimeChange}>
                <option>Selecione um horário</option>
                {timepickers && timepickers.map((timepicker) => (
                  <option key={timepicker.id} value={timepicker.timePicked}>{timepicker.timePicked}</option>
                ))}
              </Form.Select>
            </div>
          </div>
          <div className={styles.timePickerContainer}>
            {timepickers && timepickers.map((timepicker) => (
              <TimePickerComponent
                key={timepicker.id}
                timePicked={timepicker.timePicked}
                className={`${styles.timeOption} ${isTimeInRange(timepicker.timePicked) ? styles.timeInRange : ""
                  }`}
              />
            ))}
          </div>
          <button className='primaryButton'>Prosseguir para agendamento</button>
        </div>

      </div>
    </div>
  );

}

export default CreateReservationPage