'use client';

import Form from 'react-bootstrap/Form';
import DatePicker from 'react-datepicker';

import { registerLocale } from 'react-datepicker';
import { ptBR } from 'date-fns/locale';
import { useState, useRef } from 'react';
import { QrCodePix } from 'qrcode-pix';
import { format } from 'date-fns';
import Image from 'next/image';
import 'react-datepicker/dist/react-datepicker-cssmodules.css';
import 'react-datepicker/dist/react-datepicker.css';
import styles from '../Reservations/CreateReservationPage.module.scss';
import URLS from 'utils/apiRoutes';
import { useCreateReservation } from 'hooks/useCreateReservation';
import { useRouter } from 'next/navigation';
import { useFetchArenaInfo } from 'hooks/useFetchArenaInfo';
import { useFetchAvailableHours } from 'hooks/useFetchAvailableHours';
import { CategoryLabel } from './CategoryLabel';
import { SendWhatsAppButton } from './SendWhatsAppButton';
import InputMask from 'react-input-mask';

registerLocale('pt-BR', ptBR);

const reservationUrl = URLS.CREATE_RESERVATION;
const arenaInfoUrl = URLS.GET_SINGLE_ARENA_INFO;
const availableHoursURL = URLS.FETCH_AVAILABLE_HOURS;

interface Props {
  arenaId: number;
}

