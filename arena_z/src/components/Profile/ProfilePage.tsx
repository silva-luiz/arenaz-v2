'use client';
import styles from '../Profile/ProfilePage.module.css';
import { useState } from 'react';
import Button from '../Button';

const ProfilePage = () => {
  // hooks Proprietário
  const [ownerName, setOwnerName] = useState('');
  const [ownerDocument, setOwnerDocument] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const onSubmit = () => {
    console.log('Submit');
  };

  return (
    <div className={styles.pageWrapper}>
      <h2>Perfil e informações</h2>
      <p>Aqui você pode alterar suas informações pessoais</p>
      <div className={styles.formContainer}>
        <form onSubmit={onSubmit}>
          <div className={styles.formColumns}>
            <div className={styles.column}>
              <h3 className={styles.title}>Informações do Proprietário</h3>
              <div className={styles.inputContainer}>
                <span>Nome completo</span>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="Nome completo"
                    name="ownerName"
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span>CNPJ</span>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="CNPJ"
                    name="ownerDocument"
                    onChange={(e) => setOwnerDocument(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.inputContainer}>
                <span>E-mail</span>
                <div className={styles.inputWrapper}>
                  <input
                    type="email"
                    placeholder="E-mail"
                    name="ownerEmail"
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    disabled
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

export default ProfilePage;
