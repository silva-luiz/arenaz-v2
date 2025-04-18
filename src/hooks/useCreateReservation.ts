import { useState } from 'react';

export const useCreateReservation = (url) => {
  const [loadingReservation, setLoadingReservation] = useState(false);
  const [reservationError, setReservationError] = useState(null);

  const createReservation = async (reservationData) => {
    const token = sessionStorage.getItem("auth-token");

    if (!token) {
      console.error("Token não encontrado!");
      return;
  }

  setLoadingReservation(true);
    let res = null;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          // "ngrok-skip-browser-warning": "69420" // usar apenas quando Ngrok estiver sendo utilizado
        },
        body: JSON.stringify(reservationData),
      });

      const jsonData = await res.json();
      setLoadingReservation(false);

      if (!res.ok) {
        throw new Error(jsonData.message || 'Erro ao criar nova reserva');
      }

      return { res, jsonData };
    } catch (err) {
      setReservationError(err.message);
      setLoadingReservation(false);
      return { res: null, jsonData: null };
    }
  };

  return { createReservation, loadingReservation, reservationError };
};
