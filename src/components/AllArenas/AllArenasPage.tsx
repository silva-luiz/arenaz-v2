'use client';
import { useState, useEffect, ChangeEvent } from 'react';
import Link from 'next/link';
import Modal from 'react-modal';
import { CircularProgress } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';

import Button from '../Button';
import ArenaCard from 'components/ArenaCard/ArenaCard';
import styles from '../Dashboard/DashboardPage.module.scss';

import URLS from '../../utils/apiRoutes';
import { useDashboardHooks } from '../../hooks/useDashboardHooks';
import { useDeleteArena } from '../../hooks/useDeleteArena';
import { useUpdateArenaInfo } from 'hooks/useUpdateArenaInfo';
import EditArenaModal from 'components/EditArenaModal/EditArenaModal';

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
  const [loadingRedirect, setLoadingRedirect] = useState<number | null>(null);

  const [arenaFile, setArenaFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();

  const handleRedirectToReservation = (arenaId: number) => {
    if (loadingRedirect !== null) return; // já está indo

    setLoadingRedirect(arenaId);
    window.location.href = `/home/create-reservation/${arenaId}`;
  };

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
    setPreview(`${process.env.NEXT_PUBLIC_API_URL}/${arena.are_photo}`);
  };

  const handleDeleteArena = (arena: Arena) => {
    setDeleteArena(arena);
    setDeleteModalOpen(true);
  };

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f) {
      if (f.type.startsWith('image/')) {
        setArenaFile(f);
        setPreview(URL.createObjectURL(f));
      } else {
        alert('Selecione uma imagem válida');
        setArenaFile(null);
        setPreview(undefined);
      }
    } else {
      setArenaFile(null);
      setPreview(undefined);
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    if (!editArena) return;

    const form = new FormData();

    if (arenaFile) {
      form.append('are_photo', arenaFile);
    }
    form.append('usr_cod_alt', String(dashboardData.usr_id));
    form.append('are_id', String(editArena.are_id));
    form.append('are_name', String(arenaName));
    form.append('are_price', String(Number(arenaPrice)));
    form.append('are_category', String(arenaCategory));

    const { res, jsonData } = await updateArenaInfo(form);

    if (res && res.ok) {
      const updatedArena = jsonData.arena;

      const updatedArenas = arenas.map((arena) =>
        arena.are_id === updatedArena.are_id ? updatedArena : arena,
      );

      setArenas(updatedArenas);

      setModalMessage('Arena atualizada com sucesso!');
      setModalIsOpen(true);
      setEditModalOpen(false);
    } else {
      setModalMessage(
        jsonData?.message || 'Erro ao atualizar a arena. Tente novamente.',
      );
      setModalIsOpen(true);
    }
  };
  const handleConfirmDelete = async () => {
    if (!deleteArena) return;

    const { res, jsonData } = await deleteArenaRequest(deleteArena.are_id);

    if (res?.ok) {
      setArenas(arenas.filter((arena) => arena.are_id !== deleteArena.are_id));
      setModalMessage('Arena excluída com sucesso!');
    } else {
      setModalMessage(
        jsonData?.message ||
          `Erro ao excluir a arena. Verifique se não há reservas ativas para essa arena.`,
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
                isRedirecting={loadingRedirect === arena.are_id}
                arenaPhoto={`${process.env.NEXT_PUBLIC_API_URL}/${arena.are_photo}`}
                key={`${index}-${arena.are_id}`}
                arenaName={arena.are_name}
                arenaCategory={arena.are_category}
                arenaPrice={arena.are_price}
                goToReservation={() =>
                  handleRedirectToReservation(arena.are_id)
                }
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
      <EditArenaModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        arenaName={arenaName}
        setArenaName={setArenaName}
        arenaPrice={arenaPrice}
        setArenaPrice={setArenaPrice}
        arenaCategory={arenaCategory}
        setArenaCategory={setArenaCategory}
        editArena={editArena}
        preview={preview}
        arenaFile={arenaFile}
        handleFileUpload={handleFileUpload}
        loadingArenaInfo={loadingArenaInfo}
      />

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
          <p>Essa ação não poderá ser desfeita</p>

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
