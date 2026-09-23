import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import {requireOk} from '../../lib/apiResponse';
import {fetchAssistantSetting, saveAssistantSetting} from '../../api/assistant/AssistantApi';
import {BRIEFING_SECTIONS, type AssistantSettingReq, type AssistantSettingRes} from '../../type/AssistantType';

const KEY = ['assistant', 'setting'] as const;

const BRIEFING_TOGGLES: { key: keyof Omit<AssistantSettingRes, 'sectionsOff'>; label: string; description: string }[] = [
    {key: 'krEnabled', label: '국내주식', description: '장 전 07:00 · 장 마감 16:00 (개장일)'},
    {key: 'usEnabled', label: '미국주식', description: 'NYSE 마감 +10분 (05:10 / 서머타임 06:10)'},
    {key: 'coinEnabled', label: '코인', description: '업비트 일봉 마감 09:05 (매일)'},
];

/** 장중 알림. ±3%·±5% 는 고정 임계이고 회원은 켜고 끄기만 한다. 서킷브레이커는 설정과 관계없이 항상 게시 (2026-09-21) */
const ALERT_TOGGLES: { key: keyof Omit<AssistantSettingRes, 'sectionsOff'>; label: string; description: string }[] = [
    {key: 'krWarnEnabled', label: '국내 지수 급변 알림', description: '코스피·코스닥 장중 ±3% · ±5% 도달 (09:00~15:30)'},
    {key: 'usWarnEnabled', label: '미국 지수 급변 알림', description: '나스닥·S&P500 장중 ±3% · ±5% 도달'},
    {key: 'releaseAlertEnabled', label: '지표 발표 알림', description: 'CPI·고용·GDP·기준금리 등 발표 확인 시'},
];

/** 토글마다 즉시 PUT (알림 설정 화면과 같은 방식). 저장 버튼 없음 */
export default function AssistantSettings() {
    const queryClient = useQueryClient();
    const {data: setting, isLoading, isError} = useQuery({
        queryKey: KEY,
        queryFn: async ({signal}) => requireOk<AssistantSettingRes | null>(
            await fetchAssistantSetting({signal, skipGlobalError: true}), null),
        refetchOnWindowFocus: false,
    });

    const mutation = useMutation({
        mutationFn: async (req: AssistantSettingReq) => {
            requireOk(await saveAssistantSetting(req), '비서 설정 저장');
        },
        onMutate: (req) => {
            const previous = queryClient.getQueryData<AssistantSettingRes | null>(KEY) ?? null;
            queryClient.setQueryData(KEY, req);
            return {previous};
        },
        onError: (_e, _req, ctx) => queryClient.setQueryData(KEY, ctx?.previous),
        onSuccess: () => queryClient.invalidateQueries({queryKey: KEY}),
    });

    if (isLoading) return <Stack spacing={1} sx={{p: 2}}>{[0, 1, 2].map((i) => <Skeleton key={i} height={36}/>)}</Stack>;
    if (isError || !setting) return <Alert severity="error" sx={{m: 2}}>설정을 불러오지 못했습니다.</Alert>;

    const toggleBriefing = (key: keyof Omit<AssistantSettingRes, 'sectionsOff'>) =>
        mutation.mutate({...setting, [key]: !setting[key]});

    const toggleSection = (id: string) => {
        const off = new Set(setting.sectionsOff);
        if (off.has(id)) off.delete(id); else off.add(id);
        mutation.mutate({...setting, sectionsOff: Array.from(off)});
    };

    return (
        <Stack spacing={2} sx={{p: 2}}>
            <Box>
                <Typography variant="subtitle2" sx={{mb: 1}}>브리핑 수신 (자산별)</Typography>
                {BRIEFING_TOGGLES.map((t) => (
                    <Box key={t.key} sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider'}}>
                        <Box>
                            <Typography variant="body2">{t.label}</Typography>
                            <Typography variant="caption" color="text.secondary">{t.description}</Typography>
                        </Box>
                        <Switch size="small" checked={setting[t.key]} onChange={() => toggleBriefing(t.key)}/>
                    </Box>
                ))}
            </Box>
            <Box>
                <Typography variant="subtitle2" sx={{mb: 1}}>알림 수신</Typography>
                {ALERT_TOGGLES.map((t) => (
                    <Box key={t.key} sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider'}}>
                        <Box>
                            <Typography variant="body2">{t.label}</Typography>
                            <Typography variant="caption" color="text.secondary">{t.description}</Typography>
                        </Box>
                        <Switch size="small" checked={setting[t.key]} onChange={() => toggleBriefing(t.key)}/>
                    </Box>
                ))}
                <Typography variant="caption" color="text.secondary" display="block" sx={{mt: 1}}>
                    서킷브레이커 발동은 설정과 관계없이 항상 알립니다.
                </Typography>
            </Box>
            <Box>
                <Typography variant="subtitle2" sx={{mb: 0.5}}>섹션 표시</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{mb: 1}}>
                    끈 섹션은 다음 브리핑부터 빠집니다. 헤드라인과 요약은 항상 표시됩니다.
                </Typography>
                {BRIEFING_SECTIONS.map((g) => (
                    <Box key={g.group} sx={{mb: 1}}>
                        <Typography variant="caption" sx={{fontWeight: 600}}>{g.group}</Typography>
                        <Stack sx={{pl: 0.5}}>
                            {g.items.map((s) => (
                                <FormControlLabel
                                    key={s.id}
                                    sx={{m: 0, '& .MuiFormControlLabel-label': {fontSize: '0.8125rem'}}}
                                    control={<Checkbox size="small" checked={!setting.sectionsOff.includes(s.id)} onChange={() => toggleSection(s.id)}/>}
                                    label={s.personal ? `${s.label} (개인)` : s.label}
                                />
                            ))}
                        </Stack>
                    </Box>
                ))}
            </Box>
        </Stack>
    );
}
