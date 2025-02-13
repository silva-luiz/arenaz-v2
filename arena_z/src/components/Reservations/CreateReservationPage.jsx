import { useParams } from "react-router-dom"
import { useDashboardHooks } from "../Dashboard/hooks/DashboardHooks"
import React, { useState } from "react";
import DatePicker from "react-datepicker";

import styles from "../Reservations/CreateReservationPage.module.css"
import "react-datepicker/dist/react-datepicker.css";

// CSS Modules, react-datepicker-cssmodules.css
import 'react-datepicker/dist/react-datepicker-cssmodules.css';

const CreateReservationPage = () => {

  const { id } = useParams();

  const url = `http://localhost:3000/arenas/${id}`;

  const { data: arena, loading, error } = useDashboardHooks(url);
  const [startDate, setStartDate] = useState(new Date());

  if (!arena) return <p>Carregando dados...</p>;

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
          <p className={`${styles.arenaCategory} ${
            arena.arenaCategory === 'society' 
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
      <p>Selecione um dia e um horário para fazer um novo agendamento:</p>
      <DatePicker selected={startDate} onChange={(date) => setStartDate(date)} inline/>

    </div>
  );
  
}

export default CreateReservationPage