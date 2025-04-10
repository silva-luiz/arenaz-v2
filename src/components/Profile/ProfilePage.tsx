'use client';
import styles from '../Profile/ProfilePage.module.scss';
import { useEffect, useState } from 'react';
import Button from '../Button';
import { useFetchUserInfo } from 'hooks/useFetchUserInfo';
import { useUpdateUserInfo } from 'hooks/useUpdateUserInfo';
import { isValidCNPJ } from 'utils/cnpjValidator';
import { useRouter } from 'next/navigation';
import URLS from 'utils/apiRoutes';

const url = URLS.GET_USER_INFO;
const urlUpdateUserInfo = URLS.UPDATE_USER_INFO;

interface IProfilePageProps {
  isExpiredSession?: boolean;
  setIsExpiredSession?: () => void;
}

const ProfilePage = ({
  isExpiredSession,
  setIsExpiredSession,
}: IProfilePageProps) => {
  const [ownerName, setOwnerName] = useState('');
  const [ownerDocument, setOwnerDocument] = useState('');
  const [ownerCellphone, setOwnerCellphone] = useState('');
  const [ownerZipCode, setOwnerZipCode] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');
  const [ownerCity, setOwnerCity] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const { data, error } = useFetchUserInfo(url);

  const {
    updateUserInfo: sendUpdate,
    loading,
    error: updateError,
  } = useUpdateUserInfo(urlUpdateUserInfo);

  const router = useRouter();

  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    if (data?.user) {
      const user = data.user;
      const owner = data.owner;

      setOwnerName(user.usr_name);
      setOwnerDocument(owner.own_document || owner.document || '');
      setOwnerCellphone(user.usr_cell_phone);
      setOwnerZipCode(user.usr_zipcode);
      setOwnerAddress(user.usr_address);
      setOwnerCity(user.usr_city);
      setOwnerEmail(user.usr_email);
    }
  }, [data]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCNPJ = ownerDocument.replace(/\D/g, '');

    if (!isValidCNPJ(cleanCNPJ)) {
      setModalMessage('CNPJ inválido!');
      setShowModal(true);
      return;
    }

    const userData = {
      usr_name: ownerName,
      own_document: cleanCNPJ,
      usr_cell_phone: ownerCellphone,
      usr_zipcode: ownerZipCode,
      usr_address: ownerAddress,
      usr_city: ownerCity,
    };

    const { res, jsonData } = await sendUpdate(userData);

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
      <h2 className={styles.pageTitle}>Perfil e informações</h2>
      <p className={styles.pageSubtitle}>
        Aqui você pode alterar suas informações pessoais
      </p>

      {loading && <p>Carregando dados...</p>}
      {error && <p>Erro ao carregar dados do usuário.</p>}

      {!loading && !error && (
        <div className={styles.formContainer}>
          <form onSubmit={onSubmit}>
            <div className={styles.formColumns}>
              <div className={styles.column}>
                <h3 className={styles.subtitle}>Informações do Proprietário</h3>

                <div className={styles.inputContainer}>
                  <span className={styles.inputLabel}>Nome completo</span>
                  <div className={styles.inputWrapper}>
                    <input
                      type="text"
                      placeholder="Nome completo"
                      name="ownerName"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputContainer}>
                  <span className={styles.inputLabel}>CNPJ</span>
                  <div className={styles.inputWrapper}>
                    <input
                      type="text"
                      placeholder="CNPJ"
                      name="ownerDocument"
                      value={ownerDocument}
                      onChange={(e) => setOwnerDocument(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.inputContainer}>
                  <span className={styles.inputLabel}>Celular</span>
                  <div className={styles.inputWrapper}>
                    <input
                      type="text"
                      placeholder="Celular"
                      name="cellphone"
                      value={ownerCellphone}
                      onChange={(e) => setOwnerCellphone(e.target.value)}
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
                      name="cep"
                      value={ownerZipCode}
                      onChange={(e) => setOwnerZipCode(e.target.value)}
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
                      name="address"
                      value={ownerAddress}
                      onChange={(e) => setOwnerAddress(e.target.value)}
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
                      name="city"
                      value={ownerCity}
                      onChange={(e) => setOwnerCity(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputContainer}>
                  <span className={styles.inputLabel}>E-mail</span>
                  <div className={styles.inputWrapper}>
                    <input
                      type="email"
                      placeholder="E-mail"
                      name="ownerEmail"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      disabled
                      className={styles.disabledInput}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.actionButtonsContainer}>
              <Button text="Cancelar" className="outlinedButton" />
              <Button text="Salvar alterações" className="primaryButton" />
            </div>
          </form>
        </div>
      )}

      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>{modalMessage}</h2>

            {modalMessage === 'Dados atualizados com sucesso!' && (
              <p className={styles.modalSubtitle}>
                Você pode retornar para a tela principal.
              </p>
            )}

            {modalMessage === 'CNPJ inválido!' && (
              <p className={styles.modalSubtitle}>
                Por favor, verifique e tente novamente.
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

export default ProfilePage;
