import { useState, useEffect } from 'react';

// 4 - Custom Hook

export const useFetch = (url) => {

    const [data, setData] = useState(null);

    // 5 - refatorando post

    const [config, setConfig] = useState(null);
    const [method, setMethod] = useState(null);
    const [callFetch, setcallFetch] = useState(null);

    // 6 - inserindo Loading

    const [loading, setLoading] = useState(false);

    // 8 - states de erro

    const [error, setError] = useState(null);

    const httpConfig = (data, method) => {
        if (method === 'POST') {
            setConfig({
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            setMethod(method);
        }
    }

    useEffect(() => {
        const fetchData = async () => {
            // 7 - tratando erros
            try {
                // 6 - loading
                setLoading(true);

                const res = await fetch(url);
                const json = await res.json();

                setData(json);

            } catch (error) {
                console.log(error.message);
                setError('Erro ao carregar os dados.');
            }
            setLoading(false);

        };
        fetchData();
    }, [url, callFetch]);

    // 5 - refatorando POST

    useEffect(() => {
        const httpRequest = async () => {
            let json;

            if (method === 'POST') {
                setLoading(true);

                let fetchOptions = [url, config];

                const res = await fetch(...fetchOptions);

                json = await res.json();

                setLoading(false);

            }
            setcallFetch(json);
        };
        httpRequest();
    }, [config, method, url]);

    return { data, httpConfig, loading, error };
};