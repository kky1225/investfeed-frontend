import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AuthUser } from '../type/AuthType';

interface AuthContextType {
    user: AuthUser | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    isInitialized: boolean;
    passwordChangeRequired: boolean;
    setAuth: (user: AuthUser, token: string, passwordChangeRequired?: boolean) => void;
    clearAuth: () => void;
    clearPasswordChangeRequired: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);

    useEffect(() => {
        const storedToken = sessionStorage.getItem('accessToken');
        const storedUser = sessionStorage.getItem('user');
        const storedPwChange = sessionStorage.getItem('passwordChangeRequired');
        if (storedToken && storedUser) {
            setAccessToken(storedToken);
            setUser(JSON.parse(storedUser));
            setPasswordChangeRequired(storedPwChange === 'true');
        }
        setIsInitialized(true);
    }, []);

    const setAuth = (user: AuthUser, token: string, passwordChangeRequired = false) => {
        setUser(user);
        setAccessToken(token);
        setPasswordChangeRequired(passwordChangeRequired);
        sessionStorage.setItem('accessToken', token);
        sessionStorage.setItem('user', JSON.stringify(user));
        sessionStorage.setItem('passwordChangeRequired', String(passwordChangeRequired));
    };

    const clearAuth = () => {
        setUser(null);
        setAccessToken(null);
        setPasswordChangeRequired(false);
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('passwordChangeRequired');
    };

    const clearPasswordChangeRequired = () => {
        setPasswordChangeRequired(false);
        sessionStorage.removeItem('passwordChangeRequired');
    };

    return (
        <AuthContext.Provider value={{
            user,
            accessToken,
            isAuthenticated: !!accessToken,
            isInitialized,
            passwordChangeRequired,
            setAuth,
            clearAuth,
            clearPasswordChangeRequired,
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
