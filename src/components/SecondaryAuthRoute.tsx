import {useCallback, useEffect, useRef, useState} from 'react';
import {Outlet, useNavigate} from 'react-router-dom';
import {Box, Button, CircularProgress, Stack, Typography} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import {
    isSecondaryAuthUnlocked, requestSecondaryAuth, syncSecondaryAuth, useSecondaryAuthKnown, useSecondaryAuthUnlocked,
} from '../lib/secondaryAuth';
import {dismissSecondaryAuth} from '../axios';

/**
 * 2차 인증이 있어야 열리는 화면(계좌·자산·목표·리밸런싱·관리자). 서버의 SecurityPaths.SECONDARY_AUTH_PATTERNS 와 맞출 것.
 *
 * 2차 인증이 된 동안에만 화면을 그린다. 들어올 때나 보는 중에 인증이 풀리면 화면을 가리고 2차 비밀번호 창을 한 번 띄운다.
 * 그 창을 닫으면 보여 줄 내용이 없으므로 이전 화면으로 돌려보낸다. 이 결정은 이 화면만 내린다 (공통 코드는 화면을 옮기지 않는다).
 * 돌아간 화면도 보호된 화면이거나, 서버에 상태를 묻지 못했으면 창을 다시 띄우지 않고 안내와 인증 버튼을 보여 준다.
 */
export default function SecondaryAuthRoute() {
    const known = useSecondaryAuthKnown();
    const unlocked = useSecondaryAuthUnlocked();
    const navigate = useNavigate();
    const [prompting, setPrompting] = useState(false);
    const [syncSettled, setSyncSettled] = useState(false);
    const autoPrompted = useRef(false);   // 들어왔을 때·인증이 풀렸을 때 창은 한 번만 자동으로 띄운다
    const mounted = useRef(true);
    const waiting = useRef(false);        // 이 화면이 연 창의 결과를 기다리는 중인지

    // 창이 떠 있는 채로 이 화면을 벗어나면(브라우저 뒤로 가기 등) 창도 닫는다. 남겨 두면 인증이 필요 없는 화면 위에 창이 남는다
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            if (waiting.current) dismissSecondaryAuth();
        };
    }, []);

    // 상태를 모르면 직접 한 번 묻는다. 끝나고도 모르면(조회 실패) 안내와 인증 버튼을 보여 준다
    useEffect(() => {
        if (known) return;
        let cancelled = false;
        void syncSecondaryAuth(false).finally(() => {
            if (!cancelled) setSyncSettled(true);
        });
        return () => {
            cancelled = true;
        };
    }, [known]);

    // 인증되면 다음에 풀릴 때 다시 자동으로 창을 띄울 수 있게 한다
    useEffect(() => {
        if (unlocked) autoPrompted.current = false;
    }, [unlocked]);

    const prompt = useCallback(async (leaveOnCancel: boolean) => {
        setPrompting(true);
        waiting.current = true;
        try {
            // 서버에 묻는 사이 이 화면을 벗어났으면 창을 띄우지 않는다
            const passed = await requestSecondaryAuth({skipIfUnlocked: true, shouldPrompt: () => mounted.current});
            waiting.current = false;
            // 이미 이 화면을 벗어났거나, 창을 닫았어도 그사이 인증됐으면 옮기지 않는다
            if (passed || !leaveOnCancel || !mounted.current || isSecondaryAuthUnlocked()) return;
            // 앱 안에서 뒤로 갈 기록이 있을 때만 뒤로 간다 (react-router 가 history.state.idx 에 순번을 남긴다)
            const historyIndex = (window.history.state as {idx?: number} | null)?.idx ?? 0;
            if (historyIndex > 0) {
                navigate(-1);
            } else {
                navigate('/', {replace: true});
            }
        } catch (error) {
            console.error(error);
        } finally {
            waiting.current = false;
            if (mounted.current) setPrompting(false);
        }
    }, [navigate]);

    // navigate 는 주소가 바뀔 때마다 새로 만들어져 이 effect 도 다시 돈다. 자동 창은 autoPrompted 로 한 번만 띄운다
    // (취소하고 돌아간 화면도 보호된 화면이면 창을 다시 띄우지 않고 아래 안내를 보여 준다)
    useEffect(() => {
        if (!known || unlocked || autoPrompted.current) return;
        autoPrompted.current = true;
        void prompt(true);
    }, [known, unlocked, prompt]);

    if (unlocked) return <Outlet/>;

    if (prompting || (!known && !syncSettled)) {
        return (
            <Box display="flex" justifyContent="center" py={8}>
                <CircularProgress/>
            </Box>
        );
    }

    return (
        <Stack alignItems="center" spacing={2} py={8}>
            <LockOutlinedIcon color="action" fontSize="large"/>
            <Typography variant="body2" color="text.secondary">2차 인증을 해야 볼 수 있는 화면입니다.</Typography>
            <Button variant="outlined" onClick={() => void prompt(false)}>2차 인증</Button>
        </Stack>
    );
}
