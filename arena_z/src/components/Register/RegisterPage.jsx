import NavbarSite from '../NavbarSite';
import SiteFooter from '../SiteFooter';
import UserRegisterForm from './UserRegisterForm';
import EstablishmentRegisterForm from './EstablishmentRegisterForm';
import Modal from 'react-modal';
import styles from '../Register/Register.module.css';
import URLS from '../routes/routes';
import Cookies from 'js-cookie';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../Register/hooks/useFetch';


const urlUsers = URLS.REGISTER_USER;
const urlEstablishments = URLS.REGISTER_ESTABLISHMENT;

import { useForm } from '../hooks/useForm';

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
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");

    const updateFieldHandler = (key, value) => {
        setData((prev) => ({ ...prev, [key]: value }));
    }

    const formComponents = [
        <UserRegisterForm
            key="user-register"
            data={data}
            updateFieldHandler={updateFieldHandler}
            emailError={emailError}
            setEmailError={setEmailError}
            password={passwordError}
            setPasswordError={setPasswordError}
        />,
        <EstablishmentRegisterForm key="establishment-register" data={data} updateFieldHandler={updateFieldHandler} />,
    ];

    const { currentStep, currentComponent, changeStep, isLastStep, isFirstStep } = useForm(formComponents);

    // UseFetch separado para usuários e estabelecimentos
    const { registerUser } = useFetch(urlUsers);
    const { registerEstablishment } = useFetch(urlEstablishments);

    const handleSubmit = async (e) => {
        e.preventDefault();
    
        const userData = {
            usr_name: data.name,
            usr_email: data.email,
            usr_password: data.password,
            usr_cell_phone: '',
            usr_zipcode: '',
            usr_address: '',
            usr_city: '',
            own_document: '',
            own_code: '',
            is_owner: true,
        };
    
        try {
            const userResponse = await registerUser(userData, 'POST');
            const { res: userRes, jsonData: userJson } = userResponse;
    
            if (!userRes.ok) {
                setIsSuccess(false);
                setModalMessage(userJson.erro || 'Erro no cadastro de usuário!!!');
                setModalIsOpen(true);
                return;
            }

            if(userRes.ok){
                console.log(`OK ${userJson.own_id}`);
            }
            const userId = userJson.user?.usr_id;
            const ownerId = userJson.own_id;

            // Agora cadastra o estabelecimento com o ID do usuário
            const establishmentData = {
                est_name: data.establishmentName,
                est_phone: data.establishmentPhone,
                est_zipcode: data.establishmentCep,
                est_address: data.establishmentAddress,
                est_city: data.establishmentCity,
                usr_cod_cad: userId,
                own_id: ownerId,
            };

            console.log(establishmentData);

            if (userJson.token) {
                sessionStorage.setItem("auth-token", userJson.token);
                Cookies.set('auth_token', userJson.token, { expires: 1 });
            }
    
            const establishmentResponse = await registerEstablishment(establishmentData, 'POST', userJson.token);
            const { res: establishmentRes, jsonData: establishmentJson } = establishmentResponse;
    
            if (!establishmentRes.ok) {
                setIsSuccess(false);
                setModalMessage(establishmentJson.erro || 'Erro no cadastro de estabelecimento!!!');
                setModalIsOpen(true);
                return;
            }
    
            // Se tudo deu certo
            setIsSuccess(true);
            setModalMessage('Cadastro realizado com sucesso! Faça o login para continuar.');
            setModalIsOpen(true);
    
        } catch (error) {
            console.error('Erro ao realizar as requisições:', error);
            setIsSuccess(false);
            setModalMessage('Ocorreu um erro durante o cadastro. Por favor, tente novamente.');
            setModalIsOpen(true);
        }
        
    };


    const closeModal = () => {
        setModalIsOpen(false);
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
                            {!isLastStep ? (<button
                                className={styles.primaryButton}
                                type='submit'
                                disabled={emailError !== "" || passwordError !== ""}
                            >Avançar</button>) : (
                                <button className={styles.primaryButton} type='button' onClick={handleSubmit}>Finalizar</button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
            <SiteFooter />

            {/* Modal */}

            <Modal
                isOpen={modalIsOpen}
                onRequestClose={closeModal}
                contentLabel="Resultado do Cadastro"
                className={styles.modal}
                overlayClassName={styles.modalOverlay}
            >
                <div className={styles.modalContent}>
                    <h2 className={styles.header}>{isSuccess ? "Sucesso" : "Erro"}</h2>
                    <p>{modalMessage}</p>
                    {isSuccess ? (
                        <div className={styles.modalActions}>
                            <Link to="/login" className='primaryButton'>
                                Ir para Login
                            </Link>
                        </div>

                    ) : (
                        <div className={styles.modalActions}>
                            <button onClick={closeModal} className='primaryButton'>Fechar</button>
                        </div>
                    )}
                </div>

            </Modal>
        </div>
    );
}

export default RegisterPage;
