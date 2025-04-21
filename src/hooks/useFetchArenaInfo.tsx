import { useState, useEffect } from 'react';

export const useFetchArenaInfo = (url) => {
  const [arenaData, setArenaData] = useState(null);
  const [loadingArena, setLoadingArena] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchArenaInfo = async () => {
      const token = sessionStorage.getItem('auth-token');
      console.log('Iniciando fetch');
      console.log('URL:', url);
      console.log('Token:', token);

      try {
        const response = await fetch(url,{
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            // 'ngrok-skip-browser-warning': '69420', // usar apenas quando Ngrok estiver sendo utilizado
          },
        });

        console.log('Resposta status:', response.status);

        if (!response.ok) {
          throw new Error('Erro ao buscar informações da Arena');
        }
        const data = await response.json();
        console.log('Conteúdo da resposta: ', data);
        setArenaData(data);
      } catch (err) {
        console.error('Erro no fetch:', err.message);
        setError(err.message);
      } finally {
        setLoadingArena(false);
      }
    };

    if (url) {
      fetchArenaInfo();
    }
  }, [url]);
  // Dependência para que o fetch seja executado quando a URL mudar

  return { arenaData, loadingArena, error };
};
