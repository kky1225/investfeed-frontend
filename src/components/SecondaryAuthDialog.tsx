import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SecurityKeypad from './SecurityKeypad';
import {setupSecondaryPassword, verifySecondaryPassword} from '../api/auth/AuthApi';
import {
    isSecondaryPasswordSuspended, SECONDARY_PASSWORD_SUSPENDED_MESSAGE, useSecondaryPasswordSuspended,
    wrongSecondaryPasswordMessage,
} from './secondaryPasswordAttempts';
import {requireOk} from '../lib/apiResponse';
import {useAuth} from '../context/AuthContext';

const ALREADY_SET_CODE = 'AUTH_4045';   // 2차 비밀번호가 이미 설정되어 있어 첫 설정을 거부했다는 서버 코드

const errorCodeOf = (err: unknown): string | undefined =>
    (err as { response?: { data?: { code?: string } } }).response?.data?.code;

/** 이미 설정된 2차 비밀번호가 있어 인증만 시도했는데 그 인증이 실패했다. cause 는 인증 요청의 실패 */
class AlreadySetError extends Error {
    constructor(readonly cause: unknown) {
        super('secondary password already set');
    }
}

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
    const [key, setKey] = useState(0);
    const {user, updateUser} = useAuth();
    // 여러 번 틀려 2차 비밀번호가 정지된 상태인지. 창을 열 때 서버에 묻고, 입력하다 정지되면 그때 바뀐다.
    const [suspended, markSuspended] = useSecondaryPasswordSuspended(open, mode === 'verify');

    const resetState = () => {
        setStep('input');
        setFirstInput('');
        setError('');
        setKey(prev => prev + 1);
    };

    /** 서버가 정지됐다고 답했으면 정지 안내로 바꾸고 true */
    const handleSuspended = (err: unknown) => {
        if (!isSecondaryPasswordSuspended(err)) return false;
        markSuspended();
        return true;
    };

    const handleSetupInput = (code: string) => {
        setFirstInput(code);
        setStep('confirm');
        setError('');
        setKey(prev => prev + 1);
    };

    const setupMutation = useMutation({
        mutationFn: async (code: string) => {
            // 서버는 이미 2차 비밀번호가 있으면 설정을 거부한다(AUTH_4045). 앞선 시도에서 설정은 됐는데 뒤이은 인증만
            // 실패했거나 다른 기기에서 먼저 만든 경우다. 그때는 설정을 건너뛰고 입력한 값으로 인증만 한다.
            let alreadySet = false;
            try {
                requireOk(await setupSecondaryPassword({password: code}), '2차 비밀번호 설정');
            } catch (err) {
                if (errorCodeOf(err) !== ALREADY_SET_CODE) throw err;
                alreadySet = true;
            }
            if (user) updateUser({...user, secondaryPasswordEnabled: true});
            try {
                requireOk(await verifySecondaryPassword({password: code}), '2차 비밀번호 인증');
            } catch (err) {
                throw alreadySet ? new AlreadySetError(err) : err;
            }
        },
        onSuccess: () => {
            resetState();
            onSuccess();
        },
        onError: (err: unknown) => {
            console.error(err);
            const alreadySet = err instanceof AlreadySetError;
            if (!handleSuspended(alreadySet ? err.cause : err)) {
                setError(alreadySet
                    ? '2차 비밀번호가 이미 설정되어 있습니다. 설정해 둔 2차 비밀번호를 입력해주세요.'
                    : '2차 비밀번호 설정에 실패했습니다.');
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
            if (!handleSuspended(err)) {
                // 틀렸으면 서버가 남은 횟수까지 적어 준 문구를 그대로 보여 준다. 틀린 것이 아닌 실패(서버 오류 등)는 따로 안내한다.
                setError(wrongSecondaryPasswordMessage(err) ?? '2차 비밀번호를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
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
        // 확인 중에 닫으면 취소로 처리된 뒤 확인 결과로 성공이 한 번 더 불린다. 끝날 때까지 닫지 않는다.
        if (loading) return;
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
            <IconButton size="small" onClick={handleClose} title="닫기" sx={{position: 'absolute', top: 8, right: 8}}>
                <CloseIcon fontSize="small"/>
            </IconButton>
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
                    onComplete={mode === 'setup' ? (step === 'confirm' ? handleSetupConfirm : handleSetupInput) : handleVerify}
                    disabled={loading}
                />
            </DialogContent>
        </Dialog>
    );
}
