// hooks/useFetchUserInfo.ts

import { useState, useEffect } from 'react';

interface UseFetchUserInfoResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export const useFetchUserInfo = <T = any>(url: string): UseFetchUserInfoResult<T> => {
  const [data, setData] = useState<T | null>(null); // ✅ data tipado
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
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
      fetchUserInfo();
    }
  }, [url]);

  return { data, loading, error };
};
