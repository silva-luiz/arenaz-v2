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
    
            return { res, jsonData };  // Retorna tanto a resposta quanto o JSON
        }
    };
    
    const establishmentRequest = async (establishmentData, method) => {
        const token = Cookies.get('auth_token');
    
        if (!token) {
            console.error("Token não encontrado!");
            return;
        }
    
        if (method === 'POST') {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(establishmentData),
                });
    
                const jsonData = await res.json();
    
                if (!res.ok) {
                    console.error(`Erro ao fazer requisição: ${jsonData.message || jsonData.error}`);
                    return { res, jsonData };
                }

                console.log(`Status Code: ${res.status} -> Mensagem: ${jsonData.message} -> Erro: ${jsonData.error}`);

                if (jsonData.token) {
                    Cookies.set('auth_token', jsonData.token, { expires: 1 });
                }

                return { res, jsonData };
            } catch (error) {
                console.error('Erro na requisição:', error);
            }
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
