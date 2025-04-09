import { useState } from 'react';

export const useUpdateUserInfo = (url) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateUserInfo = async (userData) => {
    const token = sessionStorage.getItem("auth-token");

    if (!token) {
      console.error("Token não encontrado!");
      return;
  }

    setLoading(true);
    let res = null;
    try {
      res = await fetch(url, {
        method: 'PATCH',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          // "ngrok-skip-browser-warning": "69420" // usar apenas quando Ngrok estiver sendo utilizado
        },
        body: JSON.stringify(userData),
      });

      const jsonData = await res.json();
      setLoading(false);

      if (!res.ok) {
        throw new Error(jsonData.message || 'Erro ao atualizar dados');
      }

      return { res, jsonData };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { res: null, jsonData: null };
    }
  };

  return { updateUserInfo, loading, error };
};
