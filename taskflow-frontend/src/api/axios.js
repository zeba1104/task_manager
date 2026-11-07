import axios from 'axios';

// When running on localhost, point to local backend (port 5000).
// In production on Vercel, use relative '/api' reverse-proxied by Vercel to Railway,
// completely bypassing client-side ISP network blocks and CORS!
export const API_BASE_URL =
    typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? (process.env.REACT_APP_API_URL || 'http://localhost:5000/api')
        : '/api';

export const FILE_BASE_URL =
    typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? (process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:5000')
        : '';

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Automatically attach token to every request, if logged in
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
