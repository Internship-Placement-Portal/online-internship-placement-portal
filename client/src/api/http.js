import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Access token lives in memory only (never localStorage); the refresh token is an httpOnly cookie.
let accessToken = null;
let onSessionLost = () => {};

export const setAccessToken = (t) => {
  accessToken = t;
};
export const setSessionLostHandler = (fn) => {
  onSessionLost = fn;
};

export const http = axios.create({ baseURL, withCredentials: true });
// Separate instance so refresh calls never trigger the interceptor below.
const bare = axios.create({ baseURL, withCredentials: true });

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing = null;
export function refreshSession() {
  // Single-flight: concurrent 401s share one refresh (refresh tokens rotate, so parallel calls would clash).
  if (!refreshing) {
    refreshing = bare
      .post('/auth/refresh')
      .then((res) => {
        accessToken = res.data.token;
        return res.data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const code = error.response?.data?.code;
    const retryable =
      error.response?.status === 401 && ['TOKEN_EXPIRED', 'INVALID_TOKEN', 'UNAUTHENTICATED'].includes(code);
    if (retryable && original && !original._retried) {
      original._retried = true;
      try {
        await refreshSession();
        return http(original);
      } catch {
        accessToken = null;
        onSessionLost();
      }
    }
    return Promise.reject(error);
  }
);

// Normalises the server error envelope { status, code, message, errors } for the UI.
export function errorInfo(err) {
  const data = err.response?.data;
  return {
    status: err.response?.status,
    code: data?.code,
    message: data?.message || (err.request ? 'Cannot reach the server. Check your connection.' : 'Something went wrong.'),
    errors: data?.errors || [],
  };
}
