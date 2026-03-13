import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AuthUser } from '../type/AuthType';

interface AuthContextType {
    user: AuthUser | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    isInitialized: boolean;
    setAuth: (user: AuthUser, token: string) => void;
    clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const storedToken = sessionStorage.getItem('accessToken');
        const storedUser = sessionStorage.getItem('user');
        if (storedToken && storedUser) {
            setAccessToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
        setIsInitialized(true);
    }, []);

    const setAuth = (user: AuthUser, token: string) => {
        setUser(user);
        setAccessToken(token);
        sessionStorage.setItem('accessToken', token);
        sessionStorage.setItem('user', JSON.stringify(user));
    };

    const clearAuth = () => {
        setUser(null);
        setAccessToken(null);
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{
            user,
            accessToken,
            isAuthenticated: !!accessToken,
            isInitialized,
            setAuth,
            clearAuth,
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
