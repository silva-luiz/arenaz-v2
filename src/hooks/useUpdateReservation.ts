import { useState } from 'react';

export const useUpdateReservation = (url) => {
  const [loadingReservation, setLoadingReservation] = useState(false);
  const [error, setError] = useState(null);

  const updateReservation = async (reservationData) => {
    const token = sessionStorage.getItem("auth-token");

    if (!token) {
      console.error("Token não encontrado!");
      return;
  }

  setLoadingReservation(true);
    let res = null;
    try {
      res = await fetch(url, {
        method: 'PATCH',
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
        throw new Error(jsonData.message || 'Erro ao atualizar reserva');
      }

      return { res, jsonData };
    } catch (err) {
      setError(err.message);
      setLoadingReservation(false);
      return { res: null, jsonData: null };
    }
  };

  return { updateReservation, loadingReservation, error };
};
