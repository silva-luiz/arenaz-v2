'use client';

import UpdateReservationPage from 'components/Reservations/UpdateReservationPage';

interface Props {
  params: { id: number };
}

export default function CreateReservation({ params }: Props) {
  return <UpdateReservationPage arenaId={params.id} />;
}
