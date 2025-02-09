import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';

export const LoginHook = (url) => {
    const [data, setData] = useState(null);
    const [config, setConfig] = useState(null);
    const [method, setMethod] = useState(null);
    const [callFetch, setcallFetch] = useState(null);

    // erro e loading
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loginRequest = async (userData, method) => {
        if (method === 'POST') {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });
    
            const jsonData = await res.json();
            Cookies.set('auth_token', jsonData.token, { expires: 1 });
    
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
