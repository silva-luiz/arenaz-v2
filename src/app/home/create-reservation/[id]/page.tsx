'use client';

import CreateReservationPage from 'components/Reservations/CreateReservationPage';

interface Props {
  params: { id: number };
}

export default function CreateReservation({ params }: Props) {
  return <CreateReservationPage arenaId={params.id} />;
}