const CreateReservationPage = ({ arenaId }: Props) => {
  const [startDate, setStartDate] = useState(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  const [price, setPrice] = useState('');
  const [priceFormatted, setPriceFormatted] = useState('');
  const [advancePayment, setAdvancePayment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [qrCodePayload, setQrCodePayload] = useState('');
  const [advanceAmountFormatted, setAdvanceAmountFormatted] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState(null);

  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);

  const { arenaData, loadingArena, error } = useFetchArenaInfo(
    `${arenaInfoUrl}/${arenaId}`,
  );

  const { createReservation, loadingReservation, reservationError } =
    useCreateReservation(reservationUrl);

  const { fetchAvailableHours } = useFetchAvailableHours(availableHoursURL);

  const router = useRouter();

  const handleStartTimeChange = (e) => {
    setStartTime(e.target.value);
    console.log('Horário de início selecionado:', e.target.value);
  };

  const handleEndTimeChange = (e) => {
    setEndTime(e.target.value);
    console.log('Horário de término selecionado:', e.target.value);
  };

  const handleDateChange = async (date) => {
    setStartDate(date); // salva a data selecionada

    if (!arenaId) {
      console.error('Arena ID not available');
      return;
    }

    const reservationHoursData = {
      are_id: arenaId,
      res_date: format(date, 'dd-MM-yyyy'),
    };

    try {
      const { res, jsonData } = await fetchAvailableHours(reservationHoursData);
      if (res.ok) {
        console.log('Horários disponíveis:', jsonData);
        console.log('jsonData.available_hours:', jsonData.available_hours);
        console.log('Tipo:', typeof jsonData.available_hours);
        setAvailableTimes(jsonData.available_hours.available_hours);
      } else {
        console.error('Erro ao buscar horários disponíveis:', res.statusText);
      }
    } catch (err) {
      console.error('Erro na requisição de horários:', err);
    }
  };

  const arena = arenaData?.arena;
  const qrcode = arenaData?.qrcode;

  const arenaName = arena?.are_name || 'Arena não encontrada';
  const arenaCategory = arena?.are_category || 'Categoria não encontrada';
  const arenaPrice = arena?.are_price || 'Preço não encontrado';
  const userId = arenaData?.usr_id || 'Usuário não encontrado';
  const establishmentCity = qrcode?.city || 'Cidade não encontrada';
  const pixKey = qrcode?.own_code || 'Chave PIX não encontrada';
  const establishmentOwner = qrcode?.usr_name || 'Proprietário não encontrado';

  const are_id = arenaId;

  const normalizeCity = (city: string) => {
    return city
      .normalize('NFD') // separa letras de acentos
      .replace(/[\u0300-\u036f]/g, '') // remove os acentos
      .toUpperCase(); // transforma em maiúsculo
  };

  // Salva apenas os números no state
  const handlePhoneChange = (e) => {
    const maskedValue = e.target.value;
    const onlyDigits = maskedValue.replace(/\D/g, '');
    setPlayerPhone(onlyDigits);
  };

  // Formata visualmente para mostrar no campo
  const formatPhone = (raw) => {
    if (!raw) return '';
    return raw.replace(/^(\d{2})(\d{1})(\d{4})(\d{4})$/, '($1)$2 $3-$4');
  };

  const handlePriceChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    const numeric = parseFloat(raw) / 100;

    if (isNaN(numeric)) {
      setPrice(null);
      setPriceFormatted('');
      return;
    }

    setPrice(numeric); // número limpo para o backend
    setPriceFormatted(
      numeric.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    );
  };

  const handleAdvanceAmountChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    const numeric = parseFloat(raw) / 100;

    if (isNaN(numeric)) {
      setAdvanceAmount(null);
      setAdvanceAmountFormatted('');
      return;
    }

    setAdvanceAmount(numeric); // valor numérico real (ex: 123.45)
    setAdvanceAmountFormatted(
      numeric.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    ); // valor formatado (ex: "R$ 123,45")
  };

  const generateQRCode = async () => {
    const qrCodePix = QrCodePix({
      version: '01',
      key: pixKey,
      name: establishmentOwner,
      city: normalizeCity(establishmentCity),
      value: parseFloat(advanceAmount),
    });

    const base64 = await qrCodePix.base64();
    setQrCodeBase64(base64);

    const payload = qrCodePix.payload();
    setQrCodePayload(payload);
  };

  const handleDownload = () => {
    if (downloadLinkRef.current && qrCodeBase64) {
      downloadLinkRef.current.href = qrCodeBase64;
      downloadLinkRef.current.download = 'qrcode-pix.png';
      downloadLinkRef.current.click();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loadingReservation) return; // Evita múltiplos envios

    if (!are_id) {
      console.error('Arena ID not available');
      return;
    }

    try {
      const formattedDate = format(startDate, 'dd-MM-yyyy');
      const reservation = {
        are_id: arenaId,
        usr_cod_cad: userId,
        usr_id: userId,
        res_player_name: playerName,
        res_cel_phone: playerPhone,
        res_value: price,
        res_date: formattedDate,
        res_start_time: startTime,
        res_end_time: endTime,
        res_payment_advance: advanceAmount,
      };

      const { res, jsonData } = await createReservation(reservation);

      if (res.ok) {
        setShowModal(true);
      } else {
        setShowModal(true);
      }
    } catch (error) {
      console.error('Erro inesperado ao registrar reserva:', error);
    }
  };

  return (
    <div>
      <h2 className={styles.pageTitle}>Criar nova reserva</h2>
      <h2 className={styles.pageTitle}>Informações da Arena</h2>
      <div className={styles.arenaInfosContainer}>
        <div className={styles.singleInfoContainer}>
          <h4 className={styles.arenaInfo}>Nome da Arena</h4>
          <p>{arenaName}</p>
        </div>
        <div className={styles.singleInfoContainer}>
          <h4 className={styles.arenaInfo}>Categoria</h4>
          <CategoryLabel category={arenaCategory} />
        </div>
        <div className={styles.singleInfoContainer}>
          <h4 className={styles.arenaInfo}>Valor / hora</h4>
          <p>R$ {arenaPrice}/hora</p>
        </div>
      </div>

      <h2 className={styles.pageTitle}>Datas e horários disponíveis</h2>
      <p className={styles.pageSubtitle}>
        Escolha o dia, horário de início e horário de término para o seu
        agendamento:
      </p>

      <div className={styles.arenaInfosContainer}>
        <div className={styles.reservationContainer}>
          <form onSubmit={handleSubmit} className={styles.reservationForm}>
            <div className={styles.timePickerContainer}>
              <h4 className={styles.arenaInfo}>Data da reserva</h4>
              <DatePicker
                selected={startDate}
                onChange={(date) => {
                  setStartDate(date);
                  handleDateChange(date);
                }}
                dateFormat="dd/MM/yyyy"
                locale="pt-BR"
                minDate={new Date()}
                className={styles.datePickerInput}
                wrapperClassName={styles.datePickerWrapper}
              />
            </div>

            <div className={styles.selectTimeContainer}>
              <div className={styles.timePickerContainer}>
                <h4 className={styles.arenaInfo}>Horário de início</h4>
                <Form.Select
                  aria-label="Selecione o horário de início"
                  onChange={handleStartTimeChange}
                  value={startTime}
                  className={styles.selectTime}
                >
                  <option value="" className={styles.optionDefault}>
                    Selecione um horário...
                  </option>
                  {Array.isArray(availableTimes) &&
                    availableTimes.map((time) => (
                      <option
                        key={time}
                        value={time}
                        className={styles.optionTime}
                      >
                        {time}
                      </option>
                    ))}
                </Form.Select>
              </div>

              <div className={styles.timePickerContainer}>
                <h4 className={styles.arenaInfo}>Horário de saída</h4>
                <Form.Select
                  aria-label="Selecione o horário de término"
                  onChange={handleEndTimeChange}
                  value={endTime}
                  disabled={!startTime}
                  className={styles.selectTime}
                >
                  <option value="" className={styles.optionDefault}>
                    Selecione um horário...
                  </option>
                  {Array.isArray(availableTimes) &&
                    availableTimes
                      .filter((time) => time > startTime)
                      .map((time) => (
                        <option
                          key={time}
                          value={time}
                          className={styles.optionTime}
                        >
                          {time}
                        </option>
                      ))}
                </Form.Select>
              </div>
            </div>

            <div className={styles.inputContainer}>
              <label className={styles.inputLabel}>Jogador responsável</label>
              <div className={styles.inputWrapper}>
                <input
                  required
                  type="text"
                  placeholder="Nome"
                  name="responsiblePlayer"
                  className={styles.inputText}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.inputContainer}>
              <label className={styles.inputLabel}>Telefone para contato</label>
              <div className={styles.inputWrapper}>
                <InputMask
                  mask="(99)9 9999-9999"
                  value={formatPhone(playerPhone)}
                  onChange={handlePhoneChange}
                >
                  {(inputProps) => (
                    <input
                      {...inputProps}
                      required
                      type="text"
                      name="contactPhone"
                      placeholder="Telefone para contato"
                      className={styles.inputText}
                    />
                  )}
                </InputMask>
              </div>
            </div>

            <div className={styles.inputContainer}>
              <label className={styles.inputLabel}>Valor (R$)</label>
              <div className={styles.inputWrapper}>
                <input
                  required
                  type="text"
                  placeholder="Valor"
                  name="price"
                  className={styles.inputText}
                  value={priceFormatted}
                  onChange={handlePriceChange}
                />
              </div>
            </div>

            <h3 className={styles.arenaInfo}>Pagamento adiantado?</h3>
            <div className={styles.radioContainer}>
              <div className={styles.radioItem}>
                <input
                  type="radio"
                  id="yes"
                  name="advancePayment"
                  value="yes"
                  required
                  onChange={(e) => setAdvancePayment(e.target.value)}
                />
                <label htmlFor="yes">Sim</label>
              </div>
              <div className={styles.radioItem}>
                <input
                  type="radio"
                  id="no"
                  name="advancePayment"
                  value="Não"
                  required
                  onChange={(e) => setAdvancePayment(e.target.value)}
                />
                <label htmlFor="no">Não</label>
              </div>
            </div>

            {advancePayment === 'yes' && (
              <>
                <h3 className={styles.arenaInfo}>Valor adiantado</h3>

                <div className={styles.formContainer}>
                  <div className={styles.inputContainer}>
                    <label
                      htmlFor="advanceAmount"
                      className={styles.inputLabel}
                    >
                      Valor adiantado
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        type="text"
                        name="advanceAmount"
                        id="advanceAmount"
                        placeholder="Valor adiantado"
                        value={advanceAmountFormatted}
                        onChange={handleAdvanceAmountChange}
                        onBlur={generateQRCode}
                        required
                      />
                    </div>
                  </div>
                  {qrCodeBase64 ? (
                    <>
                      <h3 className={styles.arenaInfo}>
                        QRCode para pagamento
                      </h3>
                      <p className={styles.pageSubtitle}>
                        Faça o download do QRCode para pagamento ou envie o
                        código para seu cliente:
                      </p>
                      <Image
                        src={qrCodeBase64}
                        alt="QR Code Pix"
                        width={256}
                        height={256}
                        style={{ width: 256, height: 256 }}
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="primaryButton"
                      >
                        Baixar QR Code
                      </button>

                      <a ref={downloadLinkRef} style={{ display: 'none' }}>
                        Download
                      </a>

                      <SendWhatsAppButton
                        playerName={playerName}
                        phoneNumber={playerPhone}
                        qrCodePayload={qrCodePayload}
                      />
                    </>
                  ) : (
                    <></>
                  )}
                </div>
              </>
            )}

            <div className={styles.formActions}>
              <button
                type="submit"
                className="primaryButton"
                disabled={loadingReservation}
              >
                {loadingReservation ? 'Reservando...' : 'Criar reserva'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Reserva criada com sucesso!</h2>
            <p className={styles.modalSubtitle}>
              Você pode retornar para a tela principal.
            </p>
            <button
              className="primaryButton"
              onClick={() => {
                router.push('/home/dashboard');
                setShowModal(false);
              }}
            >
              Ir para o Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateReservationPage;
