'use client';

import { DeleteButton } from './delete-button';

export function DeleteVenueButton({ venueId }: { venueId: string }) {
  return (
    <DeleteButton
      label="Excluir espaço"
      warning="Excluir o espaço apaga também quadras, preços, bloqueios e fotos. Esta ação não pode ser desfeita."
      path={`/owner/venues/${venueId}`}
      redirectTo="/painel"
    />
  );
}
