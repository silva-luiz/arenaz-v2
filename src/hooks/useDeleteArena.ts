import { useState } from 'react';

export const useDeleteArena = (url) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const deleteArena = async (arenaId) => {
    const token = sessionStorage.getItem("auth-token");

    if (!token) {
      console.error("Token não encontrado!");
      return;
    }

    setLoading(true);
    let res = null;
    try {
      res = await fetch(`${url}/${arenaId}`, {
        method: 'DELETE',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const jsonData = await res.json();
      setLoading(false);

      if (!res.ok) {
        throw new Error(jsonData.message || 'Erro ao deletar Arena');
      }

      return { res, jsonData };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { res: null, jsonData: null };
    }
  };


  return { deleteArena, loading, error };
};
