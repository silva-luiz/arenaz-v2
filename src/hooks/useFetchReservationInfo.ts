
import { useState, useEffect } from 'react';

interface UseFetchReservationInfoResult<T> {
  data: T | null;
  loadingReservationInfo: boolean;
  error: string | null;
}

export const useFetchReservationInfo = <T = any>(url: string): UseFetchReservationInfoResult<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loadingReservationInfo, setLoadingReservationInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReservationInfo = async () => {
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
          throw new Error('Erro ao buscar informações da reserva');
        }

        const responseData = await response.json();
        console.log('Conteúdo da resposta: ', responseData);

        setData(responseData); // ✅ agora é "data" ao invés de "userInfo"
      } catch (err: any) {
        console.error('Erro no fetch:', err.message);
        setError(err.message);
      } finally {
        setLoadingReservationInfo(false);
      }
    };

    if (url) {
      fetchReservationInfo();
    }
  }, [url]);

  return { data, loadingReservationInfo, error };
};
