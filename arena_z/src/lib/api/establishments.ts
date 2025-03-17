/**
 * Serviços para gerenciamento de estabelecimentos
 */

import URLS from "utils/apiRoutes"
import { apiClient } from "./client"

export const establishmentsService = {
  /**
   * Obtém informações do estabelecimento do usuário
   */
  async getEstablishmentInfo(): Promise<any> {
    return apiClient.get(URLS.ESTABLISHMENT_INFO)
  },

  /**
   * Obtém estabelecimento por ID de usuário
   */
  async getEstablishmentByUserId(userId: string): Promise<any> {
    return apiClient.get(`${URLS.GET_ESTABLISHMENT}${userId}`)
  },

  /**
   * Obtém todos os estabelecimentos
   */
  async getAllEstablishments(): Promise<any> {
    return apiClient.get(URLS.GET_ALL_ESTABLISHMENTS)
  },

  /**
   * Atualiza informações do estabelecimento
   */
  async updateEstablishment(establishmentId: string, data: any): Promise<any> {
    return apiClient.put(`${URLS.UPDATE_ESTABLISHMENT}${establishmentId}`, data)
  },

  /**
   * Remove um estabelecimento
   */
  async deleteEstablishment(establishmentId: string): Promise<any> {
    return apiClient.delete(`${URLS.DELETE_ESTABLISHMENT}${establishmentId}`)
  },
}

