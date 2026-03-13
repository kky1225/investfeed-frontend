import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MuiCard from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import { styled } from '@mui/material/styles';

import ColorModeSelect from "../../components/ColorModeSelect.tsx";
import AppTheme from "../../components/AppTheme.tsx";
import { useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import { login } from "../../api/auth/AuthApi.ts";

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

    const { setAuth } = useAuth();
    const navigate = useNavigate();

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        setErrorMessage('');
        try {
            const res = await login({ loginId, password });
            if (res.result?.accessToken) {
                // loginId를 user 정보로 저장 (nickname/email은 별도 API가 있으면 추후 확장)
                setAuth({ loginId, nickname: loginId, email: '' }, res.result.accessToken);
                navigate('/');
            }
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setErrorMessage(axiosErr.response?.data?.message ?? '로그인에 실패했습니다.');
        } finally {
            setLoading(false);
        }
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
                        Sign in
                    </Typography>
                    {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
                    <Box
                        component="form"
                        onSubmit={handleSubmit}
                        noValidate
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%',
                            gap: 2,
                        }}
                    >
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
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={loading}
                        >
                            {loading ? '로그인 중...' : 'Sign in'}
                        </Button>
                    </Box>
                    <Divider>or</Divider>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography sx={{ textAlign: 'center' }}>
                            계정이 없으신가요?{' '}
                            <Link component={RouterLink} to="/signup" variant="body2">
                                Sign up
                            </Link>
                        </Typography>
                    </Box>
                </Card>
            </SignInContainer>
        </AppTheme>
    );
}
