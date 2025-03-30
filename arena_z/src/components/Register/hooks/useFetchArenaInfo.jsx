import { useState, useEffect } from 'react';

export const useFetchArenaInfo = (url) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchArenaInfo = async () => {
        const token = sessionStorage.getItem("auth-token");
        
        setLoading(true);
        setError(null); 

        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "69420"
                },
            });

            const jsonData = await res.json();
            console.log('\t > json Data', jsonData);
            setData(jsonData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log('>>>>>> ARENA INFO')
        
        fetchArenaInfo();
    }, [url]);

    return { data, loading, error };
};
