/**
 * Serviços para gerenciamento de reservas
 */

import { apiClient } from './client';

// Aqui você pode adicionar endpoints específicos para reservas quando estiverem disponíveis
export const reservationsService = {
  /**
   * Obtém horários disponíveis para reserva
   */
  async getAvailableTimes(arenaId: string): Promise<any> {
    // Este é um exemplo - ajuste conforme necessário quando a API estiver disponível
    return apiClient.get(`/api/arenas/${arenaId}/available-times`);
  },

  /**
   * Cria uma nova reserva
   */
  async createReservation(data: any): Promise<any> {
    // Este é um exemplo - ajuste conforme necessário quando a API estiver disponível
    return apiClient.post('/api/reservations', data);
  },

  async getActiveReservations(): Promise<any> {
    // Este é um exemplo - ajuste conforme necessário quando a API estiver disponível
    return apiClient.get('/api/reservations/active');
  },
};
