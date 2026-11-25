import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { AuthUser, MemberRes, TokenRes } from '../type/AuthType';
import { queryClient } from '../lib/queryClient';
import { resetSecondaryAuth } from '../lib/secondaryAuth';
import { fetchProfile } from '../api/auth/AuthApi';

interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isInitialized: boolean;
    passwordChangeRequired: boolean;
    /** 권한별 첫 화면. 로그인한 채 로그인 화면에 들어오면 이곳으로 보낸다 */
    defaultPath: string;
    setAuth: (user: AuthUser, passwordChangeRequired?: boolean, defaultPath?: string) => void;
    updateUser: (user: AuthUser) => void;
    clearAuth: () => void;
    clearPasswordChangeRequired: () => void;
    hasPermission: (code: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// 로그인 응답과 같은 모양으로 가린다 (서버 AuthService.maskEmail 과 같은 규칙). 프로필 응답은 가리지 않은 값이다
const maskEmail = (email: string): string => {
    const parts = email.split('@');
    if (parts.length !== 2) return '***';
    const [local, domain] = parts;
    const visible = local.length <= 2 ? 1 : 2;
    return local.slice(0, visible) + '*'.repeat(Math.max(0, local.length - visible)) + '@' + domain;
};

// 시작 확인이 서버·네트워크 오류로 실패했을 때 다시 묻는 간격
const SESSION_CHECK_RETRY_MS = 5_000;

/** 서버가 답을 했고 그 답이 거절(4xx)인 경우. 응답이 없거나 5xx 면 로그인 여부를 아직 모르는 것이다 */
const isAuthRejected = (error: unknown): boolean => {
    const status = (error as { response?: { status?: number } })?.response?.status;
    return status !== undefined && status >= 400 && status < 500;
};

const toAuthUser = (profile: MemberRes): AuthUser => ({
    loginId: profile.loginId,
    nickname: profile.nickname,
    email: maskEmail(profile.email),
    role: profile.role,
    secondaryPasswordEnabled: profile.secondaryPasswordEnabled,
    permissions: profile.permissions ?? [],
});

/**
 * 로그인 상태는 서버가 기준이다. 화면을 열 때마다(새 탭·새로고침) 프로필을 물어 로그인 여부와 사용자 정보를 받고,
 * 브라우저 저장소에는 두지 않고 메모리에만 둔다. 묻는 동안은 isInitialized=false 로 화면이 기다린다
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
    const [defaultPath, setDefaultPath] = useState('/');
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;

        const check = (attempt: number) => {
            // 오류 창은 처음 한 번만 띄운다 (다시 묻는 동안 반복해서 뜨지 않게)
            fetchProfile({ sessionCheck: true, skipGlobalError: attempt > 0 })
                .then((res) => {
                    if (cancelled) return;
                    const profile = res.result;
                    if (profile) {
                        setUser(toAuthUser(profile));
                        setPasswordChangeRequired(profile.passwordChangeRequired ?? false);
                        setDefaultPath(profile.defaultPath ?? '/');
                    }
                    setIsInitialized(true);
                })
                .catch((error) => {
                    if (cancelled) return;
                    // 서버가 인증을 거절했다(로그인하지 않았거나 세션이 끝남) → user 없음 (로그인 화면으로 간다)
                    if (isAuthRejected(error)) {
                        setIsInitialized(true);
                        return;
                    }
                    // 서버·네트워크 오류는 로그인 여부를 아직 모르는 것 → 로딩을 유지한 채 다시 묻는다
                    retryTimer = setTimeout(() => check(attempt + 1), SESSION_CHECK_RETRY_MS);
                });
        };

        check(0);
        return () => {
            cancelled = true;
            clearTimeout(retryTimer);
        };
    }, []);

    // 연장 응답으로 권한·닉네임 등을 최신 값으로 맞춘다 (axios.ts refreshSession)
    useEffect(() => {
        const handleRefreshed = (e: Event) => {
            const token = (e as CustomEvent<TokenRes>).detail;
            setUser((prev) => prev && {
                ...prev,
                role: token.role ?? prev.role,
                nickname: token.nickname ?? prev.nickname,
                email: token.email ?? prev.email,
                permissions: token.permissions ?? prev.permissions,
            });
        };
        window.addEventListener('session-refreshed', handleRefreshed);
        return () => window.removeEventListener('session-refreshed', handleRefreshed);
    }, []);

    const setAuth = (user: AuthUser, passwordChangeRequired = false, defaultPath?: string) => {
        setUser(user);
        setPasswordChangeRequired(passwordChangeRequired);
        setDefaultPath(defaultPath ?? '/');
    };

    const updateUser = (user: AuthUser) => {
        setUser(user);
    };

    const clearAuth = () => {
        setUser(null);
        setPasswordChangeRequired(false);
        setDefaultPath('/');
        queryClient.clear();
        resetSecondaryAuth();
    };

    const clearPasswordChangeRequired = () => {
        setPasswordChangeRequired(false);
    };

    const hasPermission = (code: string, action: string): boolean => {
        if (!user?.permissions) return false;
        return user.permissions.some(p => p.code === code && p.actions.includes(action));
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isInitialized,
            passwordChangeRequired,
            defaultPath,
            setAuth,
            updateUser,
            clearAuth,
            clearPasswordChangeRequired,
            hasPermission,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
