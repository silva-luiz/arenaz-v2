'use client';
import Button from '../Button';
import styles from '../Dashboard/DashboardPage.module.scss';
import Modal from 'react-modal';
import { useDashboardHooks } from '../../hooks/useDashboardHooks';
import { useDeleteArena } from '../../hooks/useDeleteArena';
import { useState } from 'react';
import URLS from '../../utils/apiRoutes';
import Link from 'next/link';
import ArenaCard from 'components/Dashboard/ArenaCard';

const url = URLS.LOAD_DASHBOARD;
const urlDeleteArena = URLS.DELETE_ARENA;

interface IAllArenasPageProps {
  isExpiredSession?: boolean;
  setIsExpiredSession?: () => void;
}

const AllArenasPage = ({
  isExpiredSession,
  setIsExpiredSession,
}: IAllArenasPageProps) => {
  const {
    data: dashboardData,
    loading,
    error,
  } = useDashboardHooks({ url, method: 'GET' });

  const { deleteArena: deleteArenaRequest, loadingDelete } =
    useDeleteArena(urlDeleteArena);

  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const arenas = dashboardData?.arenas ?? [];
  const [editArena, setEditArena] = useState(null);
  const [deleteArena, setDeleteArena] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const closeModal = () => {
    setModalIsOpen(false);
  };
  const handleEditArena = (arena) => {
    setEditArena(arena);
    setEditModalOpen(true);
  };

  const handleDeleteArena = (arena) => {
    setDeleteArena(arena);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteArena) return;

    const { res, jsonData } = await deleteArenaRequest(deleteArena.are_id);

    console.log('Resposta da API:', res, jsonData);

    if (res && res.ok) {
      setModalMessage('Arena excluída com sucesso!');
      setModalIsOpen(true);
      window.location.reload();
    } else {
      setModalMessage(
        jsonData?.message ||
          'Erro ao excluir a arena. Tente novamente mais tarde.',
      );
      setModalIsOpen(true);
    }

    setDeleteModalOpen(false);
  };

  return (
    <div className={styles.dashboardMainContent}>
      <div>
        <div className={styles.actionButtonContainer}>
          <h2 className={styles.dashboardTitle}>Todas as Arenas</h2>
          <Link
            href={{
              pathname: 'new-arena',
            }}
          >
            <Button text="+ Nova arena" className="secondaryButton" />
          </Link>
        </div>
        <p className={styles.subtitle}>
          Listagem completa de todas as Arenas de seu estabelecimento
        </p>

        {/* Verificação de carregamento e erro */}
        {loading ? (
          <p>Carregando...</p>
        ) : error ? (
          <p className={styles.errorMessage}>
            Erro ao carregar arenas: {error}
          </p>
        ) : dashboardData && arenas.length === 0 ? (
          <p className={styles.noArenasMessage}>
            Você ainda não tem nenhuma Arena cadastrada. Adicione uma nova!
          </p>
        ) : (
          <div className={styles.cardsContainer}>
            {dashboardData &&
              arenas.map((arena, index) => (
                <ArenaCard
                  key={`${index}-${arena.are_id} `}
                  arenaName={arena.are_name}
                  arenaCategory={arena.are_category}
                  arenaPrice={arena.are_price}
                  goToReservation={`/reservations/arena/${arena.are_id}`}
                  onEdit={() => handleEditArena(arena)}
                  onDelete={() => handleDeleteArena(arena)}
                />
              ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="Resultado do Cadastro"
        className={styles.modal}
        overlayClassName={styles.modalOverlay}
      >
        <div className={styles.modalContent}>
          <h2 className={styles.header}>
            {isExpiredSession ? 'Sucesso' : 'Erro'}
          </h2>
          <p>{modalMessage}</p>
          {isExpiredSession ? (
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

      {/* Modal de edição */}
      <Modal
        isOpen={editModalOpen}
        onRequestClose={() => setEditModalOpen(false)}
        className={styles.modal}
        overlayClassName={styles.modalOverlay}
      >
        <div className={styles.modalContent}>
          <h2 className={styles.modalTitle}>Editar Arena</h2>
          <p>
            Editar dados da arena <strong>{editArena?.are_name}</strong>
          </p>
          {/* Você pode adicionar aqui um formulário de edição futuramente */}
          <div className={styles.modalActions}>
            <button
              onClick={() => setEditModalOpen(false)}
              className="outlinedButton"
            >
              Cancelar
            </button>
            <button
              onClick={() => setEditModalOpen(false)}
              className="primaryButton"
            >
              Salvar alterações
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Exclusão */}
      <Modal
        isOpen={deleteModalOpen}
        onRequestClose={() => setDeleteModalOpen(false)}
        className={styles.modal}
        overlayClassName={styles.modalOverlay}
      >
        <div className={styles.modalContent}>
          <h2 className={styles.modalTitle}>Confirmar Exclusão</h2>
          <p>
            Deseja realmente excluir a arena{' '}
            <strong>{deleteArena?.are_name}</strong>?
          </p>
          <div className={styles.modalActions}>
            <button
              className="secondaryButton"
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="primaryButton"
              onClick={async () => {
                await handleConfirmDelete();
                console.log('Excluir arena', deleteArena?.are_id);
                setDeleteArena(null);
              }}
            >
              {loadingDelete ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AllArenasPage;
