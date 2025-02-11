import { useState, useEffect } from 'react';

export const DashboardHooks = (url) => {
    const [data, setData] = useState(null);
    const [config, setConfig] = useState(null);
    const [method, setMethod] = useState(null);
    const [callFetch, setcallFetch] = useState(null);

    // erro e loading
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loginRequest = async (userData, method) => {
        const token = sessionStorage.getItem("auth-token");
        if (method === 'GET') {
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Bearer': 'Bearer ' + token,
                },
                body: JSON.stringify(userData),
            });
    
            const jsonData = await res.json();

            if(!res.ok) {
                isExpiredSession = true;
            }
    
            return { res, jsonData };
        }
    };

    useEffect(() => {
        const httpRequest = async () => {
            if (method === 'POST') {
                setLoading(true);
                const res = await fetch(url, config);
                const json = await res.json();
                setcallFetch(json);
                setLoading(false);
            }
        };
        httpRequest();
    }, [config, method, url]);

    return { data, loginRequest, loading, error };
};
