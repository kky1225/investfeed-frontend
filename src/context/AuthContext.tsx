import { createContext, useContext, useState, ReactNode } from 'react';
import type { AuthUser } from '../type/AuthType';
import { queryClient } from '../lib/queryClient';

interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isInitialized: boolean;
    passwordChangeRequired: boolean;
    setAuth: (user: AuthUser, passwordChangeRequired?: boolean) => void;
    updateUser: (user: AuthUser) => void;
    clearAuth: () => void;
    clearPasswordChangeRequired: () => void;
    hasPermission: (code: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    // lazy useState initializer — sessionStorage 에서 첫 렌더 전 동기적으로 복원 (useEffect 불필요)
    const [user, setUser] = useState<AuthUser | null>(() => {
        const storedUser = sessionStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [passwordChangeRequired, setPasswordChangeRequired] = useState<boolean>(() => {
        return sessionStorage.getItem('passwordChangeRequired') === 'true';
    });
    // 초기화는 lazy initializer 로 끝났으므로 항상 true (호환성 위해 유지)
    const [isInitialized] = useState(true);

    const setAuth = (user: AuthUser, passwordChangeRequired = false) => {
        setUser(user);
        setPasswordChangeRequired(passwordChangeRequired);
        sessionStorage.setItem('user', JSON.stringify(user));
        sessionStorage.setItem('passwordChangeRequired', String(passwordChangeRequired));
    };

    const updateUser = (user: AuthUser) => {
        setUser(user);
        sessionStorage.setItem('user', JSON.stringify(user));
    };

    const clearAuth = () => {
        setUser(null);
        setPasswordChangeRequired(false);
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('passwordChangeRequired');
        queryClient.clear();
    };

    const clearPasswordChangeRequired = () => {
        setPasswordChangeRequired(false);
        sessionStorage.removeItem('passwordChangeRequired');
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
