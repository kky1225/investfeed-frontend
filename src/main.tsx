import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {BrowserRouter} from "react-router-dom";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient.ts';
import { AuthProvider } from './context/AuthContext.tsx';
import { ApiKeyStatusProvider } from './context/ApiKeyStatusContext.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { BlindModeProvider } from './context/BlindModeContext.tsx';
import { MenuProvider } from './context/MenuContext.tsx';
import { AlertProvider } from './context/AlertContext.tsx';
import AlertDialog from './components/AlertDialog.tsx';

createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <ApiKeyStatusProvider>
                    <NotificationProvider>
                        <BlindModeProvider>
                            <MenuProvider>
                                <AlertProvider>
                                    <App />
                                    <AlertDialog />
                                </AlertProvider>
                            </MenuProvider>
                        </BlindModeProvider>
                    </NotificationProvider>
                </ApiKeyStatusProvider>
            </AuthProvider>
        </QueryClientProvider>
    </BrowserRouter>
)
