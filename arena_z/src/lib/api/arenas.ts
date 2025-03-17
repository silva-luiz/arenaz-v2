/**
 * Serviços para gerenciamento de arenas
 */

import URLS from "utils/apiRoutes"
import { apiClient } from "./client"


interface ArenaData {
  are_name: string
  are_price: string
  are_category: string
  usr_cod_cad: number
  est_id: number
}

export const arenasService = {
  /**
   * Obtém todas as arenas do usuário
   */
  async getUserArenas(): Promise<any> {
    return apiClient.get(URLS.GET_USER_ARENAS)
  },

  /**
   * Registra uma nova arena
   */
  async registerArena(arenaData: ArenaData): Promise<any> {
    return apiClient.post(URLS.REGISTER_ARENA, arenaData)
  },

  /**
   * Carrega dados do dashboard (inclui arenas)
   */
  async loadDashboard(): Promise<any> {
    return apiClient.get(URLS.LOAD_DASHBOARD)
  },
}

