'use client';
import Button from '../Button';
import styles from '../Dashboard/DashboardPage.module.scss';
import ArenaCard from './ArenaCard';
import Modal from 'react-modal';
import { useDashboardHooks } from '../../hooks/useDashboardHooks';
import { useDeleteArena } from '../../hooks/useDeleteArena';
import { useUpdateArenaInfo } from '../../hooks/useUpdateArenaInfo';
import { useState, useEffect, ChangeEvent } from 'react';
import URLS from '../../utils/apiRoutes';
import WarningIcon from '@mui/icons-material/Warning';
import Link from 'next/link';
import { CircularProgress } from '@mui/material';
import EditArenaModal from 'components/EditArenaModal/EditArenaModal';

const url = URLS.LOAD_DASHBOARD;
const urlUpdateArena = URLS.UPDATE_ARENA_INFO;
const urlDeleteArena = URLS.DELETE_ARENA;

interface IDashboardPageProps {
  isExpiredSession?: boolean;
  setIsExpiredSession?: () => void;
}

interface Arena {
  are_id: number;
  are_name: string;
  are_price: number;
  are_category: string;
  are_photo: string;
}

const DashboardPage = ({ isExpiredSession }: IDashboardPageProps) => {
  const {
    data: dashboardData,
    loading,
    error,
  } = useDashboardHooks({ url, method: 'GET' });

  const [arenaName, setArenaName] = useState('');
  const [arenaPrice, setArenaPrice] = useState('');
  const [arenaCategory, setArenaCategory] = useState('');

  const [arenaFile, setArenaFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();

  const { deleteArena: deleteArenaRequest, loadingDelete } =
    useDeleteArena(urlDeleteArena);

  const { updateArenaInfo, loadingArenaInfo } =
    useUpdateArenaInfo(urlUpdateArena);

  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const arenas = dashboardData?.arenas ?? [];
  const [editArena, setEditArena] = useState<Arena | null>(null);
  const [deleteArena, setDeleteArena] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [loadingRedirect, setLoadingRedirect] = useState<number | null>(null);

  const handleRedirectToReservation = (arenaId: number) => {
    if (loadingRedirect !== null) return; // já está indo

    setLoadingRedirect(arenaId);
    window.location.href = `/home/create-reservation/${arenaId}`;
  };

  const handleEditArena = (arena) => {
    setEditArena(arena);
    setEditModalOpen(true);
  };

  const handleDeleteArena = (arena) => {
    setDeleteArena(arena);
    setDeleteModalOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
  };

  useEffect(() => {
    if (editArena) {
      setArenaName(editArena.are_name || '');
      setArenaPrice(String(editArena.are_price || ''));
      setArenaCategory(editArena.are_category || '');
      setArenaFile(null);
      setPreview(`${process.env.NEXT_PUBLIC_API_URL}/${editArena.are_photo}`);
    }
  }, [editArena]);

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

      dashboardData.arenas = updatedArenas;

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

    console.log('Resposta da API:', res, jsonData);

    if (res && res.ok) {
      const updatedArenas = arenas.filter(
        (a) => a.are_id !== deleteArena.are_id,
      );
      dashboardData.arenas = updatedArenas;
      setModalMessage('Arena excluída com sucesso!');
      setModalIsOpen(true);
    } else {
      setModalMessage(
        jsonData?.message ||
          'Erro ao excluir a arena. Tente novamente mais tarde. Certifique-se de que não há reservas ativas para esta arena.',
      );
      setModalIsOpen(true);
    }

    setDeleteModalOpen(false);
  };

  return (
    <div className={styles.dashboardMainContent}>
      <div>
        <div className={styles.actionButtonContainer}>
          <h2 className={styles.dashboardTitle}>Minhas Arenas</h2>
          <Link
            href={{
              pathname: 'new-arena',
            }}
          >
            <Button text="+ Nova arena" className="secondaryButton" />
          </Link>
        </div>

        {/* Verificação de carregamento e erro */}
        {loading ? (
          <div className={styles.loadingContainer}>
            <CircularProgress color="warning" />
            <p className={styles.loadingText}>Carregando dados...</p>
          </div>
        ) : error ? (
          <p className={styles.errorMessage}>
            Erro ao carregar arenas: {error}
          </p>
        ) : dashboardData && arenas.length === 0 ? (
          <div className={styles.noArenasContainer}>
            <WarningIcon style={{ color: 'orange', fontSize: 48 }} />
            <p className={styles.noArenasMessage}>
              Você ainda não tem nenhuma Arena cadastrada. Adicione uma nova!
            </p>
          </div>
        ) : (
          <div className={styles.cardsContainer}>
            {dashboardData &&
              arenas
                .slice(0, 5)
                .map((arena, index) => (
                  <ArenaCard
                    key={`${index}-${arena.are_id} `}
                    arenaName={arena.are_name}
                    arenaCategory={arena.are_category}
                    arenaPrice={arena.are_price}
                    arenaPhoto={`${process.env.NEXT_PUBLIC_API_URL}/${arena.are_photo}`}
                    goToReservation={() =>
                      handleRedirectToReservation(arena.are_id)
                    }
                    onEdit={() => handleEditArena(arena)}
                    onDelete={() => handleDeleteArena(arena)}
                    isRedirecting={loadingRedirect === arena.are_id}
                  />
                ))}
            {arenas.length > 5 && (
              <div className={styles.seeAllButtonContainer}>
                <Link href="/home/all-arenas">
                  <Button text="Ver todas" className="secondaryButton" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <h2 className={styles.dashboardTitle}>Informações financeiras</h2>
      <div className={styles.reservationStatusContainer}>
      {dashboardData && arenas.length > 0 && (
  <>
    <div className={styles.reservationIndicator}>
      <p className={styles.valueTitle}>Total de reservas</p>
      <p className={styles.reservationValue}>
        {dashboardData.indicators.total_reservations}
      </p>
    </div>

    <div className={styles.reservationIndicator}>
      <p className={styles.valueTitle}>Valor recebido</p>
      <p className={styles.receivedValue}>
        {dashboardData.indicators.total_received.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })}
      </p>
    </div>

    <div className={styles.reservationIndicator}>
      <p className={styles.valueTitle}>Pagamentos adiantados</p>
      <p className={styles.receivedValue}>
        {dashboardData.indicators.active_received.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })}
      </p>
    </div>

    <div className={styles.reservationIndicator}>
      <p className={styles.valueTitle}>Valor a receber</p>
      <p className={styles.reservationValue}>
        {dashboardData.indicators.total_pending.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })}
      </p>
    </div>

    <div className={styles.reservationIndicator}>
      <p className={styles.valueTitle}>Pagamentos atrasados</p>
      <p className={styles.overdueValue}>
        {dashboardData.indicators.overdue_debts.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })}
      </p>
    </div>
  </>
)}


        {dashboardData && arenas.length === 0 && (
          <p className={styles.noReservationsMessage}>
            Você ainda não tem reservas ativas.
          </p>
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
          <h2 className={styles.modalTitle}>Aviso</h2>
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
          <p>Essa ação nao poderá ser desfeita</p>
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

export default DashboardPage;
