import URLS from 'utils/apiRoutes';
import { apiClient } from './client';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user?: any;
  message?: string;
}

interface RegisterUserData {
  usr_name: string;
  usr_email: string;
  usr_password: string;
  usr_cell_phone: string;
  usr_zipcode: string;
  usr_address: string;
  usr_city: string;
  own_document: string;
  own_code: string;
  is_owner: boolean;
}

interface RegisterEstablishmentData {
  est_name: string;
  est_phone: string;
  est_zipcode: string;
  est_address: string;
  est_city: string;
  usr_cod_cad: number;
  own_id: number;
}

export const authService = {
  /**
   * Realiza login do usuário
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<LoginResponse>(
        URLS.LOGIN,
        credentials,
        { token: false },
      );

      // Armazena o token na sessão
      if (response.token) {
        sessionStorage.setItem('auth-token', response.token);
      }

      return response;
    } catch (error) {
      console.error('Login Error:', error);
      throw error;
    }
  },

  async registerUser(userData: RegisterUserData): Promise<any> {
    return apiClient.post(URLS.REGISTER_USER, userData, { token: false });
  },

  async registerEstablishment(
    establishmentData: RegisterEstablishmentData,
  ): Promise<any> {
    return apiClient.post(URLS.REGISTER_ESTABLISHMENT, establishmentData);
  },

  async validateEmail(email: string): Promise<any> {
    return apiClient.post(URLS.EMAIL_VALIDATION, { email }, { token: false });
  },

  async verifyToken(): Promise<boolean> {
    try {
      await apiClient.get(URLS.VERIFY_TOKEN);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  logout(): void {
    sessionStorage.removeItem('auth-token');
  },
};
