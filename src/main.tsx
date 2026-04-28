import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {BrowserRouter} from "react-router-dom";
import { AuthProvider } from './context/AuthContext.tsx';
import { ApiKeyStatusProvider } from './context/ApiKeyStatusContext.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { BlindModeProvider } from './context/BlindModeContext.tsx';

createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <AuthProvider>
            <ApiKeyStatusProvider>
                <NotificationProvider>
                    <BlindModeProvider>
                        <App />
                    </BlindModeProvider>
                </NotificationProvider>
            </ApiKeyStatusProvider>
        </AuthProvider>
    </BrowserRouter>
)
