import { useState, useEffect } from 'react';

const useReservationHooks = (url) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchReservationTime = async (controller) => {
        setLoading(true);
        setError(null); 

        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: controller.signal // Attach the abort signal to fetch
            });

            if (!res.ok) {
                throw new Error(`Erro ao listar horários: ${res.status}`);
            }

            const jsonData = await res.json();
            setData(jsonData); // Save fetched data to state
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError(err.message); // Handle any errors
            }
        } finally {
            setLoading(false); // Always turn off loading when the request is complete
        }
    };

    useEffect(() => {
        const controller = new AbortController(); // Create an abort controller
        fetchReservationTime(controller);

        return () => {
            controller.abort(); // Cleanup function to abort the fetch if the component unmounts
        };
    }, [url]);

    return { data, loading, error };
};


export default useReservationHooks;