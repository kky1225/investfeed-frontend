import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';

export default function ProtectedRoute() {
    const { isAuthenticated, isInitialized, passwordChangeRequired } = useAuth();
    const location = useLocation();

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
