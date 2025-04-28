'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Modal from 'react-modal';
import { CircularProgress } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';

import Button from '../Button';
import ArenaCard from 'components/Dashboard/ArenaCard';
import styles from '../Dashboard/DashboardPage.module.scss';

import URLS from '../../utils/apiRoutes';
import { useDashboardHooks } from '../../hooks/useDashboardHooks';
import { useDeleteArena } from '../../hooks/useDeleteArena';
import { useUpdateArenaInfo } from 'hooks/useUpdateArenaInfo';

const url = URLS.LOAD_DASHBOARD;
const urlUpdateArena = URLS.UPDATE_ARENA_INFO;
const urlDeleteArena = URLS.DELETE_ARENA;

interface Arena {
  are_id: number;
  are_name: string;
  are_price: number;
  are_category: string;
  are_photo: string;
}

interface IAllArenasPageProps {
  isExpiredSession?: boolean;
  setIsExpiredSession?: () => void;
}

const AllArenasPage = ({ isExpiredSession }: IAllArenasPageProps) => {
  const {
    data: dashboardData,
    loading,
    error,
  } = useDashboardHooks({ url, method: 'GET' });

  const [arenaName, setArenaName] = useState('');
  const [arenaPrice, setArenaPrice] = useState('');
  const [arenaCategory, setArenaCategory] = useState('');

  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editArena, setEditArena] = useState<Arena | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteArena, setDeleteArena] = useState<Arena | null>(null);

  const [arenas, setArenas] = useState<Arena[]>([]);

  const { updateArenaInfo, loadingArenaInfo } =
    useUpdateArenaInfo(urlUpdateArena);
  const { deleteArena: deleteArenaRequest, loadingDelete } =
    useDeleteArena(urlDeleteArena);

  useEffect(() => {
    if (dashboardData?.arenas) {
      setArenas(dashboardData.arenas);
    }
  }, [dashboardData]);

  const handleEditArena = (arena: Arena) => {
    setEditArena(arena);
    setArenaName(arena.are_name);
    setArenaPrice(String(arena.are_price));
    setArenaCategory(arena.are_category);
    setEditModalOpen(true);
  };

  const handleDeleteArena = (arena: Arena) => {
    setDeleteArena(arena);
    setDeleteModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editArena || !dashboardData) return;

    const updatedArenaData = {
      usr_cod_alt: dashboardData.usr_id,
      are_id: editArena.are_id,
      are_name: arenaName,
      are_price: Number(arenaPrice),
      are_category: arenaCategory,
    };

    const { res, jsonData } = await updateArenaInfo(updatedArenaData);

    if (res?.ok) {
      const updatedArena = jsonData.arena as Arena;
      const updatedArenas = arenas.map((arena) =>
        arena.are_id === updatedArena.are_id ? updatedArena : arena,
      );
      setArenas(updatedArenas);
      setModalMessage('Arena atualizada com sucesso!');
    } else {
      setModalMessage(
        jsonData?.message || 'Erro ao atualizar a arena. Tente novamente.',
      );
    }

    setModalIsOpen(true);
    setEditModalOpen(false);
    setEditArena(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteArena) return;

    const { res, jsonData } = await deleteArenaRequest(deleteArena.are_id);

    if (res?.ok) {
      setArenas(arenas.filter((arena) => arena.are_id !== deleteArena.are_id));
      setModalMessage('Arena excluída com sucesso!');
    } else {
      setModalMessage(
        jsonData?.message || 'Erro ao excluir a arena. Tente novamente.',
      );
    }

    setModalIsOpen(true);
    setDeleteModalOpen(false);
    setDeleteArena(null);
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setArenaName('');
    setArenaPrice('');
    setArenaCategory('');
    setEditArena(null);
    setDeleteArena(null);
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

        {loading ? (
          <div className={styles.loadingContainer}>
            <CircularProgress color="warning" />
            <p className={styles.loadingText}>Carregando dados...</p>
          </div>
        ) : error ? (
          <p className={styles.errorMessage}>
            Erro ao carregar arenas: {error}
          </p>
        ) : arenas.length === 0 ? (
          <div className={styles.noArenasContainer}>
            <WarningIcon style={{ color: 'orange', fontSize: 48 }} />
            <p className={styles.noArenasMessage}>
              Você ainda não tem nenhuma Arena cadastrada. Adicione uma nova!
            </p>
          </div>
        ) : (
          <div className={styles.cardsContainer}>
            {arenas.map((arena, index) => (
              <ArenaCard
                arenaPhoto={`${process.env.NEXT_PUBLIC_API_URL}/${arena.are_photo}`}
                key={`${index}-${arena.are_id}`}
                arenaName={arena.are_name}
                arenaCategory={arena.are_category}
                arenaPrice={arena.are_price}
                goToReservation={`/home/create-reservation/${arena.are_id}`}
                onEdit={() => handleEditArena(arena)}
                onDelete={() => handleDeleteArena(arena)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de sucesso/erro */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        className={styles.modal}
        overlayClassName={styles.modalOverlay}
      >
        <div className={styles.modalContent}>
          <h2 className={styles.modalHeader}>
            {isExpiredSession ? 'Sessão expirada' : 'Atenção'}
          </h2>
          <p>{modalMessage}</p>
          <div className={styles.modalActions}>
            {isExpiredSession ? (
              <Link href="/login" className="primaryButton">
                Ir para Login
              </Link>
            ) : (
              <button onClick={closeModal} className="primaryButton">
                Fechar
              </button>
            )}
          </div>
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
          <h2 className={styles.modalTitle}>Editar dados da Arena</h2>
          <p className={styles.modalSubtitle}>
            Arena: <strong>{editArena?.are_name}</strong>
          </p>
          <form onSubmit={handleEditSubmit}>
            <div className={styles.formContainer}>
              <div className={styles.inputContainer}>
                <label htmlFor="arenaName" className={styles.inputLabel}>
                  Nome da Arena
                </label>
                <input
                  type="text"
                  id="arenaName"
                  value={arenaName}
                  onChange={(e) => setArenaName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.inputContainer}>
                <label htmlFor="arenaPrice" className={styles.inputLabel}>
                  Preço/hora
                </label>
                <input
                  type="number"
                  id="arenaPrice"
                  value={arenaPrice}
                  onChange={(e) => setArenaPrice(e.target.value)}
                  required
                />
              </div>
              <div className={styles.inputContainer}>
                <label htmlFor="arenaCategory" className={styles.inputLabel}>
                  Categoria
                </label>
                <input
                  type="text"
                  id="arenaCategory"
                  value={arenaCategory}
                  onChange={(e) => setArenaCategory(e.target.value)}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="primaryButton"
              disabled={loadingArenaInfo}
            >
              {loadingArenaInfo ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        </div>
      </Modal>

      {/* Modal de exclusão */}
      <Modal
        isOpen={deleteModalOpen}
        onRequestClose={() => setDeleteModalOpen(false)}
        className={styles.modal}
        overlayClassName={styles.modalOverlay}
      >
        <div className={styles.modalContent}>
          <h2 className={styles.modalTitle}>Excluir Arena</h2>
          <p>
            {' '}
            Deseja realmente excluir a Arena{' '}
            <strong>{deleteArena?.are_name}</strong>
          </p>
          <p>Essa ação nao poderá ser desfeita</p>

          <div className={styles.modalActions}>
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="secondaryButton"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmDelete}
              className="primaryButton"
              disabled={loadingDelete}
            >
              {loadingDelete ? 'Excluindo...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AllArenasPage;
