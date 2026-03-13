import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
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
import { signup } from "../../api/auth/AuthApi.ts";

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

const SignUpContainer = styled(Stack)(({ theme }) => ({
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

interface FormErrors {
    loginId?: string;
    password?: string;
    email?: string;
    nickname?: string;
    name?: string;
    phone?: string;
}

export default function Signup(props: { disableCustomTheme?: boolean }) {
    const [form, setForm] = useState({
        loginId: '',
        password: '',
        email: '',
        nickname: '',
        name: '',
        phone: '',
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const validate = (): boolean => {
        const newErrors: FormErrors = {};
        if (!form.loginId.trim()) newErrors.loginId = '아이디를 입력해주세요.';
        if (!form.password || form.password.length < 6) newErrors.password = '비밀번호를 6자 이상 입력해주세요.';
        if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) newErrors.email = '올바른 이메일을 입력해주세요.';
        if (!form.nickname.trim()) newErrors.nickname = '닉네임을 입력해주세요.';
        if (!form.name.trim()) newErrors.name = '이름을 입력해주세요.';
        if (!form.phone.trim()) newErrors.phone = '전화번호를 입력해주세요.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        setErrorMessage('');
        setSuccessMessage('');
        try {
            await signup(form);
            setSuccessMessage('회원가입이 완료되었습니다. 로그인해주세요.');
            setTimeout(() => navigate('/login'), 1500);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setErrorMessage(axiosErr.response?.data?.message ?? '회원가입에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppTheme {...props}>
            <CssBaseline enableColorScheme />
            <SignUpContainer direction="column" justifyContent="space-between">
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
                        Sign up
                    </Typography>
                    {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
                    {successMessage && <Alert severity="success">{successMessage}</Alert>}
                    <Box
                        component="form"
                        onSubmit={handleSubmit}
                        noValidate
                        sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 2 }}
                    >
                        <FormControl>
                            <FormLabel htmlFor="loginId">아이디</FormLabel>
                            <TextField
                                error={!!errors.loginId}
                                helperText={errors.loginId}
                                type="text"
                                id="loginId"
                                name="loginId"
                                placeholder="아이디"
                                required
                                fullWidth
                                variant="outlined"
                                value={form.loginId}
                                onChange={handleChange}
                            />
                        </FormControl>
                        <FormControl>
                            <FormLabel htmlFor="password">비밀번호</FormLabel>
                            <TextField
                                error={!!errors.password}
                                helperText={errors.password}
                                type="password"
                                id="password"
                                name="password"
                                placeholder="비밀번호 (6자 이상)"
                                required
                                fullWidth
                                variant="outlined"
                                value={form.password}
                                onChange={handleChange}
                            />
                        </FormControl>
                        <FormControl>
                            <FormLabel htmlFor="name">이름</FormLabel>
                            <TextField
                                error={!!errors.name}
                                helperText={errors.name}
                                type="text"
                                id="name"
                                name="name"
                                placeholder="이름"
                                required
                                fullWidth
                                variant="outlined"
                                value={form.name}
                                onChange={handleChange}
                            />
                        </FormControl>
                        <FormControl>
                            <FormLabel htmlFor="email">이메일</FormLabel>
                            <TextField
                                error={!!errors.email}
                                helperText={errors.email}
                                type="email"
                                id="email"
                                name="email"
                                placeholder="이메일"
                                required
                                fullWidth
                                variant="outlined"
                                value={form.email}
                                onChange={handleChange}
                            />
                        </FormControl>
                        <FormControl>
                            <FormLabel htmlFor="nickname">닉네임</FormLabel>
                            <TextField
                                error={!!errors.nickname}
                                helperText={errors.nickname}
                                type="text"
                                id="nickname"
                                name="nickname"
                                placeholder="닉네임"
                                required
                                fullWidth
                                variant="outlined"
                                value={form.nickname}
                                onChange={handleChange}
                            />
                        </FormControl>
                        <FormControl>
                            <FormLabel htmlFor="phone">전화번호</FormLabel>
                            <TextField
                                error={!!errors.phone}
                                helperText={errors.phone}
                                type="tel"
                                id="phone"
                                name="phone"
                                placeholder="전화번호 (예: 01012345678)"
                                required
                                fullWidth
                                variant="outlined"
                                value={form.phone}
                                onChange={handleChange}
                            />
                        </FormControl>
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={loading}
                        >
                            {loading ? '처리 중...' : '회원가입'}
                        </Button>
                    </Box>
                    <Typography sx={{ textAlign: 'center' }}>
                        이미 계정이 있으신가요?{' '}
                        <Link component={RouterLink} to="/login" variant="body2">
                            Sign in
                        </Link>
                    </Typography>
                </Card>
            </SignUpContainer>
        </AppTheme>
    );
}
