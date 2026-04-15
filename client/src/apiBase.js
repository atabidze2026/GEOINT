export const API_BASE = import.meta.env.VITE_API_BASE || '';

export function apiUrl(path) {
  if (!path) return API_BASE || '';
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE) return path;
  return `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export default apiUrl;
