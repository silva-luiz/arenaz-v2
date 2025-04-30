// hooks/useFetchReservations.ts

import { useState, useEffect } from 'react';

interface UseFetchReservationsResult<T> {
  data: T | null;
  loadingReservations: boolean;
  error: string | null;
}

export const useFetchReservations = <T = any>(url: string): UseFetchReservationsResult<T> => {
  const [data, setData] = useState<T | null>(null); // ✅ data tipado
  const [loadingReservations, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReservations = async () => {
      const token = sessionStorage.getItem('auth-token');
      console.log('Iniciando fetch');
      console.log('URL:', url);
      console.log('Token:', token);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            // 'ngrok-skip-browser-warning': '69420', // usar apenas quando Ngrok estiver sendo utilizado
          },
        });
        console.log('Resposta status:', response.status);

        if (!response.ok) {
          throw new Error('Erro ao buscar informações do usuário');
        }

        const responseData = await response.json();
        console.log('Conteúdo da resposta: ', responseData);

        setData(responseData); // ✅ agora é "data" ao invés de "userInfo"
      } catch (err: any) {
        console.error('Erro no fetch:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (url) {
      fetchReservations();
    }
  }, [url]);

  return { data, loadingReservations, error };
};
