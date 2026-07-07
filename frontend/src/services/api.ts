import axios, { InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management helpers
const TOKEN_KEY = 'smartstudy_access_token';
const REFRESH_TOKEN_KEY = 'smartstudy_refresh_token';
const USER_KEY = 'smartstudy_user';

export const getAccessToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY);
export const getStoredUser = () => {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
};

export const setTokens = (accessToken: string, refreshToken?: string) => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const setStoredUser = (user: unknown) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error)
);

// Response interceptor for handling auth errors with refresh token support
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // If 401 and not already retrying and not on the refresh endpoint itself
    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !originalRequest?.url?.includes('/auth/refresh') &&
      !originalRequest?.url?.includes('/auth/login')
    ) {
      originalRequest._retry = true;
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const refreshResp = await api.post<{ tokens: { accessToken: string; refreshToken: string } }>(
            '/auth/refresh',
            { refreshToken }
          );
          const { accessToken, refreshToken: newRefreshToken } = refreshResp.data.tokens;
          setTokens(accessToken, newRefreshToken);
          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return api(originalRequest);
        } catch {
          // Refresh failed — clear auth and redirect
          clearAuth();
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/welcome')) {
            window.location.href = '/welcome';
          }
        }
      } else {
        // No refresh token — clear auth and redirect
        clearAuth();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/welcome')) {
          window.location.href = '/welcome';
        }
      }
    }
    return Promise.reject(error);
  }
);
