import styles from '../Profile/ProfilePage.module.css';
import { useState } from 'react';
import Button from '../Button';

const EstablishmentProfilePage = () => {
  // hooks Estabelecimento
  const [establishmentName, setEstablishmentName] = useState('');
  const [establishmentCep, setEstablishmentCep] = useState('');
  const [establishmentAddress, setEstablishmentAddress] = useState('');
  const [establishmentNumber, setEstablishmentNumber] = useState('');
  const [establishmentCity, setEstablishmentCity] = useState('');

  return (
    <div className={styles.pageWrapper}>
      <h2>Informaçõs do estabelecimento</h2>
      <p>Aqui você pode alterar as informações de seu estabelecimento</p>
      <div className={styles.formContainer}>
        <form onSubmit="">
          <div className={styles.formColumns}>
            <div className={styles.column}>
              <h3 className={styles.title}>Informações do estabelecimento</h3>
              <div className={styles.inputContainer}>
                <span>Nome do estabelecimento</span>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="Nome do estabelecimento"
                    name="establishmentName"
                    onChange={(e) => setEstablishmentName(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span>CEP</span>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="CEP"
                    name="establishmentCep"
                    onChange={(e) => setEstablishmentCep(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span>Endereço</span>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="Endereço"
                    name="establishmentAddress"
                    onChange={(e) => setEstablishmentAddress(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span>Cidade</span>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="Cidade"
                    name="establishmentCity"
                    onChange={(e) => setEstablishmentCity(e.target.value)}
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
    </div>
  );
};

export default EstablishmentProfilePage;
