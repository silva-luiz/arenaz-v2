'use client';
import UserRegisterForm from './UserRegisterForm';
import EstablishmentRegisterForm from './EstablishmentRegisterForm';
import Modal from 'react-modal';
import styles from '../Register/Register.module.scss';
import { useState } from 'react';

import { useForm } from '../../hooks/useForm';
import Link from 'next/link';
import { authService } from 'lib/api';
import { IRegisterData } from 'types/formTemplate';

const RegisterPage = () => {
  const { registerUser, registerEstablishment } = authService;
  const [data, setData] = useState<IRegisterData>();
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const updateFieldHandler = (key, value) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const formComponents = [
    <UserRegisterForm
      key="user-register"
      data={data}
      updateFieldHandler={updateFieldHandler}
      emailError={emailError}
      setEmailError={setEmailError}
      passwordError={passwordError}
      setPasswordError={setPasswordError}
    />,
    <EstablishmentRegisterForm
      key="establishment-register"
      data={data}
      updateFieldHandler={updateFieldHandler}
    />,
  ];

  const { currentStep, currentComponent, changeStep, isLastStep, isFirstStep } =
    useForm(formComponents);

  const handleSubmit = async (e) => {
    console.log('hello');
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
      erro: 'TODO',
    };

    const establishmentData = {
      est_name: data.establishmentName,
      est_phone: data.establishmentPhone,
      est_zipcode: data.establishmentCep,
      est_address: data.establishmentAddress,
      est_city: data.establishmentCity,
      usr_cod_cad: 3,
      own_id: 10,
      erro: 'TODO',
    };

    try {
      const [userResponse, establishmentResponse] = await Promise.all([
        registerUser(userData),
        registerEstablishment(establishmentData),
        console.log('HOOK AQUI MEU PARÇA'),
      ]);

      const { res: userRes, jsonData: userJson } = userResponse;
      const { res: establishmentRes, jsonData: establishmentJson } =
        establishmentResponse;

      if (!userRes.ok) {
        setIsSuccess(false);
        setModalMessage(userData.erro || 'Erro no cadastro de usuário!!!');
        setModalIsOpen(true);
        return;
      } else {
        setIsSuccess(true);
        setModalMessage(
          'Cadastro realizado com sucesso! Faça o login para continuar.',
        );
      }

      if (!establishmentRes.ok) {
        setIsSuccess(false);
        setModalMessage(
          establishmentData.erro || 'Erro no cadastro de estabelecimento!!!',
        );
      } else {
        setIsSuccess(true);
        setModalMessage(
          'Cadastro realizado com sucesso! Faça o login para continuar.',
        );
      }

      console.log(
        'Cadastro realizado com sucesso!',
        userJson,
        establishmentJson,
      );
    } catch (error) {
      console.error('Erro ao realizar as requisições:', error);
    }

    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
  };

  return (
    <div className={styles.pageWrapper}>
      {/* <NavbarSite /> */}
      <div className={styles.contentWrapper}>
        <div className={styles.formHeader}>
          <h2>Bem vindo ao ArenaZ</h2>
          <p className={styles.registerSubtitle}>
            Para se cadastrar, por favor, preencha os dados a seguir:
          </p>
        </div>
        <div className={styles.formContainer}>
          <form onSubmit={(e) => changeStep(currentStep + 1, e)}>
            <div className="inputsContainer">{currentComponent}</div>
            <div className={styles.actionButtonsContainer}>
              {!isFirstStep && (
                <button
                  className={styles.outlinedButton}
                  type="button"
                  onClick={(e) => changeStep(currentStep - 1, e)}
                >
                  Voltar
                </button>
              )}
              {!isLastStep ? (
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={emailError !== '' || passwordError !== ''}
                >
                  Avançar
                </button>
              ) : (
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={handleSubmit}
                >
                  Finalizar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
      {/* <SiteFooter /> */}

      {/* Modal */}

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="Resultado do Cadastro"
        className={styles.modal}
        overlayClassName={styles.modalOverlay}
      >
        <div className={styles.modalContent}>
          <h2 className={styles.header}>{isSuccess ? 'Sucesso' : 'Erro'}</h2>
          <p>{modalMessage}</p>
          {isSuccess ? (
            <div className={styles.modalActions}>
              <Link href="/login" className="primaryButton">
                Ir para Login
              </Link>
            </div>
          ) : (
            <div className={styles.modalActions}>
              <button onClick={closeModal} className="primaryButton">
                Fechar
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default RegisterPage;
