import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AuthUser } from '../type/AuthType';

interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isInitialized: boolean;
    passwordChangeRequired: boolean;
    setAuth: (user: AuthUser, passwordChangeRequired?: boolean) => void;
    updateUser: (user: AuthUser) => void;
    clearAuth: () => void;
    clearPasswordChangeRequired: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);

    useEffect(() => {
        const storedUser = sessionStorage.getItem('user');
        const storedPwChange = sessionStorage.getItem('passwordChangeRequired');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
            setPasswordChangeRequired(storedPwChange === 'true');
        }
        setIsInitialized(true);
    }, []);

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
    };

    const clearPasswordChangeRequired = () => {
        setPasswordChangeRequired(false);
        sessionStorage.removeItem('passwordChangeRequired');
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
