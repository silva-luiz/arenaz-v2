import NavbarSite from '../NavbarSite';
import SiteFooter from '../SiteFooter';
import UserRegisterForm from './UserRegisterForm';
import EstablishmentRegisterForm from './EstablishmentRegisterForm';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from 'react-modal';
import styles from '../Register/Register.module.css';
import { useFetch } from '../../hooks/useFetch';
import URLS from '../routes/routes';

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

    const updateFieldHandler = (key, value) => {
        setData((prev) => ({ ...prev, [key]: value }));
    }

    const formComponents = [
        <UserRegisterForm key="user-register" data={data} updateFieldHandler={updateFieldHandler} />,
        <EstablishmentRegisterForm key="establishment-register" data={data} updateFieldHandler={updateFieldHandler} />,
    ];

    const { currentStep, currentComponent, changeStep, isLastStep, isFirstStep } = useForm(formComponents);

    // UseFetch separado para usuários e estabelecimentos
    const { userRequest } = useFetch(urlUsers);
    const { establishmentRequest } = useFetch(urlEstablishments);

    const handleSubmit = async (e) => {
        e.preventDefault();
    
        const user = {
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
    
        const establishment = {
            est_name: data.establishmentName,
            est_phone: data.establishmentPhone,
            est_zipcode: data.establishmentCep,
            est_address: data.establishmentAddress,
            est_city: data.establishmentCity,
            usr_cod_cad: 3,
            own_id: 10,
        };
    
        try {
            const userRes = await userRequest(user, 'POST');
            const userData = await userRes.json();
    
            if (!userRes.ok) {
                setIsSuccess(false);
                setModalMessage(userData.erro || 'Erro no cadastro de usuário!!!');
                setModalIsOpen(true);
                return;
            }

            const establishmentRes = await establishmentRequest(establishment, 'POST');
            const establishmentData = await establishmentRes.json();
    
            if (!establishmentRes.ok) {

                setIsSuccess(false);
                setModalMessage(establishmentData.erro || 'Erro no cadastro de estabelecimento!!!');
            } else {

                setIsSuccess(true);
                setModalMessage('Cadastro realizado com sucesso! Faça o login para continuar.');
            }
        } 
        catch (error) {
            console.error('Erro ao realizar cadastro:', error);
            setIsSuccess(false);
            setModalMessage(`Erro ao realizar cadastro: ${error.message || 'Tente novamente mais tarde.'}`);
        }
    
        setModalIsOpen(true);
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
                            {!isLastStep ? (
                                <button className={styles.primaryButton} type='submit'>Avançar</button>
                            ) : (
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
