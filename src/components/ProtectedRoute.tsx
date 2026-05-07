import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';
import { syncServerTime } from '../lib/serverTime';

export default function ProtectedRoute() {
    const { isAuthenticated, isInitialized, passwordChangeRequired } = useAuth();
    const location = useLocation();

    // 인증된 사용자 진입 시 서버 시간 1회 사전 동기화 (폴링 첫 정각 정확도 확보)
    useEffect(() => {
        if (isAuthenticated) {
            void syncServerTime();
        }
    }, [isAuthenticated]);

    if (!isInitialized) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress />
            </Box>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (passwordChangeRequired && location.pathname !== '/settings/change-password') {
        return <Navigate to="/settings/change-password" replace />;
    }

    return <Outlet />;
}
