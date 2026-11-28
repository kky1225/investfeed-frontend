import axios from 'axios';
import {fetchReissue} from "./api/auth/AuthApi.ts";

const api = axios.create({
    baseURL: '/api',
    timeout: 20000,
    withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

let isSessionExpired = false;

let isSecondaryAuthPending = false;
let secondaryAuthQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

/**
 * 2차 비밀번호 창을 띄우고(App.tsx 가 띄운다) 결과를 기다린다. 통과하면 resolve, 창을 닫으면 SecondaryAuthCancelledError 로 reject.
 * 창은 하나만 뜨고, 그사이 들어온 요청·화면도 같은 결과를 받는다.
 * 창을 닫은 뒤 화면을 옮길지는 여기서 정하지 않는다. 보호된 화면은 SecondaryAuthRoute 가 이전 화면으로 돌려보내고, 버튼·비서는 그 자리에 머문다.
 * code: 서버가 준 코드. AUTH_4041(2차 비밀번호 없음)이면 설정 창, 나머지는 인증 창
 */
export const promptSecondaryAuth = (code: string): Promise<void> =>
    new Promise<void>((resolve, reject) => {
        secondaryAuthQueue.push({ resolve: () => resolve(), reject });
        if (isSecondaryAuthPending) return;
        isSecondaryAuthPending = true;
        window.dispatchEvent(new CustomEvent('show-secondary-auth', { detail: { code } }));
    });

/**
 * 떠 있는 2차 비밀번호 창을 닫는다. 창(SecondaryAuthDialog)이 사용자가 닫은 것과 같은 길로 닫으므로 기다리던 쪽은 모두
 * SecondaryAuthCancelledError 를 받는다. 확인 중이면 창이 결과를 기다린 뒤 실패일 때만 닫는다.
 * 창을 띄운 보호된 화면을 벗어났을 때(SecondaryAuthRoute) 쓴다. 창이 떠 있지 않으면 아무것도 하지 않는다.
 */
export const dismissSecondaryAuth = () => {
    if (!isSecondaryAuthPending) return;
    window.dispatchEvent(new CustomEvent('hide-secondary-auth'));
};

/** 2차 비밀번호 창을 닫아 요청을 그만둔 경우. 호출부는 실패 안내를 띄우지 않는다 */
export class SecondaryAuthCancelledError extends Error {
    constructor() {
        super('2차 인증을 취소했습니다.');
        this.name = 'SecondaryAuthCancelledError';
    }
}
// 반환 형식을 boolean 으로 적어 둔다. 추론에 맡기면 타입 가드가 되어, 모양이 같은 Error 가 false 쪽에서 never 로 좁혀진다
export const isSecondaryAuthCancelled = (error: unknown): boolean => error instanceof SecondaryAuthCancelledError;

api.interceptors.response.use(
    (response) => {
        if (response.config.url?.startsWith('/auth/login') && response.status === 200) {
            isSessionExpired = false;
            window.dispatchEvent(new CustomEvent('reset-session-expired'));
        }
        if (response.config.url?.startsWith('/auth/logout')) {
            isSessionExpired = true;
        }
        // 2차 비밀번호 요청(인증·설정·변경·종료)이 성공하면 서버의 2차 인증 상태가 바뀐다.
        // 어느 창에서 보냈든 화면이 아는 상태(상단 자물쇠)를 서버에 다시 물어 맞추게 한다 (lib/secondaryAuth.ts)
        if (response.config.url?.startsWith('/auth/secondary-password/') && response.config.method !== 'get') {
            window.dispatchEvent(new Event('secondary-auth-changed'));
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        const isLoginRequest = originalRequest.url?.startsWith('/auth/login');
        const isReissueRequest = originalRequest.url?.startsWith('/auth/reissue');
        const isTotpRequest = originalRequest.url?.startsWith('/auth/totp/');
        const isSecondaryPasswordRequest = originalRequest.url?.startsWith('/auth/secondary-password/');

        if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest && !isReissueRequest && !isTotpRequest) {
            if (isSessionExpired) {
                return Promise.reject(error);
            }
            originalRequest._retry = true;
            await refreshSession(originalRequest.sessionCheck === true);
            return api(originalRequest);
        }

        if (error.response?.status === 403) {
            const code = error.response?.data?.code;
            if (isSecondaryPasswordRequest) {
                return Promise.reject(error);
            }
            if (code === 'AUTH_4040' || code === 'AUTH_4041' || code === 'AUTH_4044') {
                // 서버가 2차 인증이 없다고 답했다. 화면이 알고 있던 인증 상태(상단 자물쇠)를 잠김으로 맞춘다 (lib/secondaryAuth.ts)
                window.dispatchEvent(new Event('secondary-auth-locked'));
                // 자동 재조회(비서 타임라인 등)는 다이얼로그 없이 호출부가 공개 데이터로 되돌리게 한다
                if (originalRequest.secondaryAuthSilent === true) {
                    return Promise.reject(error);
                }
                return promptSecondaryAuth(code).then(() => api(originalRequest));
            }
            const message = error.response?.data?.message || '접근 권한이 없습니다.';
            window.dispatchEvent(new CustomEvent('show-forbidden', { detail: { message } }));
            return new Promise(() => {});
        }

        // 전역 에러 Dialog 처리 — skip 조건에 해당하면 페이지 catch 로만 전달
        const shouldSkip =
            originalRequest.skipGlobalError === true ||        // 폴링 등 명시적 skip
            originalRequest.url?.endsWith('/stream') ||         // 실시간 등록은 reconnectingSocket 이 재시도
            isLoginRequest ||                                   // 로그인 API 는 Login.tsx 에서 직접 처리
            isTotpRequest ||                                    // TOTP 도 Login.tsx 에서 코드별로 직접 처리
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

/**
 * 토큰을 연장한다. 이미 연장 중이면 그 결과를 같이 기다린다.
 * 실패하면 세션 만료 Dialog 를 띄우고 오류를 던진다.
 * sessionCheck = 화면 시작 때 로그인 여부를 묻는 중. 이때는 다른 곳 로그인(AUTH_4018)만 안내하고 나머지는 조용히 실패하며,
 * 서버·네트워크 오류는 만료로 확정하지 않는다
 */
const refreshSession = async (sessionCheck = false): Promise<void> => {
    if (isSessionExpired) {
        throw new Error('session expired');
    }
    if (isRefreshing) {
        await new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
        });
        return;
    }

    isRefreshing = true;
    try {
        const res = await fetchReissue();
        if (res.result) {
            // AuthContext 가 권한·닉네임 등을 최신 값으로 맞춘다
            window.dispatchEvent(new CustomEvent('session-refreshed', { detail: res.result }));
        }
        processQueue(null);
    } catch (refreshError) {
        console.error(refreshError);
        const { status, data } = (refreshError as { response?: { status?: number; data?: { code?: string } } })?.response ?? {};
        // 화면 시작 확인 중 서버·네트워크 오류(응답 없음·5xx)는 로그인 여부를 아직 모르는 것이다.
        // 만료로 확정하지 않고 넘긴다 (AuthContext 가 잠시 뒤 다시 묻는다)
        if (sessionCheck && !(status !== undefined && status >= 400 && status < 500)) {
            processQueue(refreshError);
            throw refreshError;
        }
        // 세션 만료 latch — 후속 401 들이 reissue 재시도하지 않도록 먼저 set.
        isSessionExpired = true;
        processQueue(refreshError);
        // 세션 만료 — App.tsx 의 Dialog 가 확인 버튼을 띄우고, 확인하면 /login 으로 이동. 일반 에러 Dialog 와 분리.
        // AUTH_4018 = 다른 곳에서 로그인해 이 쪽 세션이 밀려남 (Dialog 문구 구분용)
        const code = data?.code;
        if (!sessionCheck || code === 'AUTH_4018') {
            window.dispatchEvent(new CustomEvent('show-session-expired', { detail: { code } }));
        }
        throw refreshError;
    } finally {
        isRefreshing = false;
    }
};

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
