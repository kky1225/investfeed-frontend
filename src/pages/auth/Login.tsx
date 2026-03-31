import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MuiCard from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import { styled } from '@mui/material/styles';

import ColorModeSelect from "../../components/ColorModeSelect.tsx";
import AppTheme from "../../components/AppTheme.tsx";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import { login, totpSetup, totpVerify } from "../../api/auth/AuthApi.ts";

type LoginStep = 'credentials' | 'totp-setup' | 'totp-verify';

const Card = styled(MuiCard)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignSelf: 'center',
    width: '100%',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
    margin: 'auto',
    [theme.breakpoints.up('sm')]: {
        maxWidth: '450px',
    },
    boxShadow:
        'hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px',
    ...theme.applyStyles('dark', {
        boxShadow:
            'hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px',
    }),
}));

const SignInContainer = styled(Stack)(({ theme }) => ({
    height: 'calc((1 - var(--template-frame-height, 0)) * 100dvh)',
    minHeight: '100%',
    padding: theme.spacing(2),
    [theme.breakpoints.up('sm')]: {
        padding: theme.spacing(4),
    },
    '&::before': {
        content: '""',
        display: 'block',
        position: 'absolute',
        zIndex: -1,
        inset: 0,
        backgroundImage:
            'radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))',
        backgroundRepeat: 'no-repeat',
        ...theme.applyStyles('dark', {
            backgroundImage:
                'radial-gradient(at 50% 50%, hsla(210, 100%, 16%, 0.5), hsl(220, 30%, 5%))',
        }),
    },
}));

