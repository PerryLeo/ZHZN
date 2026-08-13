const TOKEN_KEY = 'CKZS_ADMIN_TOKEN';
const USER_KEY = 'CKZS_ADMIN_USER';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
};

export const saveSession = ({ token, user }) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const isAdmin = () => Boolean(getToken() && getUser()?.role === 'admin');
