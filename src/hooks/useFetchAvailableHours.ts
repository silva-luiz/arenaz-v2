import { useState } from 'react';

export const useFetchAvailableHours = (url) => {
  const [loadingAvailableHours, setLoadingAvailableHours] = useState(false);
  const [hoursError, setHoursError] = useState(null);

  const fetchAvailableHours = async (timeReservationData) => {
    const token = sessionStorage.getItem("auth-token");

    if (!token) {
      console.error("Token não encontrado!");
      return;
  }

  setLoadingAvailableHours(true);
    let res = null;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          // "ngrok-skip-browser-warning": "69420" // usar apenas quando Ngrok estiver sendo utilizado
        },
        body: JSON.stringify(timeReservationData),
      });

      const jsonData = await res.json();
      setLoadingAvailableHours(false);

      if (!res.ok) {
        throw new Error(jsonData.message || 'Erro ao listar horários disponíveis');
      }

      return { res, jsonData };
    } catch (err) {
      setHoursError(err.message);
      setLoadingAvailableHours(false);
      return { res: null, jsonData: null };
    }
  };

  return { fetchAvailableHours, loadingAvailableHours, hoursError };
};
