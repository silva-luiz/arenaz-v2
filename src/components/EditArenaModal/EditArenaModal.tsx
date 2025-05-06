import React, { ChangeEvent, FormEvent } from 'react';
import Modal from 'react-modal';
import styles from '../EditArenaModal/EditArenaModal.module.scss'; // CSS module
import PhotoUploader from '../PhotoUploader';

interface EditArenaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  arenaName: string;
  setArenaName: (value: string) => void;
  arenaPrice: number | string;
  setArenaPrice: (value: string) => void;
  arenaCategory: string;
  setArenaCategory: (value: string) => void;
  editArena?: {
    are_name: string;
  };
  preview?: string;
  arenaFile?: File | null;
  handleFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  loadingArenaInfo?: boolean;
}

const EditArenaModal: React.FC<EditArenaModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  arenaName,
  setArenaName,
  arenaPrice,
  setArenaPrice,
  arenaCategory,
  setArenaCategory,
  editArena,
  preview,
  arenaFile,
  handleFileUpload,
  loadingArenaInfo,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className={styles.modal}
      overlayClassName={styles.modalOverlay}
    >
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitle}>
          Editar dados de <strong>{editArena?.are_name}</strong>
        </h2>

        <form onSubmit={onSubmit}>
          <PhotoUploader
            title="Alterar imagem"
            preview={preview}
            handleFileUpload={handleFileUpload}
            arenaFile={arenaFile}
          />

          <div className={styles.formContainer}>
            <div className={styles.inputContainer}>
              <label htmlFor="arenaName" className={styles.inputLabel}>
                Nome da Arena
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  id="arenaName"
                  value={arenaName}
                  onChange={(e) => setArenaName(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className={styles.formContainer}>
            <div className={styles.inputContainer}>
              <label htmlFor="arenaPrice" className={styles.inputLabel}>
                Preço/hora
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="number"
                  id="arenaPrice"
                  value={arenaPrice}
                  onChange={(e) => setArenaPrice(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <h3 className={styles.modalSubtitle}>Categoria</h3>
          <div className={styles.radioContainer}>
            {['Society', 'Beach Sports', 'Tênis', 'Outra'].map((option) => (
              <div className={styles.radioItem} key={option}>
                <input
                  type="radio"
                  id={option}
                  name="category"
                  value={option}
                  checked={arenaCategory === option}
                  onChange={(e) => setArenaCategory(e.target.value)}
                  required
                />
                <label htmlFor={option}>{option}</label>
              </div>
            ))}
          </div>

          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} className="outlinedButton">
              Cancelar
            </button>
            <button type="submit" className="primaryButton">
              {loadingArenaInfo ? 'Atualizando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default EditArenaModal;
