import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SecurityKeypad from './SecurityKeypad';
import {changeSecondaryPassword, verifySecondaryPassword} from '../api/auth/AuthApi';
import {
    isSecondaryPasswordSuspended, SECONDARY_PASSWORD_SUSPENDED_MESSAGE, useSecondaryPasswordSuspended,
    wrongSecondaryPasswordMessage,
} from './secondaryPasswordAttempts';
import type {SecondaryPasswordChangeReq, SecondaryPasswordVerifyReq} from '../type/AuthType';
import {requireOk} from '../lib/apiResponse';

type Step = 'current' | 'new' | 'confirm';

const ERROR_MESSAGES: Record<string, string> = {
    AUTH_4041: '2차 비밀번호가 설정되지 않았습니다.',
    AUTH_4043: '현재 2차 비밀번호와 동일한 비밀번호로 변경할 수 없습니다.',
};

interface ChangeSecondaryPasswordDialogProps {
    open: boolean;
    onSuccess: () => void;
    onClose: () => void;
}

export default function ChangeSecondaryPasswordDialog({open, onSuccess, onClose}: ChangeSecondaryPasswordDialogProps) {
    const [step, setStep] = useState<Step>('current');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [key, setKey] = useState(0);
    // 여러 번 틀려 2차 비밀번호가 정지된 상태인지. 창을 열 때 서버에 묻고, 입력하다 정지되면 그때 바뀐다.
    const [suspended, markSuspended] = useSecondaryPasswordSuspended(open);

    const resetState = () => {
        setStep('current');
        setCurrentPassword('');
        setNewPassword('');
        setError('');
        setKey(prev => prev + 1);
    };

    /** 서버가 정지됐다고 답했으면 정지 안내로 바꾸고 true */
    const handleLockError = (err: unknown): boolean => {
        if (!isSecondaryPasswordSuspended(err)) return false;
        markSuspended();
        return true;
    };

    const verifyCurrentMutation = useMutation({
        mutationFn: async (req: SecondaryPasswordVerifyReq) => {
            requireOk(await verifySecondaryPassword(req), '2차 비밀번호 인증');
            return req.password;
        },
        onSuccess: (code) => {
            setCurrentPassword(code);
            setStep('new');
            setKey(prev => prev + 1);
        },
        onError: (err: unknown) => {
            console.error(err);
            if (!handleLockError(err)) {
                const axiosErr = err as { response?: { data?: { code?: string } } };
                const errCode = axiosErr.response?.data?.code ?? '';
                // 틀렸으면 서버가 남은 횟수까지 적어 준 문구를 그대로 보여 준다. 틀린 것이 아닌 실패(서버 오류 등)는 따로 안내한다.
                setError(wrongSecondaryPasswordMessage(err) ?? ERROR_MESSAGES[errCode]
                    ?? '2차 비밀번호를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
            }
            setKey(prev => prev + 1);
        },
    });

    const handleCurrentInput = (code: string) => {
        setError('');
        verifyCurrentMutation.mutate({password: code});
    };

    const handleNewInput = (code: string) => {
        setNewPassword(code);
        setStep('confirm');
        setError('');
        setKey(prev => prev + 1);
    };

    const changePasswordMutation = useMutation({
        mutationFn: async (req: SecondaryPasswordChangeReq) => {
            requireOk(await changeSecondaryPassword(req), '2차 비밀번호 변경');
        },
        onSuccess: () => {
            resetState();
            onSuccess();
        },
        onError: (err: unknown) => {
            console.error(err);
            const axiosErr = err as { response?: { data?: { code?: string } } };
            const errCode = axiosErr.response?.data?.code ?? '';
            // 변경 요청도 인증과 같은 횟수 제한을 받는다. 정지됐으면 정지 안내로 바꾼다.
            if (!handleLockError(err)) {
                setError(wrongSecondaryPasswordMessage(err) ?? ERROR_MESSAGES[errCode] ?? '2차 비밀번호 변경에 실패했습니다.');
            }
            setStep('current');
            setCurrentPassword('');
            setNewPassword('');
            setKey(prev => prev + 1);
        },
    });

    const loading = verifyCurrentMutation.isPending || changePasswordMutation.isPending;

    const handleConfirmInput = (code: string) => {
        if (code !== newPassword) {
            setError('새 비밀번호가 일치하지 않습니다. 다시 입력해주세요.');
            setStep('new');
            setNewPassword('');
            setKey(prev => prev + 1);
            return;
        }
        const req: SecondaryPasswordChangeReq = {currentPassword, newPassword};
        changePasswordMutation.mutate(req);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const getTitle = () => {
        if (step === 'current') return '현재 2차 비밀번호';
        if (step === 'new') return '새 2차 비밀번호';
        return '새 2차 비밀번호 확인';
    };

    const getDescription = () => {
        if (step === 'current') return '현재 2차 비밀번호를 입력해주세요.';
        if (step === 'new') return '새로운 2차 비밀번호를 입력해주세요.';
        return '확인을 위해 한 번 더 입력해주세요.';
    };

    const handleComplete = () => {
        if (step === 'current') return handleCurrentInput;
        if (step === 'new') return handleNewInput;
        return handleConfirmInput;
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
                {suspended && <Alert severity="error" sx={{mb: 2}}>{SECONDARY_PASSWORD_SUSPENDED_MESSAGE}</Alert>}
                {!suspended && error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}
                {/* 정지된 상태에서도 입력 칸은 막지 않고 안내만 한다(입력하면 서버가 거부한다). */}
                <SecurityKeypad
                    key={key}
                    onComplete={handleComplete()}
                    disabled={loading}
                />
            </DialogContent>
        </Dialog>
    );
}
