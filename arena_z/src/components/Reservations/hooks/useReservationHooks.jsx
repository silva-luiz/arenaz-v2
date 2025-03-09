import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const useReservationHooks = (url) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { are_id } = useParams();

    const fetchReservationTime = async (controller) => {
        setLoading(true);
        setError(null);

        const token = sessionStorage.getItem('authToken'); // Obtém o token do sessionStorage

        try {
            const res = await fetch(url, {
                method: 'POST', // Mudado para POST já que você está enviando dados no corpo da requisição
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, // Inclui o token no cabeçalho
                },
                body: JSON.stringify({ are_id }), // Envia o id no corpo da requisição
                signal: controller.signal // Anexa o sinal de abort ao fetch
            });

            if (!res.ok) {
                throw new Error(`Erro ao listar horários: ${res.status}`);
            }

            const jsonData = await res.json();
            setData(jsonData); // Armazena os dados obtidos no estado
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError(err.message); // Trata erros
            }
        } finally {
            setLoading(false); // Sempre encerra o carregamento quando a requisição termina
        }
    };

    useEffect(() => {
        const controller = new AbortController(); // Cria um controlador de abort
        fetchReservationTime(controller);

        return () => {
            controller.abort(); // Função de limpeza para abortar a requisição se o componente desmontar
        };
    }, [url, are_id]); // Reexecuta o useEffect se o URL ou ID mudar

    return { data, loading, error };
};

export default useReservationHooks;
