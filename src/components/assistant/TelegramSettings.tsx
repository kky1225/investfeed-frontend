import {useEffect, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import {requireOk} from '../../lib/apiResponse';
import {fetchTelegramStatus, issueTelegramLinkCode, unlinkTelegram, updateTelegramStatus} from '../../api/assistant/AssistantApi';
import type {TelegramLinkCodeRes, TelegramStatusRes} from '../../type/AssistantType';

const KEY = ['assistant', 'telegram'] as const;

export default function TelegramSettings() {
    const queryClient = useQueryClient();
    const [linkCode, setLinkCode] = useState<TelegramLinkCodeRes | null>(null);
    const [error, setError] = useState<string | null>(null);

    const {data: status, isLoading, isError} = useQuery({
        queryKey: KEY,
        queryFn: async ({signal}) => requireOk<TelegramStatusRes | null>(
            await fetchTelegramStatus({signal, skipGlobalError: true}), null),
        refetchOnWindowFocus: true,
        // 코드를 띄워 둔 동안은 /start 처리를 곧 반영하도록 짧게 폴링
        refetchInterval: linkCode ? 5_000 : false,
    });

    const refresh = () => queryClient.invalidateQueries({queryKey: KEY});

    const codeMutation = useMutation({
        mutationFn: async () => requireOk(await issueTelegramLinkCode(), '연결 코드 발급'),
        onSuccess: (res) => { setLinkCode(res); setError(null); },
        onError: (e: Error) => setError(e.message),
    });
    const statusMutation = useMutation({
        mutationFn: async (next: 'ACTIVE' | 'PAUSED') => requireOk(await updateTelegramStatus({status: next}), '텔레그램 발송 설정'),
        onSuccess: () => { refresh(); setError(null); },
        onError: (e: Error) => setError(e.message),
    });
    const unlinkMutation = useMutation({
        mutationFn: async () => requireOk(await unlinkTelegram(), '텔레그램 연결 해제'),
        onSuccess: () => { refresh(); setLinkCode(null); setError(null); },
        onError: (e: Error) => setError(e.message),
    });

    const linked = !!status && status.status !== 'NONE';
    // /start 처리가 반영되면 코드 안내를 닫는다
    useEffect(() => { if (linked) setLinkCode(null); }, [linked]);

    if (isLoading) return <Skeleton height={36}/>;
    if (isError || !status) return <Alert severity="error">텔레그램 상태를 불러오지 못했습니다.</Alert>;

    return (
        <Box>
            <Typography variant="subtitle2" sx={{mb: 0.5}}>텔레그램</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{mb: 1}}>
                지수 급변·서킷브레이커·지표 발표·보유 종목 급등락을 텔레그램으로도 받습니다. 종류별 수신은 위 알림 설정을 따르고, 브리핑은 보내지 않습니다.
            </Typography>

            {!status.configured && (
                <Alert severity="info" sx={{mb: 1}}>서버에 텔레그램 봇이 설정되지 않아 연결할 수 없습니다.</Alert>
            )}
            {status.sendBlocked && (
                <Alert severity="warning" sx={{mb: 1}}>관리자가 전체 텔레그램 발송을 일시 중지했습니다.</Alert>
            )}
            {status.status === 'BLOCKED' && (
                <Alert severity="warning" sx={{mb: 1}}>봇이 차단되어 발송할 수 없습니다. 텔레그램에서 차단을 풀고 발송 스위치를 다시 켜 주세요.</Alert>
            )}
            {error && <Alert severity="error" sx={{mb: 1}} onClose={() => setError(null)}>{error}</Alert>}

            {!linked ? (
                <Stack spacing={1}>
                    <Box>
                        <Button size="small" variant="outlined" onClick={() => codeMutation.mutate()} disabled={!status.configured || codeMutation.isPending}>
                            {linkCode ? '코드 다시 받기' : '연결하기'}
                        </Button>
                    </Box>
                    {linkCode && (
                        <Alert severity="info" icon={false}>
                            <Typography variant="body2" sx={{mb: 0.5}}>
                                텔레그램에서 <Link href={linkCode.deepLink} target="_blank" rel="noopener">@{status.botUsername}</Link> 을 열고
                                아래 코드를 보내 주세요. 링크를 누르면 자동으로 입력됩니다.
                            </Typography>
                            <Typography variant="h5" sx={{fontFamily: 'monospace', letterSpacing: 4}}>/start {linkCode.code}</Typography>
                            <Typography variant="caption" color="text.secondary">
                                10분 안에 1회만 쓸 수 있습니다. 만료 {new Date(linkCode.expiresAt).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}
                            </Typography>
                        </Alert>
                    )}
                </Stack>
            ) : (
                <Stack spacing={0.5}>
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider'}}>
                        <Box>
                            <Typography variant="body2">텔레그램 발송</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {status.linkedAt ? `${new Date(status.linkedAt).toLocaleDateString('ko-KR')} 연결` : '연결됨'}
                                {status.status === 'PAUSED' && ' · 일시중지 (봇에 /stop 을 보내도 꺼집니다)'}
                            </Typography>
                        </Box>
                        <Switch
                            size="small"
                            checked={status.status === 'ACTIVE'}
                            onChange={(_, checked) => statusMutation.mutate(checked ? 'ACTIVE' : 'PAUSED')}
                        />
                    </Box>
                    <Box>
                        <Button size="small" color="inherit" onClick={() => unlinkMutation.mutate()} disabled={unlinkMutation.isPending}>
                            연결 해제
                        </Button>
                    </Box>
                </Stack>
            )}
        </Box>
    );
}
