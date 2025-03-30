import URLS from 'utils/apiRoutes';
import { apiClient } from './client';

export const establishmentsService = {
  async getEstablishmentInfo(): Promise<any> {
    return apiClient.get(URLS.ESTABLISHMENT_INFO);
  },

  async getEstablishmentByUserId(userId: string): Promise<any> {
    return apiClient.get(`${URLS.GET_ESTABLISHMENT}${userId}`);
  },

  async getAllEstablishments(): Promise<any> {
    return apiClient.get(URLS.GET_ALL_ESTABLISHMENTS);
  },

  async updateEstablishment(establishmentId: string, data: any): Promise<any> {
    return apiClient.put(
      `${URLS.UPDATE_ESTABLISHMENT}${establishmentId}`,
      data,
    );
  },

  async deleteEstablishment(establishmentId: string): Promise<any> {
    return apiClient.delete(`${URLS.DELETE_ESTABLISHMENT}${establishmentId}`);
  },
};
