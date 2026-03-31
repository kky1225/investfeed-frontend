import axios from 'axios';
import {fetchReissue} from "./api/auth/AuthApi.ts";

const api = axios.create({
    baseURL: '/api',
    timeout: 20000,
    withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

let isSecondaryAuthPending = false;
let secondaryAuthQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        const isLoginRequest = originalRequest.url?.startsWith('/auth/login');

        if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(() => api(originalRequest));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const res = await fetchReissue();
                if (res.result) {
                    const storedUser = sessionStorage.getItem('user');
                    if (storedUser) {
                        const user = JSON.parse(storedUser);
                        if (res.result.role) user.role = res.result.role;
                        if (res.result.nickname) user.nickname = res.result.nickname;
                        if (res.result.email) user.email = res.result.email;
                        sessionStorage.setItem('user', JSON.stringify(user));
                    }
                }
                processQueue(null);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError);
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('passwordChangeRequired');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        if (error.response?.status === 403) {
            const code = error.response?.data?.code;
            const isSecondaryPasswordRequest = originalRequest.url?.startsWith('/auth/secondary-password/');
            if (isSecondaryPasswordRequest) {
                return Promise.reject(error);
            }
            if (code === 'AUTH_4040' || code === 'AUTH_4041' || code === 'AUTH_4044') {
                if (isSecondaryAuthPending) {
                    return new Promise((resolve, reject) => {
                        secondaryAuthQueue.push({ resolve, reject });
                    }).then(() => api(originalRequest));
                }

                isSecondaryAuthPending = true;
                window.dispatchEvent(new CustomEvent('show-secondary-auth', { detail: { code } }));

                return new Promise((resolve, reject) => {
                    secondaryAuthQueue.push({ resolve, reject });
                }).then(() => api(originalRequest));
            }
            const message = error.response?.data?.message || '접근 권한이 없습니다.';
            window.dispatchEvent(new CustomEvent('show-forbidden', { detail: { message } }));
            return new Promise(() => {});
        }

        return Promise.reject(error);
    }
);

const processQueue = (error: unknown) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(undefined);
        }
    });
    failedQueue = [];
};

export const processSecondaryAuthQueue = (error: unknown) => {
    secondaryAuthQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(undefined);
        }
    });
    secondaryAuthQueue = [];
    isSecondaryAuthPending = false;
};

export default api;
