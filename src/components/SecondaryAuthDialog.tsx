import {useState, useEffect, useRef, useCallback} from 'react';
import {useMutation} from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SecurityKeypad from './SecurityKeypad';
import {setupSecondaryPassword, verifySecondaryPassword, fetchSecondaryPasswordLockStatus} from '../api/auth/AuthApi';
import {requireOk} from '../lib/apiResponse';
import {useAuth} from '../context/AuthContext';

interface SecondaryAuthDialogProps {
    open: boolean;
    mode: 'setup' | 'verify';
    onSuccess: () => void;
    onClose: () => void;
}

export default function SecondaryAuthDialog({open, mode, onSuccess, onClose}: SecondaryAuthDialogProps) {
    const [step, setStep] = useState<'input' | 'confirm'>('input');
    const [firstInput, setFirstInput] = useState('');
    const [error, setError] = useState('');
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [key, setKey] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const {user, updateUser} = useAuth();

    const locked = remainingSeconds > 0;

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const startCountdown = useCallback((seconds: number) => {
        clearTimer();
        setRemainingSeconds(seconds);
        timerRef.current = setInterval(() => {
            setRemainingSeconds(prev => {
                if (prev <= 1) {
                    clearTimer();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [clearTimer]);

    useEffect(() => {
        if (open && mode === 'verify') {
            (async () => {
                try {
                    const res = await fetchSecondaryPasswordLockStatus();
                    const seconds = res.result?.remainingSeconds ?? 0;
                    if (seconds > 0) startCountdown(seconds);
                } catch (error) { console.error(error); /* ignore — 잠금 상태 조회 실패해도 다이얼로그는 정상 표시 */ }
            })();
        }
    }, [open, mode, startCountdown]);

    useEffect(() => () => clearTimer(), [clearTimer]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    const resetState = () => {
        setStep('input');
        setFirstInput('');
        setError('');
        setRemainingSeconds(0);
        clearTimer();
        setKey(prev => prev + 1);
    };

    const handleLockError = (err: unknown) => {
        const axiosErr = err as { response?: { data?: { code?: string; message?: string; result?: { remainingSeconds?: number } } } };
        const errCode = axiosErr.response?.data?.code;
        if (errCode === 'AUTH_4044') {
            const seconds = axiosErr.response?.data?.result?.remainingSeconds ?? 0;
            if (seconds > 0) {
                startCountdown(seconds);
            }
            return true;
        }
        return false;
    };

    const handleSetupInput = (code: string) => {
        setFirstInput(code);
        setStep('confirm');
        setError('');
        setKey(prev => prev + 1);
    };

    const setupMutation = useMutation({
        mutationFn: async (code: string) => {
            requireOk(await setupSecondaryPassword({password: code}), '2차 비밀번호 설정');
            if (user) updateUser({...user, secondaryPasswordEnabled: true});
            requireOk(await verifySecondaryPassword({password: code}), '2차 비밀번호 인증');
        },
        onSuccess: () => {
            resetState();
            onSuccess();
        },
        onError: (err: unknown) => {
            console.error(err);
            if (!handleLockError(err)) {
                setError('2차 비밀번호 설정에 실패했습니다.');
            }
            setStep('input');
            setFirstInput('');
            setKey(prev => prev + 1);
        },
    });

    const verifyMutation = useMutation({
        mutationFn: async (code: string) => {
            requireOk(await verifySecondaryPassword({password: code}), '2차 비밀번호 인증');
        },
        onSuccess: () => {
            resetState();
            onSuccess();
        },
        onError: (err: unknown) => {
            console.error(err);
            if (!handleLockError(err)) {
                setError('2차 비밀번호가 올바르지 않습니다.');
            }
            setKey(prev => prev + 1);
        },
    });

    const loading = setupMutation.isPending || verifyMutation.isPending;

    const handleSetupConfirm = (code: string) => {
        if (code !== firstInput) {
            setError('비밀번호가 일치하지 않습니다. 다시 입력해주세요.');
            setStep('input');
            setFirstInput('');
            setKey(prev => prev + 1);
            return;
        }
        setupMutation.mutate(code);
    };

    const handleVerify = (code: string) => {
        setError('');
        verifyMutation.mutate(code);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const getTitle = () => {
        if (mode === 'setup') return step === 'confirm' ? '2차 비밀번호 확인' : '2차 비밀번호 설정';
        return '2차 비밀번호 인증';
    };

    const getDescription = () => {
        if (mode === 'setup') {
            return step === 'confirm'
                ? '확인을 위해 한 번 더 입력해주세요.'
                : '관리 기능에 접근하려면 2차 비밀번호를 설정해야 합니다.';
        }
        return '관리 기능에 접근하려면 2차 비밀번호를 입력하세요.';
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 3}}>
                <Box sx={{
                    width: 48, height: 48, borderRadius: '50%',
                    bgcolor: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1
                }}>
                    <LockOutlinedIcon sx={{color: 'primary.contrastText'}}/>
                </Box>
            </Box>
            <DialogTitle sx={{textAlign: 'center', pb: 0.5}}>{getTitle()}</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{textAlign: 'center', mb: 2}}>{getDescription()}</DialogContentText>
                {locked && (
                    <Alert severity="warning" sx={{mb: 2}}>
                        2차 비밀번호 입력이 잠금되었습니다. {formatTime(remainingSeconds)} 후에 다시 시도하세요.
                    </Alert>
                )}
                {!locked && error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}
                <SecurityKeypad
                    key={key}
                    onComplete={mode === 'setup' ? (step === 'confirm' ? handleSetupConfirm : handleSetupInput) : handleVerify}
                    disabled={loading || locked}
                />
            </DialogContent>
        </Dialog>
    );
}
