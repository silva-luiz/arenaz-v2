
const BASE_URL = 'https://9545-170-231-235-156.ngrok-free.app/';

const URLS = {
  // User
  REGISTER_USER: `${BASE_URL}api/user`,
  EMAIL_VALIDATION: `${BASE_URL}api/email-validation`,

  // Establishment
  REGISTER_ESTABLISHMENT: `${BASE_URL}api/establishment`,
  GET_ESTABLISHMENT: `${BASE_URL}api/establishment/user/`,
  ESTABLISHMENT_INFO: `${BASE_URL}api/establishment/info/`,
  GET_ALL_ESTABLISHMENTS: `${BASE_URL}api/establishments`,
  UPDATE_ESTABLISHMENT: `${BASE_URL}api/establishments/cad/`,
  DELETE_ESTABLISHMENT: `${BASE_URL}api/establishments/del/`,

  // Arena
  REGISTER_ARENA: `${BASE_URL}api/arena`,
  GET_USER_ARENAS: `${BASE_URL}api/arenas/user`,

  // Login
  LOGIN: `${BASE_URL}api/login`,
  VERIFY_TOKEN: `${BASE_URL}api/verify-token`,

  // Dashboard
  LOAD_DASHBOARD: `${BASE_URL}api/load-dashboard`,
};

export default URLS;
