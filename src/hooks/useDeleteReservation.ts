import { useState } from 'react';

export const useDeleteReservation = (url) => {
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [error, setError] = useState(null);

  const deleteReservation = async (reservationId) => {
    const token = sessionStorage.getItem("auth-token");

    if (!token) {
      console.error("Token não encontrado!");
      return;
    }

    setLoadingDelete(true);
    let res = null;
    try {
      res = await fetch(`${url}/${reservationId}`, {
        method: 'DELETE',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const jsonData = await res.json();
      setLoadingDelete(false);

      if (!res.ok) {
        throw new Error(jsonData.message || 'Erro ao deletar reserva');
      }

      return { res, jsonData };
    } catch (err) {
      setError(err.message);
      setLoadingDelete(false);
      return { res: null, jsonData: null };
    }
  };


  return { deleteReservation, loadingDelete, error };
};
