import { useState } from 'react';

export const useUpdateArenaInfo = (url) => {
  const [loadingArenaInfo, setLoadingArenaInfo] = useState(false);
  const [error, setError] = useState(null);

  const updateArenaInfo = async (formData) => {
    const token = sessionStorage.getItem("auth-token");

    if (!token) {
      console.error("Token não encontrado!");
      setError("Token de autenticação ausente");
      return { res: null, jsonData: null, error: "Token ausente" };
    }

    setLoadingArenaInfo(true);
    setError(null);
    let res = null;
    let jsonData = null;

    try {
      res = await fetch(url, {
        method: 'PATCH',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        },
        body: formData,
      });

      if (res.status !== 204) {
        try {
          jsonData = await res.json();
        } catch (jsonErr) {
          console.warn("Erro ao ler JSON:", jsonErr);
        }
      }

      if (!res.ok) {
        throw new Error(jsonData?.message || 'Erro ao atualizar dados');
      }

      return { res, jsonData, error: null };
    } catch (err) {
      setError(err.message);
      return { res: null, jsonData: null, error: err.message };
    } finally {
      setLoadingArenaInfo(false);
    }
  };

  return { updateArenaInfo, loadingArenaInfo, error };
};
