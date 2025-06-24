import styles from '../Profile/ProfilePage.module.scss';

import { useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useFetchEstablishmentInfo } from 'hooks/useFetchEstablishmentInfo';
import Button from '../Button';
import URLS from 'utils/apiRoutes';
import { useUpdateEstablishmentInfo } from 'hooks/useUpdateEstablishmentInfo';
import PhotoUploader from 'components/PhotoUploader';
import InputMask from 'react-input-mask';

const url = URLS.GET_ESTABLISHMENT_INFO;
const urlUpdateEstablishmentInfo = URLS.UPDATE_ESTABLISHMENT;

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
  const [pixKey, setPixKey] = useState('');

  const [establishmentFile, setEstablishmentFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();

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
    if (data?.establishment) {
      const establishment = data.establishment;

      setEstablishmentName(establishment.est_name);
      setEstablishmentPhone(establishment.est_phone);
      setEstablishmentCep(establishment.est_zipcode);
      setEstablishmentAddress(establishment.est_address);
      setEstablishmentCity(establishment.est_city);
      setPixKey(establishment.own_code);
      setPreview(
        `${process.env.NEXT_PUBLIC_API_URL}/${establishment.est_photo}`,
      );
    }
  }, [data]);
  console.log('Dados recebidos:', data);

  const handlePhoneChange = (e) => {
    const maskedValue = e.target.value;
    const onlyNumbers = maskedValue.replace(/\D/g, '');
    setEstablishmentPhone(onlyNumbers);
  };

  const formatPhone = (raw) => {
    if (!raw) return '';
    return raw.replace(/^(\d{2})(\d{1})(\d{4})(\d{4})$/, '($1)$2 $3-$4');
  };

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f) {
      if (f.type.startsWith('image/')) {
        setEstablishmentFile(f);
        setPreview(URL.createObjectURL(f));
      } else {
        alert('Selecione uma imagem válida');
        setEstablishmentFile(null);
        setPreview(undefined);
      }
    } else {
      setEstablishmentFile(null);
      setPreview(undefined);
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const form = new FormData();

    const formFields = {
      usr_cod_alt: data.usr_id,
      est_name: establishmentName,
      est_phone: establishmentPhone,
      est_zipcode: establishmentCep,
      est_address: establishmentAddress,
      est_city: establishmentCity,
      own_code: pixKey,
    };

    // Adiciona os campos normalmente
    Object.entries(formFields).forEach(([key, value]) => {
      form.append(key, value);
      console.log(`${key}: ${value}`);
    });

    // Só adiciona a foto se tiver um arquivo novo
    if (establishmentFile) {
      form.append('est_photo', establishmentFile);
      console.log('est_photo:', establishmentFile);
    }

    const { res, jsonData } = await sendUpdate(form);

    if (res && res.ok) {
      setModalMessage('Dados atualizados com sucesso!');
      setShowModal(true);
    } else {
      setModalMessage('Erro ao atualizar dados. Tente novamente mais tarde.');
      setShowModal(true);
      console.error('Erro ao atualizar dados:', jsonData);
    }
  };

  const previewImage = preview ?? '/images/establishment_placeholder.png';

  return (
    <div className={styles.pageWrapper}>
      <h2 className={styles.pageTitle}>Informações do estabelecimento</h2>
      <p className={styles.pageSubtitle}>
        Aqui você pode alterar as informações de seu estabelecimento
      </p>
      <div className={styles.formContainer}>
        <form onSubmit={onSubmit}>
          <div className={styles.photoButtonContainer}>
            <PhotoUploader
              title="Adicionar imagem"
              preview={previewImage}
              handleFileUpload={handleFileUpload}
              arenaFile={establishmentFile}
            />
          </div>
          <div className={styles.formColumns}>
            <div className={styles.column}>
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
                  <InputMask
                    mask="(99)9 9999-9999"
                    value={formatPhone(establishmentPhone)}
                    onChange={handlePhoneChange}
                  >
                    {(inputProps) => (
                      <input
                        {...inputProps}
                        type="text"
                        placeholder="Telefone"
                        name="establishmentPhone"
                        required
                      />
                    )}
                  </InputMask>
                </div>
              </div>

              <div className={styles.inputContainer}>
                <span className={styles.inputLabel}>Chave PIX</span>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="Chave PIX"
                    name="pixKey"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className={styles.column}>
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
            <Button
              text="Cancelar"
              className="outlinedButton"
              handleClick={() => router.push('/home/dashboard')}
            />
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
                Ok
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EstablishmentProfilePage;
