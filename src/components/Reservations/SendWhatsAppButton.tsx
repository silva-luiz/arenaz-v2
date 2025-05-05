import React from 'react';

interface SendWhatsAppButtonProps {
  playerName: string;
  phoneNumber: string; // Ex: 11999999999
  qrCodePayload: string; // A string do QR, não o base64 da imagem
}

export const SendWhatsAppButton: React.FC<SendWhatsAppButtonProps> = ({
  playerName,
  phoneNumber,
  qrCodePayload,
}) => {
  const handleSendWhatsApp = () => {
    const message = encodeURIComponent(
      `Olá ${playerName}! Segue o QR Code para pagamento da sua reserva:\n\n${qrCodePayload}`,
    );
    const url = `https://wa.me/55${phoneNumber}?text=${message}`;
    window.open(url, '_blank');
  };

  return (
    <button onClick={handleSendWhatsApp} className="primaryButton" type="button">
      Enviar QR Code via WhatsApp
    </button>
  );
};
