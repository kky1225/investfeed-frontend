import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MuiCard from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import { styled } from '@mui/material/styles';

import ColorModeSelect from '../../components/ColorModeSelect.tsx';
import AppTheme from '../../components/AppTheme.tsx';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchProfile, updateProfile } from '../../api/auth/AuthApi';
import { useAuth } from '../../context/AuthContext';
import { requireOk } from '../../lib/apiResponse';
import type { MemberRes, UpdateProfileReq } from '../../type/AuthType';

const ERROR_MESSAGES: Record<string, string> = {
    AUTH_4010: '인증 정보가 유효하지 않습니다. 다시 로그인해 주세요.',
    AUTH_4013: '이미 사용 중인 이메일입니다.',
    AUTH_4014: '이미 사용 중인 전화번호입니다.',
};
const DEFAULT_ERROR = '프로필 수정에 실패했습니다. 잠시 후 다시 시도해 주세요.';

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

const Container = styled(Stack)(({ theme }) => ({
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

export default function Profile(props: { disableCustomTheme?: boolean }) {
    const queryClient = useQueryClient();
    const [nickname, setNickname] = useState('');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loginId, setLoginId] = useState('');
    const [nicknameError, setNicknameError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [nameError, setNameError] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [dialog, setDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const navigate = useNavigate();
    const { user, updateUser } = useAuth();

    const {data: profile, isLoading: initialLoading, isError: profileError} = useQuery<MemberRes | null>({
        queryKey: ['profile'],
        queryFn: async ({signal}) => requireOk<MemberRes | null>(await fetchProfile({signal, skipGlobalError: true}), null),
    });

    // 서버 응답 도착 시 form 입력 필드를 한 번만 초기화 (이후 사용자 편집 보존).
    // React 공식 "Resetting state when a prop changes" 패턴 — useEffect 대신 render 중 비교.
    const fetchedLoginId = profile?.loginId ?? null;
    const [syncedLoginId, setSyncedLoginId] = useState<string | null>(null);
    if (fetchedLoginId && fetchedLoginId !== syncedLoginId) {
        setSyncedLoginId(fetchedLoginId);
        setLoginId(profile!.loginId);
        setNickname(profile!.nickname);
        setEmail(profile!.email);
        setName(profile!.name);
        setPhone(profile!.phone);
    }
    // profileError 변화에 따른 에러 메시지 — render 중 비교 (errorMessage 사용자 편집 가능성 고려)
    const [prevProfileError, setPrevProfileError] = useState(false);
    if (profileError !== prevProfileError) {
        setPrevProfileError(profileError);
        if (profileError) setErrorMessage('프로필 정보를 불러오는데 실패했습니다.');
    }

    const validate = () => {
        let valid = true;

        if (!nickname.trim()) {
            setNicknameError('닉네임을 입력해주세요.');
            valid = false;
        } else {
            setNicknameError('');
        }

        if (!email.trim()) {
            setEmailError('이메일을 입력해주세요.');
            valid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setEmailError('올바른 이메일 형식을 입력해주세요.');
            valid = false;
        } else {
            setEmailError('');
        }

        if (!name.trim()) {
            setNameError('이름을 입력해주세요.');
            valid = false;
        } else {
            setNameError('');
        }

        if (!phone.trim()) {
            setPhoneError('전화번호를 입력해주세요.');
            valid = false;
        } else {
            setPhoneError('');
        }

        return valid;
    };

    const updateProfileMutation = useMutation({
        mutationFn: async (req: UpdateProfileReq) => {
            requireOk(await updateProfile(req), '프로필 수정');
            return req;
        },
        onSuccess: ({nickname, email}) => {
            if (user) updateUser({ ...user, nickname, email });
            queryClient.invalidateQueries({queryKey: ['profile']});
            setDialog({
                title: '프로필 수정 완료',
                message: '프로필이 성공적으로 수정되었습니다.',
                onConfirm: () => navigate('/'),
            });
        },
        onError: (err: unknown) => {
            console.error(err);
            const axiosErr = err as { response?: { status?: number; data?: { code?: string; result?: Record<string, string> } } };
            const code = axiosErr.response?.data?.code ?? '';
            if (axiosErr.response?.status === 400 && code === 'VALIDATION_4001') {
                const result = axiosErr.response?.data?.result ?? {};
                if (result.nickname) setNicknameError(result.nickname);
                if (result.email) setEmailError(result.email);
                if (result.name) setNameError(result.name);
                if (result.phone) setPhoneError(result.phone);
                return;
            }
            if (code === 'AUTH_4013') {
                setEmailError(ERROR_MESSAGES[code]);
            } else if (code === 'AUTH_4014') {
                setPhoneError(ERROR_MESSAGES[code]);
            } else {
                setErrorMessage(ERROR_MESSAGES[code] ?? DEFAULT_ERROR);
            }
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setErrorMessage('');
        const req: UpdateProfileReq = { nickname, email, name, phone };
        updateProfileMutation.mutate(req);
    };

    if (initialLoading) {
        return (
            <AppTheme {...props}>
                <CssBaseline enableColorScheme />
                <Container direction="column" justifyContent="space-between">
                    <ColorModeSelect sx={{ position: 'fixed', top: '1rem', right: '1rem' }} />
                    <Card variant="outlined">
                        <Skeleton width={120} height={32}/>
                        <Skeleton width={200} height={40} sx={{mb: 1}}/>
                        {Array.from({length: 5}).map((_, i) => (
                            <Box key={i} sx={{display: 'flex', flexDirection: 'column', gap: 0.5}}>
                                <Skeleton width={60}/>
                                <Skeleton variant="rounded" height={40}/>
                            </Box>
                        ))}
                        <Skeleton variant="rounded" height={36} sx={{mt: 1}}/>
                        <Skeleton width={80} sx={{mx: 'auto'}}/>
                    </Card>
                </Container>
            </AppTheme>
        );
    }

    return (
        <AppTheme {...props}>
            <CssBaseline enableColorScheme />
            <Container direction="column" justifyContent="space-between">
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
                        회원정보 수정
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
                                id="loginId"
                                value={loginId}
                                fullWidth
                                variant="outlined"
                                disabled
                            />
                        </FormControl>
                        <FormControl>
                            <FormLabel htmlFor="name">이름</FormLabel>
                            <TextField
                                error={!!nameError}
                                helperText={nameError}
                                id="name"
                                placeholder="이름"
                                required
                                fullWidth
                                variant="outlined"
                                value={name}
                                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
                            />
                        </FormControl>
                        <FormControl>
                            <FormLabel htmlFor="nickname">닉네임</FormLabel>
                            <TextField
                                error={!!nicknameError}
                                helperText={nicknameError}
                                id="nickname"
                                placeholder="닉네임"
                                required
                                fullWidth
                                variant="outlined"
                                value={nickname}
                                onChange={(e) => { setNickname(e.target.value); if (nicknameError) setNicknameError(''); }}
                            />
                        </FormControl>
                        <FormControl>
                            <FormLabel htmlFor="email">이메일</FormLabel>
                            <TextField
                                error={!!emailError}
                                helperText={emailError}
                                id="email"
                                type="email"
                                placeholder="이메일"
                                required
                                fullWidth
                                variant="outlined"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                            />
                        </FormControl>
                        <FormControl>
                            <FormLabel htmlFor="phone">전화번호</FormLabel>
                            <TextField
                                error={!!phoneError}
                                helperText={phoneError}
                                id="phone"
                                placeholder="전화번호"
                                required
                                fullWidth
                                variant="outlined"
                                value={phone}
                                onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(''); }}
                            />
                        </FormControl>
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={updateProfileMutation.isPending}
                        >
                            {updateProfileMutation.isPending ? '수정 중...' : '수정하기'}
                        </Button>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography sx={{ textAlign: 'center' }}>
                            <Link component="button" type="button" onClick={() => navigate(-1)} variant="body2">
                                돌아가기
                            </Link>
                        </Typography>
                    </Box>
                </Card>
                <Dialog open={!!dialog} onClose={() => {}}>
                    <DialogTitle>{dialog?.title}</DialogTitle>
                    <DialogContent>
                        <DialogContentText>{dialog?.message}</DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={dialog?.onConfirm} variant="contained" autoFocus>
                            확인
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </AppTheme>
    );
}
