import NavbarSite from '../NavbarSite';
import SiteFooter from '../SiteFooter';
import UserRegisterForm from './UserRegisterForm';
import EstablishmentRegisterForm from './EstablishmentRegisterForm';

import styles from '../Register/Register.module.css';

const urlUsers = 'https://81f9-170-231-235-254.ngrok-free.app/api/user'; // URL para os dados do usuário
const urlEstablishments = 'https://81f9-170-231-235-254.ngrok-free.app/api/establishment'; // URL para os dados do estabelecimento

// Import Hooks
import { useForm } from '../hooks/useForm';
import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';

const formTemplate = {
    usr_name: "",
    usr_email: "",
    usr_password: "",
    confirmPassword: "",
    establishmentName: "",
    establishmentPhone: "",
    establishmentCep: "",
    establishmentAddress: "",
    establishmentCity: "",
}

const RegisterPage = () => {
    const [data, setData] = useState(formTemplate);

    const updateFieldHandler = (key, value) => {
        setData((prev) => {
            return { ...prev, [key]: value }
        });
    }

    const formComponents = [
        <UserRegisterForm key="user-register" data={data} updateFieldHandler={updateFieldHandler} />,
        <EstablishmentRegisterForm key="stablishment-register" data={data} updateFieldHandler={updateFieldHandler} />,
    ];

    const { currentStep, currentComponent, changeStep, isLastStep, isFirstStep } = useForm(formComponents);

    const { userRequest } = useFetch(urlUsers); // Hook para requisição do usuário
    const { establishmentRequest } = useFetch(urlEstablishments); // Hook para requisição do estabelecimento

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Dados do usuário que serão enviados
        const user = {
            usr_name: data.name,
            usr_email: data.email,
            usr_password: data.password,
            usr_cell_phone: '', //TODO:mudar depois
            usr_zipcode: '', //TODO:mudar depois
            usr_address: '', //TODO:mudar depois
            usr_city: '', //TODO:mudar depois
            own_document: '', //TODO:mudar depois
            own_code: '', //TODO:mudar depois
            is_owner: true, //TODO: mudar depois
        };

        // Dados do estabelecimento que serão enviados
        const establishment = {
            est_name: data.establishmentName,
            est_phone: data.establishmentPhone,
            est_zipcode: data.establishmentCep,
            est_address: data.establishmentAddress,
            est_city: data.establishmentCity,
            usr_cod_cad: 3, //TODO: mudar depois
            own_id: 10, //TODO:mudar depois
        };

        // Fazer a requisição dos dados do usuário
        await userRequest(user, 'POST');
        // Fazer a requisição dos dados do estabelecimento
        await establishmentRequest(establishment, 'POST');
    }

    return (
        <div className={styles.pageWrapper}>
            <NavbarSite />
            <div className={styles.contentWrapper}>
                <div className={styles.formHeader}>
                    <h2>Bem vindo ao ArenaZ</h2>
                    <p className={styles.registerSubtitle}>Para se cadastrar, por favor, preencha os dados a seguir:</p>
                </div>
                <div className={styles.formContainer}>
                    <form onSubmit={(e) => changeStep(currentStep + 1, e)}>
                        <div className='inputsContainer'>{currentComponent}</div>
                        <div className={styles.actionButtonsContainer}>
                            {!isFirstStep && (<button className={styles.outlinedButton} type='button' onClick={() => changeStep(currentStep - 1)}>Voltar</button>)}
                            {!isLastStep ? (<button className={styles.primaryButton} type='submit'>Avançar</button>) : (<button className={styles.primaryButton} type='button' onClick={handleSubmit}>Finalizar</button>)}
                        </div>
                    </form>
                </div>
            </div>
            <SiteFooter />
        </div>
    )
}

export default RegisterPage;
