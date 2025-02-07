import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';

export const useFetch = (url) => {
    const [data, setData] = useState(null);
    const [config, setConfig] = useState(null);
    const [method, setMethod] = useState(null);
    const [callFetch, setcallFetch] = useState(null);

    // erro e loading
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const userRequest = async (userData, method) => {
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
            
            return res; // Retornando a resposta da requisição
        }
    };
    
    const establishmentRequest = async (establishmentData, method) => {
        const token = Cookies.get('auth_token');
    
        if (method === 'POST') {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(establishmentData),
            });
            const jsonData = await res.json();
            console.log(`Status Code: ${res.status} -> Mensagem: ${jsonData.message} -> Erro: ${jsonData.error}`);
            Cookies.set('auth_token', jsonData.token, { expires: 1 });
            
            return res; // Retornando a resposta da requisição
        }
    };
    

    // useEffect(() => {
    //     const fetchData = async () => {
    //         try {
    //             setLoading(true);
    //             const res = await fetch(url);
    //             const json = await res.json();
    //             setData(json);
    //         } catch (error) {
    //             console.log(error.message);
    //             setError('Erro ao carregar os dados.');
    //         }
    //         setLoading(false);
    //     };
    //     fetchData();
    // }, [url, callFetch]);

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

    return { data, userRequest, establishmentRequest, loading, error };
};
