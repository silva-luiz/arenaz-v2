
import NavbarSite from '../NavbarSite';
import SiteFooter from '../SiteFooter';
import UserRegisterForm from './UserRegisterForm';
import StablishmentRegisterForm from './StablishmentRegisterForm';
// import ArenaRegisterForm from './ArenaRegisterForm';

import styles from '../Register/Register.module.css';


// Import Hooks
import { useForm } from '../hooks/useForm';
import { useState } from 'react';

const formTemplate = {
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    stablishmentName: "",
    phone: "",
    cep: "",
    address: "",
    city: "",
}

const RegisterPage = () => {
    const [data, setData] = useState(formTemplate);

    const updateFieldHandler = (key, value) => {
        setData((prev) => {
            return {...prev, [key]: value}
        });
    }    

    const formComponents = [
        <UserRegisterForm key="user-register" data={data} updateFieldHandler={updateFieldHandler}/>,
        <StablishmentRegisterForm key="stablishment-register" data={data} updateFieldHandler={updateFieldHandler}/>,
        // <ArenaRegisterForm key="arena-register" data={data} updateFieldHandler={updateFieldHandler}/>
    ];

    const { currentStep, currentComponent, changeStep, isLastStep, isFirstStep } = useForm(formComponents);



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
                            {!isLastStep ? (<button className={styles.primaryButton} type='submit'>Avançar</button>) : (<button className='primaryButton' type='button'>Finalizar</button>)}
                        </div>
                    </form>
                </div>
            </div>

            <SiteFooter />
        </div>

    )
}

export default RegisterPage