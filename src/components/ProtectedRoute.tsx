import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';

export default function ProtectedRoute() {
    const { isAuthenticated, isInitialized } = useAuth();

    if (!isInitialized) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress />
            </Box>
        );
    }

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
