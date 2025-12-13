// API Configuration
// In development, use empty string to leverage Vite's proxy (same-origin requests)
// This ensures cookies work correctly regardless of localhost vs 127.0.0.1
// In production, use the full API URL from environment
const isDev = import.meta.env.DEV;
export const API_URL = isDev ? '' : (import.meta.env.VITE_API_URL || '');

export const appConfig = {
  showTeasers: import.meta.env.VITE_SHOW_TEASERS !== 'false',
};
