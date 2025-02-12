import { useState, useEffect } from 'react';

export const useDashboardHooks = (url) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchArenas = async () => {
        setLoading(true);
        setError(null); 

        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                throw new Error('Erro ao listar Arenas');
            }

            const jsonData = await res.json();
            setData(jsonData); // Save fetched data to state
        } catch (err) {
            setError(err.message); // Handle any errors
        } finally {
            setLoading(false); // Always turn off loading when the request is complete
        }
    };

    // Load arenas when the component mounts
    useEffect(() => {
        fetchArenas();
    }, [url]);

    return { data, loading, error };
};
