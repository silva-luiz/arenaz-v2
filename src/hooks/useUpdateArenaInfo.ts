import { useState } from 'react';

export const useUpdateArenaInfo = (url) => {
  const [loadingArenaInfo, setLoadingArenaInfo] = useState(false);
  const [error, setError] = useState(null);

  const updateArenaInfo = async (arenaData) => {
    const token = sessionStorage.getItem("auth-token");

    if (!token) {
      console.error("Token não encontrado!");
      return;
  }

    setLoadingArenaInfo(true);
    let res = null;
    try {
      res = await fetch(url, {
        method: 'PATCH',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          // "ngrok-skip-browser-warning": "69420" // usar apenas quando Ngrok estiver sendo utilizado
        },
        body: JSON.stringify(arenaData),
      });

      const jsonData = await res.json();
      setLoadingArenaInfo(false);

      if (!res.ok) {
        throw new Error(jsonData.message || 'Erro ao atualizar dados');
      }

      return { res, jsonData };
    } catch (err) {
      setError(err.message);
      setLoadingArenaInfo(false);
      return { res: null, jsonData: null };
    }
  };

  return { updateArenaInfo, loadingArenaInfo, error };
};
