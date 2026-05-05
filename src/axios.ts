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
        const isReissueRequest = originalRequest.url?.startsWith('/auth/reissue');
        // 2차 비밀번호 관련 요청은 모든 에러(403/400/500/네트워크)를 SecondaryAuthDialog 내부에서 처리.
        const isSecondaryPasswordRequest = originalRequest.url?.startsWith('/auth/secondary-password/');

        if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest && !isReissueRequest) {
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
                        if (res.result.permissions) user.permissions = res.result.permissions;
                        sessionStorage.setItem('user', JSON.stringify(user));
                    }
                }
                processQueue(null);
                return api(originalRequest);
            } catch (refreshError) {
                console.error(refreshError);
                processQueue(refreshError);
                // 세션 만료 — 기존 조용한 리다이렉트 대신 App.tsx 의 Dialog 가 확인 버튼을 띄우고
                // 사용자가 확인하면 sessionStorage clear + /login 이동. 일반 에러 Dialog 와 분리.
                window.dispatchEvent(new CustomEvent('show-session-expired'));
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        if (error.response?.status === 403) {
            const code = error.response?.data?.code;
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

        // 전역 에러 Dialog 처리 — skip 조건에 해당하면 페이지 catch 로만 전달
        const shouldSkip =
            originalRequest.skipGlobalError === true ||        // 폴링 등 명시적 skip
            isLoginRequest ||                                   // 로그인 API 는 Login.tsx 에서 직접 처리
            isReissueRequest ||                                 // refresh 는 401 분기에서 이미 처리
            isSecondaryPasswordRequest ||                       // 2차 비번 관련은 SecondaryAuthDialog 에서 자체 처리
            (error.response?.status === 400 &&
             error.response?.data?.code === 'VALIDATION_4001'); // 폼 Validation 은 페이지 setFormErrors

        if (!shouldSkip) {
            const message = error.response?.data?.message
                ?? (error.response
                    ? '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
                    : '네트워크 연결을 확인해주세요.');
            window.dispatchEvent(new CustomEvent('show-global-error', { detail: { message } }));
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
