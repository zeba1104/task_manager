import axios from 'axios';

export const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
        ? 'https://web-production-8dd16.up.railway.app/api'
        : 'http://localhost:5000/api');
export const FILE_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

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
