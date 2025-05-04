import { useState } from 'react';

export const useUpdateEstablishmentInfo = (url) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateEstablishmentInfo = async (formData) => {
    const token = sessionStorage.getItem('auth-token');

    if (!token) {
      setError('Token não encontrado!');
      console.error('Token não encontrado!');
      return { res: null, jsonData: null };
    }

    formData.append('_method', 'PATCH');

    setLoading(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      let jsonData = null;

      try {
        jsonData = await res.json(); // Pode lançar erro se resposta não for JSON
      } catch (jsonErr) {
        console.warn('Resposta não é JSON:', jsonErr);
      }

      if (!res.ok) {
        throw new Error(jsonData?.message || 'Erro ao atualizar dados');
      }

      return { res, jsonData };
    } catch (err) {
      console.error('Erro na requisição:', err);
      setError(err.message || 'Erro desconhecido');
      return { res: null, jsonData: null };
    } finally {
      setLoading(false);
    }
  };

  return { updateEstablishmentInfo, loading, error };
};
