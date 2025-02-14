import { useParams } from "react-router-dom"
import { useDashboardHooks } from "../Dashboard/hooks/DashboardHooks"
import { ptBR } from "date-fns/locale";
import React, { useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import TimePickerComponent from "./TimePickerComponent";
import useReservationHooks from "./hooks/useReservationHooks";

import styles from "../Reservations/CreateReservationPage.module.css"
import "react-datepicker/dist/react-datepicker.css";

import 'react-datepicker/dist/react-datepicker-cssmodules.css';

registerLocale("pt-BR", ptBR);


const CreateReservationPage = () => {
  
  const { id } = useParams();
  
  const timePickerUrl = "http://localhost:3000/reservationTime";
  const url = `http://localhost:3000/arenas/${id}`;

  const { data: arena, loading, error } = useDashboardHooks(url);
  const { data: timepickers } = useReservationHooks(timePickerUrl); // Pega os dados de horarios a partir do hook
  const [startDate, setStartDate] = useState(new Date());

  const options = { weekday: 'short', year: 'numeric', month: '2-digit', day: 'numeric' };

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
        <div className={styles.timePickerContainer}>
          {timepickers && timepickers.map((timepicker) => (
            <TimePickerComponent
              key={timepicker.id}
              timePicked={timepicker.timePicked}
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