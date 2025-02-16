import { useState } from 'react';

export const useRegisterArena = (url) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const registerArena = async (arenaData) => {  
    setLoading(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(arenaData),
      });

      const jsonData = await res.json();
      setLoading(false);

      if (!res.ok) {
        throw new Error(jsonData.message || 'Erro ao registrar arena');
      }

      return { res, jsonData };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { res: null, jsonData: null }; // Em caso de erro, retorne nulo
    }
  };

  return { registerArena, loading, error };
};
