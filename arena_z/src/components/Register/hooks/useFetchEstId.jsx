import { useState, useEffect } from 'react';

export const useFetchEstablishmentInfo = (url) => {
  const [establishmentInfo, setEstablishmentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEstablishmentInfo = async () => {
    const token = sessionStorage.getItem("auth-token");

      try {
        const response = await fetch(url, {
          method: 'GET', // ou o método apropriado
          headers: {
            "Authorization": `Bearer ${token}`,
            'ngrok-skip-browser-warning': '69420', // Adicionando o header
            'Content-Type': 'application/json', // Caso você precise especificar o tipo de conteúdo
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar informações do estabelecimento');
        }
        const data = await response.json();
        setEstablishmentInfo(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEstablishmentInfo();
  }, [url]); // Dependência para que o fetch seja executado quando a URL mudar

  return { establishmentInfo, loading, error };
};
