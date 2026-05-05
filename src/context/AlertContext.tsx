import {createContext, useCallback, useContext, useState, ReactNode} from 'react';

export type AlertSeverity = 'success' | 'error' | 'info' | 'warning';

interface AlertState {
    open: boolean;
    message: string;
    severity: AlertSeverity;
}

interface AlertContextValue {
    alert: AlertState;
    showAlert: (message: string, severity?: AlertSeverity) => void;
    hideAlert: () => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

const INITIAL_STATE: AlertState = {open: false, message: '', severity: 'success'};

export function AlertProvider({children}: {children: ReactNode}) {
    const [alert, setAlert] = useState<AlertState>(INITIAL_STATE);

    const showAlert = useCallback((message: string, severity: AlertSeverity = 'success') => {
        setAlert({open: true, message, severity});
    }, []);

    const hideAlert = useCallback(() => {
        setAlert(prev => ({...prev, open: false}));
    }, []);

    return (
        <AlertContext.Provider value={{alert, showAlert, hideAlert}}>
            {children}
        </AlertContext.Provider>
    );
}

/**
 * 전역 alert dialog 표시 hook.
 *
 * 사용:
 * ```
 * const showAlert = useAlert();
 * showAlert('일정이 등록되었습니다.', 'success');
 * showAlert('처리에 실패했습니다.', 'error');
 * ```
 */
export function useAlert() {
    const ctx = useContext(AlertContext);
    if (!ctx) throw new Error('useAlert must be used within AlertProvider');
    return ctx.showAlert;
}

/** AlertDialog 컴포넌트 내부에서 alert state 와 hideAlert 를 직접 가져올 때 사용. */
export function useAlertContext() {
    const ctx = useContext(AlertContext);
    if (!ctx) throw new Error('useAlertContext must be used within AlertProvider');
    return ctx;
}
