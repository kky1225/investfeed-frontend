import axios from 'axios';
import {fetchReissue} from "./api/auth/AuthApi.ts";

const api = axios.create({
    baseURL: '/api',
    timeout: 20000,
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const res = await fetchReissue()
                const newToken = res.result?.accessToken;
                if (newToken) {
                    sessionStorage.setItem('accessToken', newToken);
                    api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
                    processQueue(null, newToken);
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                processQueue(refreshError, null);
                sessionStorage.removeItem('accessToken');
                sessionStorage.removeItem('user');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token);
        }
    });
    failedQueue = [];
};

export default api;
