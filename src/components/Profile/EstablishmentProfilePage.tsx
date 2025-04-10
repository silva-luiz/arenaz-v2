import styles from '../Profile/ProfilePage.module.scss';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFetchEstablishmentInfo } from 'hooks/useFetchEstablishmentInfo';
import Button from '../Button';
import URLS from 'utils/apiRoutes';
import { useUpdateEstablishmentInfo } from 'hooks/useUpdateEstablishmentInfo';
import { useFetchUserInfo } from 'hooks/useFetchUserInfo';

const url = URLS.GET_ESTABLISHMENT_INFO;
const urlUpdateEstablishmentInfo = URLS.UPDATE_ESTABLISHMENT;
const urlUserId = URLS.GET_USER_INFO;

interface IEstablishmentPageProps {
  isExpiredSession?: boolean;
  setIsExpiredSession?: () => void;
}

const EstablishmentProfilePage = ({
  isExpiredSession,
  setIsExpiredSession,
}: IEstablishmentPageProps) => {
  const [establishmentName, setEstablishmentName] = useState('');
  const [establishmentPhone, setEstablishmentPhone] = useState('');
  const [establishmentCep, setEstablishmentCep] = useState('');
  const [establishmentAddress, setEstablishmentAddress] = useState('');
  const [establishmentCity, setEstablishmentCity] = useState('');

  const { data, error } = useFetchEstablishmentInfo(url);

  const {
    updateEstablishmentInfo: sendUpdate,
    loading,
    error: updateError,
  } = useUpdateEstablishmentInfo(urlUpdateEstablishmentInfo);

  const router = useRouter();

  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    console.log('Dados recebidos:', data);
    if (data?.establishment) {
      const establishment = data.establishment;

      setEstablishmentName(establishment.est_name);
      setEstablishmentPhone(establishment.est_phone);
      setEstablishmentCep(establishment.est_zipcode);
      setEstablishmentAddress(establishment.est_address);
      setEstablishmentCity(establishment.est_city);
    }
  }, [data]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const establishmentData = {
      usr_cod_alt: data.usr_id,
      est_name: establishmentName,
      est_phone: establishmentPhone,
      est_zipcode: establishmentCep,
      est_address: establishmentAddress,
      est_city: establishmentCity,
    };

    const { res, jsonData } = await sendUpdate(establishmentData);

    if (res.ok) {
      setModalMessage('Dados atualizados com sucesso!');
      setShowModal(true);
    } else {
      setModalMessage('Erro ao atualizar dados. Tente novamente mais tarde.');
      setShowModal(true);
      console.error('Erro ao registrar arena:', jsonData);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <h2 className={styles.pageTitle}>Informações do estabelecimento</h2>
      <p className={styles.pageSubtitle}>
        Aqui você pode alterar as informações de seu estabelecimento
      </p>
      <div className={styles.formContainer}>
        <form onSubmit={onSubmit}>
          <div className={styles.formColumns}>
            <div className={styles.column}>
              <h3 className={styles.subtitle}>
                Informações do estabelecimento
              </h3>
              <div className={styles.inputContainer}>
                <span className={styles.inputLabel}>
                  Nome do estabelecimento
                </span>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="Nome do estabelecimento"
                    name="establishmentName"
                    value={establishmentName}
                    onChange={(e) => setEstablishmentName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span className={styles.inputLabel}>
                  Telefone do estabelecimento
                </span>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="Telefone"
                    name="establishmentPhone"
                    value={establishmentPhone}
                    onChange={(e) => setEstablishmentPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span className={styles.inputLabel}>CEP</span>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="CEP"
                    name="establishmentCep"
                    value={establishmentCep}
                    onChange={(e) => setEstablishmentCep(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span className={styles.inputLabel}>Endereço</span>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="Endereço"
                    name="establishmentAddress"
                    value={establishmentAddress}
                    onChange={(e) => setEstablishmentAddress(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span className={styles.inputLabel}>Cidade</span>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="Cidade"
                    name="establishmentCity"
                    value={establishmentCity}
                    onChange={(e) => setEstablishmentCity(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
          <div className={styles.actionButtonsContainer}>
            <Button text="Cancelar" className="outlinedButton" handleClick={() => router.push('/home/dashboard')}/>
            <Button
              text="Salvar alterações"
              className="primaryButton"
              type="submit"
            />
          </div>
        </form>
      </div>

      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>{modalMessage}</h2>

            {modalMessage === 'Dados atualizados com sucesso!' && (
              <p className={styles.modalSubtitle}>
                Você pode retornar para a tela principal.
              </p>
            )}

            {modalMessage === 'Dados atualizados com sucesso!' && (
              <button
                className="primaryButton"
                onClick={() => {
                  router.push('/home/dashboard');
                  setShowModal(false);
                }}
              >
                Ir para o Dashboard
              </button>
            )}

            {modalMessage !== 'Dados atualizados com sucesso!' && (
              <button
                className="outlinedButton"
                onClick={() => setShowModal(false)}
              >
                Voltar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EstablishmentProfilePage;
