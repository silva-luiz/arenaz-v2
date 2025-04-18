
const BASE_URL = 'http://127.0.0.1:8000/';
// const BASE_URL = 'https://572d-170-231-235-156.ngrok-free.app/';

const URLS = {
  // User
  EMAIL_VALIDATION: `${BASE_URL}api/email-validation`,
  REGISTER_USER: `${BASE_URL}api/user`,
  GET_USER_INFO: `${BASE_URL}api/get-user`,
  UPDATE_USER_INFO: `${BASE_URL}api/user/update`,

  // Establishment
  REGISTER_ESTABLISHMENT: `${BASE_URL}api/establishment`,
  GET_ESTABLISHMENT: `${BASE_URL}api/establishment/user/`,
  GET_ESTABLISHMENT_INFO: `${BASE_URL}api/establishment/get-establishment/`,
  ESTABLISHMENT_INFO: `${BASE_URL}api/establishment/info/`,
  GET_ALL_ESTABLISHMENTS: `${BASE_URL}api/establishments`,
  UPDATE_ESTABLISHMENT: `${BASE_URL}api/establishment/update/`,
  DELETE_ESTABLISHMENT: `${BASE_URL}api/establishment/del/`,

  // Arena
  REGISTER_ARENA: `${BASE_URL}api/arena`,
  GET_USER_ARENAS: `${BASE_URL}api/arenas/user`,
  GET_ARENA_INFO: `${BASE_URL}api/arena/get-arena`,
  UPDATE_ARENA_INFO: `${BASE_URL}api/arena/update`,
  DELETE_ARENA: `${BASE_URL}api/arena`,
  GET_SINGLE_ARENA_INFO: `${BASE_URL}api/arena/{id}`,

  // Reservation
  CREATE_RESERVATION: `${BASE_URL}api/reservation`,

  // Login
  LOGIN: `${BASE_URL}api/login`,
  VERIFY_TOKEN: `${BASE_URL}api/verify-token`,

  // Dashboard
  LOAD_DASHBOARD: `${BASE_URL}api/load-dashboard`,
};

export default URLS;