export default function Login(props: { disableCustomTheme?: boolean }) {
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [loginIdError, setLoginIdError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [lockRemainingSeconds, setLockRemainingSeconds] = useState(0);
    const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [step, setStep] = useState<LoginStep>('credentials');
    const [totpCode, setTotpCode] = useState('');
    const [totpCodeError, setTotpCodeError] = useState('');
    const [qrCodeImage, setQrCodeImage] = useState('');
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const { setAuth } = useAuth();
    const navigate = useNavigate();

    const clearLockTimer = useCallback(() => {
        if (lockTimerRef.current) {
            clearInterval(lockTimerRef.current);
            lockTimerRef.current = null;
        }
    }, []);

    const startLockTimer = useCallback((seconds: number) => {
        clearLockTimer();
        setLockRemainingSeconds(seconds);
        lockTimerRef.current = setInterval(() => {
            setLockRemainingSeconds(prev => {
                if (prev <= 1) {
                    clearLockTimer();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [clearLockTimer]);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const startTimer = useCallback(() => {
        clearTimer();
        setRemainingSeconds(300);
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
        if (remainingSeconds === 0 && step !== 'credentials') {
            setStep('credentials');
            setTotpCode('');
            setQrCodeImage('');
            setErrorMessage('인증 시간이 만료되었습니다. 다시 로그인해주세요.');
        }
    }, [remainingSeconds, step]);

    useEffect(() => () => { clearTimer(); clearLockTimer(); }, [clearTimer, clearLockTimer]);

    const validate = () => {
        let valid = true;
        if (!loginId.trim()) {
            setLoginIdError('아이디를 입력해주세요.');
            valid = false;
        } else {
            setLoginIdError('');
        }
        if (!password || password.length < 4) {
            setPasswordError('비밀번호를 4자 이상 입력해주세요.');
            valid = false;
        } else {
            setPasswordError('');
        }
        return valid;
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        setErrorMessage('');
        try {
            const res = await login({ loginId, password });
            if (res.result) {
                startTimer();
                if (res.result.totpSetupRequired) {
                    const setupRes = await totpSetup();
                    if (setupRes.result) {
                        setQrCodeImage(setupRes.result.qrCodeImage);
                    }
                    setStep('totp-setup');
                } else {
                    setStep('totp-verify');
                }
            }
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { code?: string; message?: string; result?: { lockRemainingSeconds?: number } } } };
            const code = axiosErr.response?.data?.code;
            const lockSeconds = axiosErr.response?.data?.result?.lockRemainingSeconds;
            switch (code) {
                case 'AUTH_4011':
                    setErrorMessage('아이디 또는 비밀번호가 올바르지 않습니다.');
                    break;
                case 'AUTH_4012':
                case 'AUTH_4013':
                    if (lockSeconds && lockSeconds > 0) {
                        startLockTimer(lockSeconds);
                    } else {
                        setErrorMessage(axiosErr.response?.data?.message ?? '계정이 잠금된 상태입니다.');
                    }
                    break;
                case 'AUTH_4014':
                    setErrorMessage('계정이 영구 잠금되었습니다. 관리자에게 문의하세요.');
                    break;
                default:
                    setErrorMessage('로그인에 실패했습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleTotpVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!totpCode || totpCode.length !== 6) {
            setTotpCodeError('6자리 인증 코드를 입력해주세요.');
            return;
        }
        setTotpCodeError('');
        setLoading(true);
        setErrorMessage('');
        try {
            const res = await totpVerify({ code: totpCode });
            if (res.result) {
                clearTimer();
                setAuth(
                    { loginId, nickname: res.result.nickname, email: res.result.email, role: res.result.role, secondaryPasswordEnabled: res.result.secondaryPasswordEnabled },
                    res.result.passwordChangeRequired,
                );
                if (res.result.passwordChangeRequired) {
                    navigate('/settings/change-password');
                } else {
                    navigate('/');
                }
            }
        } catch (err: unknown) {
            const axiosErr = err as { response?: { status?: number } };
            if (axiosErr.response?.status === 401) {
                clearTimer();
                setStep('credentials');
                setTotpCode('');
                setQrCodeImage('');
                setErrorMessage('인증 시간이 만료되었습니다. 다시 로그인해주세요.');
            } else {
                setErrorMessage('TOTP 인증 코드가 올바르지 않습니다.');
                setTotpCode('');
            }
        } finally {
            setLoading(false);
        }
    };

    const locked = lockRemainingSeconds > 0;

    const renderCredentialsStep = () => (
        <Box
            component="form"
            onSubmit={handleLoginSubmit}
            noValidate
            sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 2 }}
        >
            {locked && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    로그인 실패 횟수 초과로 계정이 잠금되었습니다. {formatTime(lockRemainingSeconds)} 후에 다시 시도하세요.
                </Alert>
            )}
            <FormControl>
                <FormLabel htmlFor="loginId">아이디</FormLabel>
                <TextField
                    error={!!loginIdError}
                    helperText={loginIdError}
                    type="text"
                    id="loginId"
                    name="loginId"
                    placeholder="아이디"
                    autoComplete="username"
                    autoFocus
                    required
                    fullWidth
                    variant="outlined"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                />
            </FormControl>
            <FormControl>
                <FormLabel htmlFor="password">비밀번호</FormLabel>
                <TextField
                    error={!!passwordError}
                    helperText={passwordError}
                    type="password"
                    id="password"
                    name="password"
                    placeholder="비밀번호"
                    autoComplete="current-password"
                    required
                    fullWidth
                    variant="outlined"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </FormControl>
            <Button type="submit" fullWidth variant="contained" disabled={loading}>
                {loading ? '로그인 중...' : 'Sign in'}
            </Button>
        </Box>
    );

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    const renderTotpSetupStep = () => (
        <Box
            component="form"
            onSubmit={handleTotpVerify}
            noValidate
            sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 2 }}
        >
            <Alert severity={remainingSeconds <= 60 ? 'warning' : 'info'}>
                Google Authenticator 앱에서 아래 QR코드를 스캔하세요. ({formatTime(remainingSeconds)})
            </Alert>
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <img
                    src={qrCodeImage}
                    alt="TOTP QR Code"
                    width={200}
                    height={200}
                />
            </Box>
            <FormControl>
                <FormLabel htmlFor="totpCode">인증 코드</FormLabel>
                <TextField
                    error={!!totpCodeError}
                    helperText={totpCodeError}
                    type="text"
                    id="totpCode"
                    placeholder="6자리 코드 입력"
                    autoFocus
                    required
                    fullWidth
                    variant="outlined"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputProps={{ maxLength: 6, inputMode: 'numeric' }}
                />
            </FormControl>
            <Button type="submit" fullWidth variant="contained" disabled={loading}>
                {loading ? '인증 중...' : '인증 완료'}
            </Button>
        </Box>
    );

    const renderTotpVerifyStep = () => (
        <Box
            component="form"
            onSubmit={handleTotpVerify}
            noValidate
            sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 2 }}
        >
            <Alert severity={remainingSeconds <= 60 ? 'warning' : 'info'}>
                Google Authenticator 앱에 표시된 6자리 코드를 입력하세요. ({formatTime(remainingSeconds)})
            </Alert>
            <FormControl>
                <FormLabel htmlFor="totpCode">인증 코드</FormLabel>
                <TextField
                    error={!!totpCodeError}
                    helperText={totpCodeError}
                    type="text"
                    id="totpCode"
                    placeholder="6자리 코드 입력"
                    autoFocus
                    required
                    fullWidth
                    variant="outlined"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputProps={{ maxLength: 6, inputMode: 'numeric' }}
                />
            </FormControl>
            <Button type="submit" fullWidth variant="contained" disabled={loading}>
                {loading ? '인증 중...' : '인증 완료'}
            </Button>
        </Box>
    );

    const getTitle = () => {
        if (step === 'credentials') return 'Sign in';
        if (step === 'totp-setup') return 'TOTP 설정';
        return 'TOTP 인증';
    };

    return (
        <AppTheme {...props}>
            <CssBaseline enableColorScheme />
            <SignInContainer direction="column" justifyContent="space-between">
                <ColorModeSelect sx={{ position: 'fixed', top: '1rem', right: '1rem' }} />
                <Card variant="outlined">
                    <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: 1 }}>
                        InvestFeed
                    </Typography>
                    <Typography
                        component="h1"
                        variant="h4"
                        sx={{ width: '100%', fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}
                    >
                        {getTitle()}
                    </Typography>
                    {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
                    {step === 'credentials' && renderCredentialsStep()}
                    {step === 'totp-setup' && renderTotpSetupStep()}
                    {step === 'totp-verify' && renderTotpVerifyStep()}
                </Card>
            </SignInContainer>
        </AppTheme>
    );
}
