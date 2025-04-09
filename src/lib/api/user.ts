import URLS from 'utils/apiRoutes';
import { apiClient } from './client';

export const userService = {
  async getUserInfo(): Promise<any> {
    return apiClient.get(URLS.GET_USER_INFO);
  },

 async updateUser(): Promise<any> {
    return apiClient.patch(
      URLS.UPDATE_USER_INFO,
    );
  },
};
