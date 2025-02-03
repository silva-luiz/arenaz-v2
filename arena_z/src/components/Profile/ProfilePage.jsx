import styles from '../Profile/ProfilePage.module.css';
import { useState } from 'react';
import Button from '../../components/Button';

const ProfilePage = () => {
  // hooks Estabelecimento
  const [establishmentName, setEstablishmentName] = useState('');
  const [establishmentCep, setEstablishmentCep] = useState('');
  const [establishmentAddress, setEstablishmentAddress] = useState('');
  const [establishmentNumber, setEstablishmentNumber] = useState('');
  const [establishmentCity, setEstablishmentCity] = useState('');

  // hooks Proprietário
  const [ownerName, setOwnerName] = useState('');
  const [ownerDocument, setOwnerDocument] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  return (
    <div className={styles.pageWrapper}>
      <h2>Perfil e informações</h2>
      <p>Aqui você pode alterar suas informações pessoais e de seu estabelecimento</p>
      <div className={styles.formContainer}>
        <form onSubmit=''>
          <div className={styles.formColumns}>
            <div className={styles.column}>
              <h3 className={styles.title}>Informações do estabelecimento</h3>
              <div className={styles.inputContainer}>
                <span>Nome do estabelecimento</span>
                <div className={styles.inputWrapper}>
                  <input type="text" placeholder='Nome do estabelecimento' name='establishmentName' onChange={(e) => setEstablishmentName(e.target.value)} />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span>CEP</span>
                <div className={styles.inputWrapper}>
                  <input type="text" placeholder='CEP' name='establishmentCep' onChange={(e) => setEstablishmentCep(e.target.value)} />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span>Endereço</span>
                <div className={styles.inputWrapper}>
                  <input type="text" placeholder='Endereço' name='establishmentAddress' onChange={(e) => setEstablishmentAddress(e.target.value)} />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span>Número</span>
                <div className={styles.inputWrapper}>
                  <input type="text" placeholder='Número' name='establishmentNumber' onChange={(e) => setEstablishmentNumber(e.target.value)} />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span>Cidade</span>
                <div className={styles.inputWrapper}>
                  <input type="text" placeholder='Cidade' name='establishmentCity' onChange={(e) => setEstablishmentCity(e.target.value)} />
                </div>
              </div>
            </div>
            <div className={styles.column}>
              <h3 className={styles.title}>Informações do Proprietário</h3>
              <div className={styles.inputContainer}>
                <span>Nome completo</span>
                <div className={styles.inputWrapper}>
                  <input type="text" placeholder='Nome completo' name='ownerName' onChange={(e) => setOwnerName(e.target.value)} />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span>CNPJ</span>
                <div className={styles.inputWrapper}>
                  <input type="text" placeholder='CNPJ' name='ownerDocument' onChange={(e) => setOwnerDocument(e.target.value)} />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span>E-mail</span>
                <div className={styles.inputWrapper}>
                  <input type="email" placeholder='E-mail' name='ownerEmail' onChange={(e) => setOwnerEmail(e.target.value)} disabled />
                </div>
              </div>
            </div>
          </div>
          <div className={styles.actionButtonsContainer}>
            <Button text='Cancelar' className='outlinedButton' />
            <Button text='Salvar alterações' className='primaryButton' />
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
