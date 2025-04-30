'use client';
import Button from '../Button';
import styles from '../Dashboard/DashboardPage.module.scss';
import ArenaCard from './ArenaCard';
import Modal from 'react-modal';
import { useDashboardHooks } from '../../hooks/useDashboardHooks';
import { useDeleteArena } from '../../hooks/useDeleteArena';
import { useUpdateArenaInfo } from '../../hooks/useUpdateArenaInfo';
import { useState, useEffect } from 'react';
import URLS from '../../utils/apiRoutes';
import WarningIcon from '@mui/icons-material/Warning';
import Link from 'next/link';
import { CircularProgress } from '@mui/material';

const url = URLS.LOAD_DASHBOARD;
const urlUpdateArena = URLS.UPDATE_ARENA_INFO;
const urlDeleteArena = URLS.DELETE_ARENA;

interface IDashboardPageProps {
  isExpiredSession?: boolean;
  setIsExpiredSession?: () => void;
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

  const { deleteArena: deleteArenaRequest, loadingDelete } =
    useDeleteArena(urlDeleteArena);

  const { updateArenaInfo, loadingArenaInfo } =
    useUpdateArenaInfo(urlUpdateArena);

  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const arenas = dashboardData?.arenas ?? [];
  const [editArena, setEditArena] = useState(null);
  const [deleteArena, setDeleteArena] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

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
    }
  }, [editArena]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    if (!editArena) return;

    const updatedArenaData = {
      usr_cod_alt: dashboardData.usr_id,
      are_id: editArena.are_id,
      are_name: arenaName,
      are_price: Number(arenaPrice),
      are_category: arenaCategory,
    };

    const { res, jsonData } = await updateArenaInfo(updatedArenaData);

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
                    goToReservation={`/home/create-reservation/${arena.are_id}`}
                    onEdit={() => handleEditArena(arena)}
                    onDelete={() => handleDeleteArena(arena)}
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

      <h2 className={styles.dashboardTitle}>Reservas ativas</h2>
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
                R$ {dashboardData.indicators.total_received},00
              </p>
            </div>
            <div className={styles.reservationIndicator}>
              <p className={styles.valueTitle}>Valor a receber</p>
              <p className={styles.reservationValue}>
                R$ {dashboardData.indicators.total_pending},00
              </p>
            </div>
            <div className={styles.reservationIndicator}>
              <p className={styles.valueTitle}>Pagamentos atrasados</p>
              <p className={styles.overdueValue}>
                R$ {dashboardData.indicators.overdue_debts},00
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
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="outlinedButton"
              >
                Cancelar
              </button>
              <button type="submit" className="primaryButton">
                {loadingArenaInfo ? 'Atualizando...' : 'Salvar'}
              </button>
            </div>
          </form>
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
