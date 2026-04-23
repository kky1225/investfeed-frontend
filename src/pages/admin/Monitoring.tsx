import {useEffect, useState} from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {DataGrid, type GridColDef} from '@mui/x-data-grid';
import {
    fetchSchedulerStatus,
    fetchSchedulerLogs,
    fetchSchedulerConfigLogs,
    updateSchedulerTimeout,
    triggerScheduler,
    acknowledgeSchedulerLog,
    cancelAcknowledgeSchedulerLog,
    fetchSchedulerLogAckHistory,
    fetchRedis,
    invalidateRedisPrefix,
    fetchErrorLogs,
    acknowledgeErrorLog,
    cancelAcknowledgeErrorLog,
    fetchErrorLogAckHistory,
    fetchSystemStatus,
} from '../../api/admin/MonitoringApi';
import type {
    SchedulerStatusRes,
    SchedulerLogRes,
    SchedulerConfigLogRes,
    SchedulerState,
    RedisPrefixRes,
    ErrorLogRes,
    SystemStatusRes,
    LogAckHistoryRes,
} from '../../type/MonitoringType';

type TabKey = 'scheduler' | 'config' | 'redis' | 'error' | 'system';

function formatDateTime(s: string | null): string {
    if (!s) return '-';
    const d = new Date(s);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// 스케줄러 카탈로그. 실제로 한 번이라도 실행되어야 DB에 status 행이 생기므로,
// 프론트에서 전체 목록을 먼저 그려두고 DB 데이터가 있는 건 덮어쓴다.
type SchedulerType = 'FAST' | 'SLOW';
const SCHEDULER_CATALOG: Array<{name: string; type: SchedulerType; label: string; cron: string}> = [
    {name: 'PriceAlertScheduler',          type: 'FAST', label: '매분',         cron: '0 * * * * *'},
    {name: 'MarketIndexScheduler',         type: 'FAST', label: '매분',         cron: '0 * * * * *'},
    {name: 'InvestorCloseMarketScheduler', type: 'FAST', label: '매분(15:36~21:00)', cron: '0 * * * * *'},
    {name: 'CalendarSyncScheduler',        type: 'SLOW', label: '매 30분',      cron: '0 */30 * * * *'},
    {name: 'GoalAlertScheduler',           type: 'SLOW', label: '매시 정각',    cron: '0 0 * * * *'},
    {name: 'RebalancingAlertScheduler',    type: 'SLOW', label: '매시 정각',    cron: '0 0 * * * *'},
    {name: 'RecommendScheduler',           type: 'SLOW', label: '매시 30분',    cron: '0 30 * * * *'},
    {name: 'HoldingSyncScheduler',         type: 'SLOW', label: '매일 00:00',   cron: '0 0 0 * * *'},
    {name: 'SchedulerLogCleanupScheduler', type: 'SLOW', label: '매일 04:00',   cron: '0 0 4 * * *'},
    {name: 'InterestSyncScheduler',        type: 'SLOW', label: '매일 05:15',   cron: '0 15 5 * * *'},
    {name: 'IndexInvestorDailyScheduler',  type: 'SLOW', label: '매일 07:00',   cron: '0 0 7 * * *'},
    {name: 'ApiKeyExpiryScheduler',        type: 'SLOW', label: '매일 09:00',   cron: '0 0 9 * * *'},
    {name: 'StockDividendScheduler',       type: 'SLOW', label: '매일 13:30',   cron: '0 30 13 * * *'},
    {name: 'HolidayRefreshScheduler',      type: 'SLOW', label: '매월 1일 00:05', cron: '0 5 0 1 * *'},
];

function formatUptime(sec: number): string {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}일 ${h}시간 ${m}분`;
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
}

const STATE_META: Record<SchedulerState, {color: string; label: string}> = {
    SUCCESS:  {color: 'success.main', label: '정상'},
    WARNING:  {color: 'warning.main', label: '최근 이상 발생'},
    FAILED:   {color: 'error.main',   label: '실패'},
    STUCK:    {color: '#ff9800',      label: '멈춤 (timeout 초과)'},
    PENDING:  {color: 'grey.400',     label: '대기 (실행 기록 없음)'},
};

export default function Monitoring() {
    const [tab, setTab] = useState<TabKey>('scheduler');
    const [statuses, setStatuses] = useState<SchedulerStatusRes[]>([]);
    const [logs, setLogs] = useState<SchedulerLogRes[]>([]);
    const [logsTotal, setLogsTotal] = useState(0);
    const [logsPage, setLogsPage] = useState(0);
    const [logsSize, setLogsSize] = useState(20);
    const [configLogs, setConfigLogs] = useState<SchedulerConfigLogRes[]>([]);
    const [configLogsTotal, setConfigLogsTotal] = useState(0);
    const [configLogsPage, setConfigLogsPage] = useState(0);
    const [configLogsSize, setConfigLogsSize] = useState(20);
    const [redisPrefixes, setRedisPrefixes] = useState<RedisPrefixRes[]>([]);
    const [errorLogs, setErrorLogs] = useState<ErrorLogRes[]>([]);
    const [errorLogsTotal, setErrorLogsTotal] = useState(0);
    const [errorLogsPage, setErrorLogsPage] = useState(0);
    const [errorLogsSize, setErrorLogsSize] = useState(50);
    const [systemStatus, setSystemStatus] = useState<SystemStatusRes | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [errorAckTarget, setErrorAckTarget] = useState<ErrorLogRes | null>(null);
    const [errorAckNote, setErrorAckNote] = useState('');
    const [errorAckSaving, setErrorAckSaving] = useState(false);
    const [errorAckHistory, setErrorAckHistory] = useState<LogAckHistoryRes[]>([]);
    const [errorAckHistoryOpen, setErrorAckHistoryOpen] = useState(false);
    const [errorAckEditing, setErrorAckEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editTarget, setEditTarget] = useState<SchedulerStatusRes | null>(null);
    const [editTimeoutSec, setEditTimeoutSec] = useState<string>('');
    const [editReason, setEditReason] = useState<string>('');
    const [editSaving, setEditSaving] = useState(false);
    const [ackTarget, setAckTarget] = useState<SchedulerLogRes | null>(null);
    const [ackNote, setAckNote] = useState<string>('');
    const [ackSaving, setAckSaving] = useState(false);
    const [ackHistory, setAckHistory] = useState<LogAckHistoryRes[]>([]);
    const [ackHistoryOpen, setAckHistoryOpen] = useState(false);
    const [ackEditing, setAckEditing] = useState(false);
    const [triggerTarget, setTriggerTarget] = useState<SchedulerStatusRes | null>(null);
    const [triggering, setTriggering] = useState(false);
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
    const [menuTarget, setMenuTarget] = useState<SchedulerStatusRes | null>(null);

    const loadAll = async () => {
        try {
            const [statusRes, logsRes, configLogsRes, redisRes, errorRes, sysRes] = await Promise.all([
                fetchSchedulerStatus(),
                fetchSchedulerLogs({page: logsPage, size: logsSize}),
                fetchSchedulerConfigLogs({page: configLogsPage, size: configLogsSize}),
                fetchRedis(),
                fetchErrorLogs({page: errorLogsPage, size: errorLogsSize}),
                fetchSystemStatus(),
            ]);
            if (statusRes.result) setStatuses(statusRes.result);
            if (logsRes.result) {
                setLogs(logsRes.result.content ?? []);
                setLogsTotal(logsRes.result.totalElements ?? 0);
            }
            if (configLogsRes.result) {
                setConfigLogs(configLogsRes.result.content ?? []);
                setConfigLogsTotal(configLogsRes.result.totalElements ?? 0);
            }
            if (redisRes.result) setRedisPrefixes(redisRes.result.prefixes ?? []);
            if (errorRes.result) {
                setErrorLogs(errorRes.result.content ?? []);
                setErrorLogsTotal(errorRes.result.totalElements ?? 0);
            }
            if (sysRes.result) setSystemStatus(sysRes.result);
            setLastUpdated(new Date());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;

        (async () => {
            await loadAll();

            const now = Date.now();
            const waitTime = 60_000 - (now % 60_000);

            timeout = setTimeout(() => {
                loadAll();
                interval = setInterval(() => {
                    loadAll();
                }, 60_000);
            }, waitTime + 200);
        })();

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logsPage, logsSize, configLogsPage, configLogsSize, errorLogsPage, errorLogsSize]);

    const openEdit = (s: SchedulerStatusRes) => {
        setEditTarget(s);
        setEditTimeoutSec(String(s.timeoutSec));
        setEditReason('');
    };
    const closeEdit = () => {
        if (editSaving) return;
        setEditTarget(null);
    };
    const openTrigger = (s: SchedulerStatusRes) => {
        setTriggerTarget(s);
    };
    const closeTrigger = () => {
        if (triggering) return;
        setTriggerTarget(null);
    };
    const confirmTrigger = async () => {
        if (!triggerTarget) return;
        setTriggering(true);
        try {
            await triggerScheduler(triggerTarget.schedulerName);
            setTriggerTarget(null);
            // 약간 지연 후 refresh (백그라운드 실행 반영 위해)
            setTimeout(loadAll, 1500);
        } catch (e) {
            console.error('수동 실행 실패', e);
        } finally {
            setTriggering(false);
        }
    };

    const openErrorAck = async (log: ErrorLogRes) => {
        setErrorAckTarget(log);
        setErrorAckNote(log.acknowledgeNote ?? '');
        setErrorAckEditing(false);
        setErrorAckHistoryOpen(false);
        setErrorAckHistory([]);
        try {
            const res = await fetchErrorLogAckHistory(log.id);
            setErrorAckHistory(res.result ?? []);
        } catch { /* 이력 조회 실패해도 다이얼로그는 열림 */ }
    };
    const closeErrorAck = () => {
        if (errorAckSaving) return;
        setErrorAckTarget(null);
    };
    const saveErrorAck = async () => {
        if (!errorAckTarget) return;
        setErrorAckSaving(true);
        try {
            const res = await acknowledgeErrorLog(errorAckTarget.id, {note: errorAckNote || null});
            if (res.result) {
                setErrorAckTarget(res.result);
                setErrorAckEditing(false);
                // 이력 재조회
                const h = await fetchErrorLogAckHistory(res.result.id);
                setErrorAckHistory(h.result ?? []);
            }
            await loadAll();
        } catch (e) {
            console.error('에러 로그 확인 저장 실패', e);
        } finally {
            setErrorAckSaving(false);
        }
    };
    const cancelErrorAck = async () => {
        if (!errorAckTarget) return;
        setErrorAckSaving(true);
        try {
            const res = await cancelAcknowledgeErrorLog(errorAckTarget.id);
            if (res.result) {
                setErrorAckTarget(res.result);
                setErrorAckNote('');
                setErrorAckEditing(false);
                const h = await fetchErrorLogAckHistory(res.result.id);
                setErrorAckHistory(h.result ?? []);
            }
            await loadAll();
        } catch (e) {
            console.error('에러 로그 확인 취소 실패', e);
        } finally {
            setErrorAckSaving(false);
        }
    };

    const openAck = async (log: SchedulerLogRes) => {
        setAckTarget(log);
        setAckNote(log.acknowledgeNote ?? '');
        setAckEditing(false);
        setAckHistoryOpen(false);
        setAckHistory([]);
        try {
            const res = await fetchSchedulerLogAckHistory(log.id);
            setAckHistory(res.result ?? []);
        } catch { /* 이력 조회 실패해도 다이얼로그는 열림 */ }
    };
    const closeAck = () => {
        if (ackSaving) return;
        setAckTarget(null);
    };
    const saveAck = async () => {
        if (!ackTarget) return;
        setAckSaving(true);
        try {
            const res = await acknowledgeSchedulerLog(ackTarget.id, {note: ackNote || null});
            if (res.result) {
                setAckTarget(res.result);
                setAckEditing(false);
                const h = await fetchSchedulerLogAckHistory(res.result.id);
                setAckHistory(h.result ?? []);
            }
            await loadAll();
        } catch (e) {
            console.error('스케줄러 로그 확인 저장 실패', e);
        } finally {
            setAckSaving(false);
        }
    };
    const cancelAck = async () => {
        if (!ackTarget) return;
        setAckSaving(true);
        try {
            const res = await cancelAcknowledgeSchedulerLog(ackTarget.id);
            if (res.result) {
                setAckTarget(res.result);
                setAckNote('');
                setAckEditing(false);
                const h = await fetchSchedulerLogAckHistory(res.result.id);
                setAckHistory(h.result ?? []);
            }
            await loadAll();
        } catch (e) {
            console.error('스케줄러 로그 확인 취소 실패', e);
        } finally {
            setAckSaving(false);
        }
    };

    const saveEdit = async () => {
        if (!editTarget) return;
        const n = Number(editTimeoutSec);
        if (!Number.isFinite(n) || n < 1 || n > 86400) return;
        setEditSaving(true);
        try {
            await updateSchedulerTimeout(editTarget.schedulerName, {timeoutSec: n, reason: editReason || null});
            setEditTarget(null);
            await loadAll();
        } catch (e) {
            console.error('timeout 수정 실패', e);
        } finally {
            setEditSaving(false);
        }
    };

    const handleInvalidate = async (prefix: string) => {
        try {
            await invalidateRedisPrefix(prefix);
            const redisRes = await fetchRedis();
            if (redisRes.result) setRedisPrefixes(redisRes.result.prefixes ?? []);
        } catch (e) {
            console.error('Redis 무효화 실패', e);
        }
    };

    const logColumns: GridColDef[] = [
        {field: 'startedAt', headerName: '시작', flex: 1, minWidth: 160, valueFormatter: (v: string) => formatDateTime(v)},
        {field: 'schedulerName', headerName: '스케줄러', flex: 1, minWidth: 200},
        {field: 'status', headerName: '상태', width: 120, renderCell: (p) => {
            const color = p.value === 'SUCCESS' ? 'success'
                : p.value === 'INTERRUPTED' ? 'warning'
                : 'error';
            return <Chip label={p.value} size="small" color={color} variant="outlined"/>;
        }},
        {field: 'durationMs', headerName: '소요(ms)', width: 100, type: 'number'},
        {field: 'errorMessage', headerName: '에러 메시지', flex: 2, minWidth: 300},
        {field: 'acknowledged', headerName: '확인', width: 70, sortable: false, align: 'center', headerAlign: 'center', renderCell: (p) => {
            const row = p.row as SchedulerLogRes;
            const content = row.status === 'SUCCESS'
                ? <span style={{color: '#aaa'}}>-</span>
                : row.acknowledged
                    ? <CheckCircleIcon sx={{color: 'success.main', fontSize: 20}}/>
                    : <CancelIcon sx={{color: 'error.main', fontSize: 20}}/>;
            return <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%'}}>{content}</Box>;
        }},
    ];

    const configLogColumns: GridColDef[] = [
        {field: 'changedAt', headerName: '시각', flex: 1, minWidth: 160, valueFormatter: (v: string) => formatDateTime(v)},
        {field: 'schedulerName', headerName: '스케줄러', flex: 1, minWidth: 200},
        {field: 'fieldName', headerName: '항목', width: 120},
        {field: 'oldValue', headerName: '이전값', width: 100, valueFormatter: (v: string | null) => v ?? '-'},
        {field: 'newValue', headerName: '새 값', width: 100},
        {field: 'changedByName', headerName: '변경자', width: 140, valueFormatter: (v: string | null) => v ?? '-'},
        {field: 'reason', headerName: '사유', flex: 1, minWidth: 200, valueFormatter: (v: string | null) => v ?? '-'},
    ];

    const redisColumns: GridColDef[] = [
        {field: 'prefix', headerName: 'Prefix', width: 220},
        {field: 'description', headerName: '설명', flex: 1, minWidth: 220},
        {field: 'keyCount', headerName: '키 개수', width: 100, type: 'number'},
        {field: 'minTtlSec', headerName: 'Min TTL(초)', width: 120, type: 'number',
            valueFormatter: (v: number | null) => v == null ? '-' : v.toString()},
        {field: 'maxTtlSec', headerName: 'Max TTL(초)', width: 120, type: 'number',
            valueFormatter: (v: number | null) => v == null ? '-' : v.toString()},
        {field: 'actions', headerName: '관리', width: 100, sortable: false, renderCell: (p) => (
            <Button size="small" color="error" disabled={p.row.keyCount === 0}
                onClick={() => handleInvalidate(p.row.prefix)}>
                무효화
            </Button>
        )},
    ];

    const errorColumns: GridColDef[] = [
        {field: 'occurredAt', headerName: '시각', width: 160, valueFormatter: (v: string) => formatDateTime(v)},
        {field: 'threadName', headerName: 'Thread', width: 150, valueFormatter: (v: string | null) => v ?? '-'},
        {field: 'loggerName', headerName: 'Logger', flex: 1, minWidth: 200},
        {field: 'message', headerName: '메시지', flex: 2, minWidth: 300, valueFormatter: (v: string | null) => v ?? ''},
        {field: 'acknowledged', headerName: '확인', width: 70, sortable: false, align: 'center', headerAlign: 'center', renderCell: (p) => {
            const row = p.row as ErrorLogRes;
            const icon = row.acknowledged
                ? <CheckCircleIcon sx={{color: 'success.main', fontSize: 20}}/>
                : <CancelIcon sx={{color: 'error.main', fontSize: 20}}/>;
            return <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%'}}>{icon}</Box>;
        }},
    ];
    const redisRows = redisPrefixes.map((p, i) => ({id: i, ...p}));

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2}}>
                <Typography component="h2" variant="h6">
                    모니터링
                </Typography>
                <Box sx={{flex: 1}}/>
                {lastUpdated && !loading && (
                    <Typography variant="caption" color="text.secondary">
                        {lastUpdated.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})} 기준
                    </Typography>
                )}
            </Box>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{mb: 2, borderBottom: 1, borderColor: 'divider'}}>
                <Tab label="스케줄러" value="scheduler"/>
                <Tab label="설정 변경 이력" value="config"/>
                <Tab label="Redis" value="redis"/>
                <Tab label="에러 로그" value="error"/>
                <Tab label="시스템" value="system"/>
            </Tabs>

            {/* Tab 1: 스케줄러 */}
            {tab === 'scheduler' && (
                <Box>
                    <Typography variant="subtitle2" sx={{mb: 1, color: 'text.secondary', fontWeight: 600}}>
                        스케줄러 현황
                    </Typography>
                    {(() => {
                        // 카드 렌더링 공통 헬퍼 — 문제/정상 그룹 모두에서 재사용
                        const renderCard = (info: typeof SCHEDULER_CATALOG[number]) => {
                            const s = statuses.find((x) => x.schedulerName === info.name);
                            const state: SchedulerState = s?.state ?? 'PENDING';
                            const meta = STATE_META[state];
                            return (
                                <Grid key={info.name} size={{xs: 12, sm: 6, md: 4}} sx={{display: 'flex'}}>
                                    <Card variant="outlined" sx={{opacity: s ? 1 : 0.65, width: '100%', display: 'flex', flexDirection: 'column'}}>
                                        <CardContent sx={{flex: 1, display: 'flex', flexDirection: 'column'}}>
                                            <Stack direction="row" sx={{alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap'}}>
                                                <Tooltip title={meta.label} placement="top" arrow>
                                                    <Box sx={{width: 10, height: 10, borderRadius: '50%', bgcolor: meta.color, flexShrink: 0}}/>
                                                </Tooltip>
                                                <Typography variant="body2" sx={{fontWeight: 600}}>{info.name}</Typography>
                                                <Chip label={info.type} size="small"
                                                    color={info.type === 'FAST' ? 'info' : 'default'} variant="outlined"
                                                    sx={{fontSize: '0.65rem', height: 18}}/>
                                                <Tooltip title={`cron: ${info.cron}`} placement="top" arrow>
                                                    <Chip label={info.label} size="small" variant="outlined"
                                                        sx={{fontSize: '0.65rem', height: 18, cursor: 'help'}}/>
                                                </Tooltip>
                                            </Stack>
                                            <Box sx={{flex: 1}}>
                                                {s ? (
                                                    <>
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            최근 성공: {formatDateTime(s.lastSuccessAt)}
                                                            {s.lastSuccessDurationMs != null && ` (${s.lastSuccessDurationMs}ms)`}
                                                        </Typography>
                                                        {/* 실패 줄은 항상 공간 차지 — 카드 높이 통일. 없으면 빈 라인 */}
                                                        <Typography
                                                            variant="caption"
                                                            color={s.lastFailureAt ? 'error.main' : 'transparent'}
                                                            display="block"
                                                            sx={{mt: 0.5, minHeight: '1.25em'}}
                                                        >
                                                            {s.lastFailureAt ? `최근 실패: ${formatDateTime(s.lastFailureAt)}` : '\u00A0'}
                                                        </Typography>
                                                    </>
                                                ) : (
                                                    <Typography variant="caption" color="text.disabled" display="block">
                                                        대기 중 — 아직 실행 기록 없음
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Stack direction="row" sx={{alignItems: 'center', gap: 0.5, mt: 1}}>
                                                <Chip
                                                    label={`Timeout: ${s?.timeoutSec ?? '-'}초`}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{fontSize: '0.65rem', height: 20}}
                                                />
                                                <Box sx={{flex: 1}}/>
                                                {s && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => { setMenuAnchorEl(e.currentTarget); setMenuTarget(s); }}
                                                        sx={{p: 0.25}}
                                                    >
                                                        <MoreVertIcon sx={{fontSize: 18}}/>
                                                    </IconButton>
                                                )}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        };

                        if (loading) {
                            return (
                                <Grid container spacing={2} sx={{mb: 3}}>
                                    {Array.from({length: 6}).map((_, i) => (
                                        <Grid key={i} size={{xs: 12, sm: 6, md: 4}}>
                                            <Card variant="outlined">
                                                <CardContent>
                                                    <Skeleton width={180} height={20} sx={{mb: 1}}/>
                                                    <Skeleton width={120}/>
                                                    <Skeleton width={140}/>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>
                            );
                        }

                        // 상태별 분류. PROBLEM 은 관리자 주목이 필요한 것(FAILED/STUCK/WARNING),
                        // NORMAL 은 평상시엔 접어두는 것(SUCCESS/PENDING).
                        const PROBLEM_STATES: SchedulerState[] = ['FAILED', 'STUCK', 'WARNING'];
                        const catalogWithState = SCHEDULER_CATALOG.map((info) => {
                            const s = statuses.find((x) => x.schedulerName === info.name);
                            const state: SchedulerState = s?.state ?? 'PENDING';
                            return {info, state};
                        });
                        const problemList = catalogWithState.filter((c) => PROBLEM_STATES.includes(c.state));
                        const normalList = catalogWithState.filter((c) => !PROBLEM_STATES.includes(c.state));

                        const total = catalogWithState.length;
                        const countByState = (state: SchedulerState) =>
                            catalogWithState.filter((c) => c.state === state).length;
                        // 카드 내부 상태 점과 동일한 시각 언어. 레이블은 Tooltip 으로.
                        const StateDot = ({state, count}: {state: SchedulerState; count: number}) => (
                            <Tooltip title={STATE_META[state].label} placement="top" arrow>
                                <Stack direction="row" spacing={0.75} sx={{alignItems: 'center', opacity: count === 0 ? 0.4 : 1, cursor: 'help'}}>
                                    <Box sx={{width: 10, height: 10, borderRadius: '50%', bgcolor: STATE_META[state].color}}/>
                                    <Typography variant="body2" sx={{fontWeight: 500}}>{count}</Typography>
                                </Stack>
                            </Tooltip>
                        );

                        return (
                            <>
                                {/* 상단 요약 바 — 점 색상은 카드 내부 상태 점과 일치 */}
                                <Card variant="outlined" sx={{mb: 2}}>
                                    <CardContent sx={{py: 1.5, '&:last-child': {pb: 1.5}}}>
                                        <Stack direction="row" spacing={2.5} sx={{alignItems: 'center', flexWrap: 'wrap'}}>
                                            <Typography variant="body2" sx={{fontWeight: 600}}>
                                                전체 {total}
                                            </Typography>
                                            <StateDot state="SUCCESS" count={countByState('SUCCESS')}/>
                                            <StateDot state="WARNING" count={countByState('WARNING')}/>
                                            <StateDot state="STUCK"   count={countByState('STUCK')}/>
                                            <StateDot state="FAILED"  count={countByState('FAILED')}/>
                                            <StateDot state="PENDING" count={countByState('PENDING')}/>
                                        </Stack>
                                    </CardContent>
                                </Card>

                                {/* 문제가 있는 스케줄러 — 항상 펼친 상태로 노출 */}
                                {problemList.length > 0 && (
                                    <>
                                        <Typography variant="caption" sx={{display: 'block', mb: 1, color: 'error.main', fontWeight: 600}}>
                                            ⚠ 주의 필요 ({problemList.length})
                                        </Typography>
                                        <Grid container spacing={2} sx={{mb: 3}}>
                                            {problemList.map((c) => renderCard(c.info))}
                                        </Grid>
                                    </>
                                )}

                                {/* 스케줄러 목록 — 문제가 하나도 없으면 기본 펼침, 있으면 접힘.
                                    Box 로 감싸서 Accordion 이 `:last-of-type` 이 되도록 함
                                    (surfaces.ts 의 `&:not(:last-of-type) { borderBottom: none }` 규칙 회피). */}
                                <Box sx={{mb: 3}}>
                                    <Accordion
                                        variant="outlined"
                                        defaultExpanded={problemList.length === 0}
                                        slotProps={{transition: {unmountOnExit: true}}}
                                    >
                                        <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                                            <Typography variant="body2" sx={{fontWeight: 600}}>
                                                스케줄러 목록 ({normalList.length})
                                            </Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Grid container spacing={2}>
                                                {normalList.map((c) => renderCard(c.info))}
                                            </Grid>
                                        </AccordionDetails>
                                    </Accordion>
                                </Box>
                            </>
                        );
                    })()}

                    <Typography variant="subtitle2" sx={{mb: 1, color: 'text.secondary', fontWeight: 600}}>
                        실행 이력
                    </Typography>
                    <DataGrid
                        rows={logs}
                        columns={logColumns}
                        loading={loading}
                        paginationMode="server"
                        rowCount={logsTotal}
                        paginationModel={{page: logsPage, pageSize: logsSize}}
                        onPaginationModelChange={(m) => {setLogsPage(m.page); setLogsSize(m.pageSize);}}
                        pageSizeOptions={[10, 20, 50, 100]}
                        disableRowSelectionOnClick
                        autoHeight
                        onRowClick={(p) => openAck(p.row as SchedulerLogRes)}
                        sx={{'& .MuiDataGrid-row': {cursor: 'pointer'}}}
                        slotProps={{loadingOverlay: {variant: 'skeleton', noRowsVariant: 'skeleton'}}}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 3}}>
                        분 단위 스케줄러(FAST)는 실패 시에만 이력에 기록됩니다. 정상 실행 여부는 상단 카드를 참조하세요.
                    </Typography>
                </Box>
            )}

            {/* Tab 2: 설정 변경 이력 */}
            {tab === 'config' && (
                <Box>
                    <DataGrid
                        rows={configLogs}
                        columns={configLogColumns}
                        loading={loading}
                        paginationMode="server"
                        rowCount={configLogsTotal}
                        paginationModel={{page: configLogsPage, pageSize: configLogsSize}}
                        onPaginationModelChange={(m) => {setConfigLogsPage(m.page); setConfigLogsSize(m.pageSize);}}
                        pageSizeOptions={[10, 20, 50, 100]}
                        disableRowSelectionOnClick
                        autoHeight
                        slotProps={{loadingOverlay: {variant: 'skeleton', noRowsVariant: 'skeleton'}}}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 3}}>
                        스케줄러 timeout 등 설정 변경 이력입니다. 의도하지 않은 변경이 발견되면 즉시 확인이 필요합니다.
                    </Typography>
                </Box>
            )}

            {/* Tab 2: Redis */}
            {tab === 'redis' && (
                <DataGrid
                    rows={redisRows}
                    columns={redisColumns}
                    loading={loading}
                    pageSizeOptions={[10, 20, 50, 100]}
                    initialState={{pagination: {paginationModel: {pageSize: 20}}}}
                    disableRowSelectionOnClick
                    autoHeight
                    slotProps={{loadingOverlay: {variant: 'skeleton', noRowsVariant: 'skeleton'}}}
                />
            )}

            {/* Tab 3: 에러 로그 */}
            {tab === 'error' && (
                <Box>
                    <DataGrid
                        rows={errorLogs}
                        columns={errorColumns}
                        loading={loading}
                        paginationMode="server"
                        rowCount={errorLogsTotal}
                        paginationModel={{page: errorLogsPage, pageSize: errorLogsSize}}
                        onPaginationModelChange={(m) => {setErrorLogsPage(m.page); setErrorLogsSize(m.pageSize);}}
                        pageSizeOptions={[10, 20, 50, 100]}
                        disableRowSelectionOnClick
                        autoHeight
                        onRowClick={(p) => openErrorAck(p.row as ErrorLogRes)}
                        sx={{'& .MuiDataGrid-row': {cursor: 'pointer'}}}
                        slotProps={{loadingOverlay: {variant: 'skeleton', noRowsVariant: 'skeleton'}}}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 3}}>
                        ERROR 레벨 로그는 DB에 90일 보관됩니다. 서버 장애 대비로 파일(<code>logs/investfeed-error.log</code>)에도 동일한 내용이 저장됩니다.
                    </Typography>
                </Box>
            )}

            {/* Tab 4: 시스템 */}
            {tab === 'system' && (
                <Grid container spacing={2}>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">DB</Typography>
                                <Typography variant="h6" sx={{mt: 1}}
                                    color={systemStatus?.dbStatus === 'UP' ? 'text.primary' : 'error.main'}>
                                    {loading ? <Skeleton width={80}/> :
                                        (systemStatus?.dbStatus === 'UP' ? '연결' : '연결 끊김')}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">Redis</Typography>
                                <Typography variant="h6" sx={{mt: 1}}
                                    color={systemStatus?.redisStatus === 'UP' ? 'text.primary' : 'error.main'}>
                                    {loading ? <Skeleton width={80}/> :
                                        (systemStatus?.redisStatus === 'UP' ? '연결' : '연결 끊김')}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">Heap</Typography>
                                <Typography variant="h6" sx={{mt: 1}}>
                                    {loading ? <Skeleton width={120}/> :
                                        `${systemStatus?.heapUsedMb ?? 0} / ${systemStatus?.heapMaxMb ?? 0} MB (${systemStatus?.heapUsagePercent ?? 0}%)`}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">서버 가동 시간</Typography>
                                <Typography variant="h6" sx={{mt: 1}}>
                                    {loading ? <Skeleton width={120}/> : formatUptime(systemStatus?.uptimeSec ?? 0)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">JVM Threads</Typography>
                                <Typography variant="h6" sx={{mt: 1}}>
                                    {loading ? <Skeleton width={60}/> : `${systemStatus?.jvmThreads ?? 0}개`}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">Tomcat HTTP 풀</Typography>
                                <Typography variant="h6" sx={{mt: 1}}>
                                    {loading ? <Skeleton width={120}/> :
                                        (systemStatus && systemStatus.tomcatMax > 0
                                            ? `사용 중 ${systemStatus.tomcatActive} / 최대 ${systemStatus.tomcatMax}`
                                            : '-')}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">fastScheduler 풀</Typography>
                                <Typography variant="h6" sx={{mt: 1}}>
                                    {loading ? <Skeleton width={120}/> :
                                        `사용 중 ${systemStatus?.fastSchedulerActive ?? 0} / 최대 ${systemStatus?.fastSchedulerMax ?? 0}`}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{xs: 12, sm: 6, md: 3}}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">slowScheduler 풀</Typography>
                                <Typography variant="h6" sx={{mt: 1}}>
                                    {loading ? <Skeleton width={120}/> :
                                        `사용 중 ${systemStatus?.slowSchedulerActive ?? 0} / 최대 ${systemStatus?.slowSchedulerMax ?? 0}`}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={() => setMenuAnchorEl(null)}
            >
                {menuTarget && (
                    <MenuItem onClick={() => { openEdit(menuTarget); setMenuAnchorEl(null); }}>
                        <ListItemIcon><EditIcon fontSize="small"/></ListItemIcon>
                        <ListItemText>Timeout 수정</ListItemText>
                    </MenuItem>
                )}
                {menuTarget && menuTarget.schedulerType === 'SLOW' && (
                    <MenuItem onClick={() => { openTrigger(menuTarget); setMenuAnchorEl(null); }}>
                        <ListItemIcon><PlayArrowIcon fontSize="small" color="primary"/></ListItemIcon>
                        <ListItemText>지금 실행</ListItemText>
                    </MenuItem>
                )}
            </Menu>

            <Dialog open={!!errorAckTarget} onClose={closeErrorAck} maxWidth="md" fullWidth>
                <DialogTitle>에러 로그 상세</DialogTitle>
                <DialogContent>
                    {errorAckTarget && (
                        <>
                            <Box sx={{mb: 2}}>
                                <Typography variant="caption" color="text.secondary" display="block">Logger</Typography>
                                <Typography variant="body2" sx={{mb: 1, fontWeight: 600, wordBreak: 'break-all'}}>{errorAckTarget.loggerName}</Typography>

                                <Typography variant="caption" color="text.secondary" display="block">발생 시각</Typography>
                                <Typography variant="body2" sx={{mb: 1}}>{formatDateTime(errorAckTarget.occurredAt)}</Typography>

                                {errorAckTarget.threadName && (
                                    <>
                                        <Typography variant="caption" color="text.secondary" display="block">Thread</Typography>
                                        <Typography variant="body2" sx={{mb: 1}}>{errorAckTarget.threadName}</Typography>
                                    </>
                                )}

                                {errorAckTarget.message && (
                                    <>
                                        <Typography variant="caption" color="text.secondary" display="block">메시지</Typography>
                                        <Box sx={{p: 1, bgcolor: 'grey.100', borderRadius: 1, mb: 1}}>
                                            <Typography variant="caption" component="pre" color="error.main" sx={{fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', m: 0}}>
                                                {errorAckTarget.message}
                                            </Typography>
                                        </Box>
                                    </>
                                )}

                                {errorAckTarget.stackTrace && (
                                    <>
                                        <Typography variant="caption" color="text.secondary" display="block">Stack Trace</Typography>
                                        <Box sx={{p: 1, bgcolor: 'grey.100', borderRadius: 1, maxHeight: 200, overflow: 'auto'}}>
                                            <Typography variant="caption" component="pre" sx={{fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'pre-wrap', m: 0}}>
                                                {errorAckTarget.stackTrace}
                                            </Typography>
                                        </Box>
                                    </>
                                )}
                            </Box>

                            <Box sx={{pt: 2, borderTop: 1, borderColor: 'divider'}}>
                                {errorAckTarget.acknowledged ? (
                                    <>
                                        <Stack direction="row" sx={{alignItems: 'center', mb: 1}}>
                                            <Typography variant="subtitle2" sx={{color: 'success.main', fontWeight: 600}}>
                                                ✓ 확인됨
                                            </Typography>
                                            <Box sx={{flex: 1}}/>
                                            {!errorAckEditing && (
                                                <Button size="small" onClick={() => setErrorAckEditing(true)} sx={{fontSize: '0.75rem'}}>
                                                    사유 수정
                                                </Button>
                                            )}
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary" display="block">확인자</Typography>
                                        <Typography variant="body2" sx={{mb: 1}}>{errorAckTarget.acknowledgedByName ?? `id:${errorAckTarget.acknowledgedBy}`}</Typography>

                                        <Typography variant="caption" color="text.secondary" display="block">확인 시각</Typography>
                                        <Typography variant="body2" sx={{mb: 1}}>{formatDateTime(errorAckTarget.acknowledgedAt)}</Typography>

                                        <Typography variant="caption" color="text.secondary" display="block">사유</Typography>
                                        {errorAckEditing ? (
                                            <TextField
                                                size="small"
                                                fullWidth
                                                value={errorAckNote}
                                                onChange={(e) => setErrorAckNote(e.target.value)}
                                                inputProps={{maxLength: 500}}
                                                sx={{mt: 0.5}}
                                            />
                                        ) : (
                                            <Typography variant="body2" sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>
                                                {errorAckTarget.acknowledgeNote || '(없음)'}
                                            </Typography>
                                        )}

                                        {errorAckHistory.length > 0 && (
                                            <Box sx={{mt: 2}}>
                                                <Button
                                                    size="small"
                                                    onClick={() => setErrorAckHistoryOpen(v => !v)}
                                                    sx={{fontSize: '0.75rem', p: 0, minWidth: 0}}
                                                >
                                                    {errorAckHistoryOpen ? '▼' : '▶'} 수정 이력 ({errorAckHistory.length}건)
                                                </Button>
                                                {errorAckHistoryOpen && (
                                                    <Box sx={{mt: 1, pl: 1, borderLeft: 2, borderColor: 'divider'}}>
                                                        {errorAckHistory.map(h => (
                                                            <Box key={h.id} sx={{mb: 1.5}}>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {formatDateTime(h.actedAt)} · {h.actedByName ?? `id:${h.actedBy}`} · {' '}
                                                                    <b>{h.action === 'ACKNOWLEDGE' ? '확인 처리' : h.action === 'EDIT_NOTE' ? '사유 수정' : '확인 취소'}</b>
                                                                </Typography>
                                                                {h.action === 'EDIT_NOTE' && (
                                                                    <>
                                                                        <Typography variant="caption" color="text.disabled" display="block" sx={{fontSize: '0.7rem'}}>
                                                                            이전: {h.oldNote || '(없음)'}
                                                                        </Typography>
                                                                        <Typography variant="caption" display="block" sx={{fontSize: '0.7rem'}}>
                                                                            이후: {h.newNote || '(없음)'}
                                                                        </Typography>
                                                                    </>
                                                                )}
                                                                {h.action === 'ACKNOWLEDGE' && h.newNote && (
                                                                    <Typography variant="caption" display="block" sx={{fontSize: '0.7rem'}}>
                                                                        사유: {h.newNote}
                                                                    </Typography>
                                                                )}
                                                                {h.action === 'CANCEL' && h.oldNote && (
                                                                    <Typography variant="caption" color="text.disabled" display="block" sx={{fontSize: '0.7rem'}}>
                                                                        취소 전 사유: {h.oldNote}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                )}
                                            </Box>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Typography variant="subtitle2" sx={{mb: 1, fontWeight: 600}}>확인 처리</Typography>
                                        <TextField
                                            label="확인 사유 (선택)"
                                            size="small"
                                            fullWidth
                                            value={errorAckNote}
                                            onChange={(e) => setErrorAckNote(e.target.value)}
                                            inputProps={{maxLength: 500}}
                                        />
                                    </>
                                )}
                            </Box>
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    {errorAckTarget && errorAckTarget.acknowledged && (
                        <Button
                            onClick={cancelErrorAck}
                            disabled={errorAckSaving}
                            variant="text"
                            sx={{color: 'error.main'}}
                        >
                            확인 취소
                        </Button>
                    )}
                    <Box sx={{flex: 1}}/>
                    <Button onClick={closeErrorAck} disabled={errorAckSaving}>닫기</Button>
                    {errorAckTarget && !errorAckTarget.acknowledged && (
                        <Button onClick={saveErrorAck} disabled={errorAckSaving} variant="contained">확인</Button>
                    )}
                    {errorAckTarget && errorAckTarget.acknowledged && errorAckEditing && (
                        <Button onClick={saveErrorAck} disabled={errorAckSaving} variant="contained">저장</Button>
                    )}
                </DialogActions>
            </Dialog>

            <Dialog open={!!triggerTarget} onClose={closeTrigger} maxWidth="xs" fullWidth>
                <DialogTitle>스케줄러 수동 실행</DialogTitle>
                <DialogContent>
                    {triggerTarget && (
                        <Typography variant="body2">
                            <b>{triggerTarget.schedulerName}</b> 를 지금 즉시 실행합니다.
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeTrigger} disabled={triggering}>취소</Button>
                    <Button onClick={confirmTrigger} disabled={triggering} variant="contained" color="primary">실행</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!ackTarget} onClose={closeAck} maxWidth="sm" fullWidth>
                <DialogTitle>실행 이력 상세</DialogTitle>
                <DialogContent>
                    {ackTarget && (
                        <>
                            {/* 원본 정보 */}
                            <Box sx={{mb: 2}}>
                                <Typography variant="caption" color="text.secondary" display="block">스케줄러</Typography>
                                <Typography variant="body2" sx={{mb: 1, fontWeight: 600}}>{ackTarget.schedulerName}</Typography>

                                <Typography variant="caption" color="text.secondary" display="block">발생 시각</Typography>
                                <Typography variant="body2" sx={{mb: 1}}>{formatDateTime(ackTarget.startedAt)}</Typography>

                                <Typography variant="caption" color="text.secondary" display="block">상태</Typography>
                                <Box sx={{mb: 1}}>
                                    <Chip
                                        label={ackTarget.status}
                                        size="small"
                                        color={ackTarget.status === 'SUCCESS' ? 'success' : ackTarget.status === 'INTERRUPTED' ? 'warning' : 'error'}
                                        variant="outlined"
                                    />
                                </Box>

                                {ackTarget.durationMs != null && (
                                    <>
                                        <Typography variant="caption" color="text.secondary" display="block">소요시간</Typography>
                                        <Typography variant="body2" sx={{mb: 1}}>{ackTarget.durationMs.toLocaleString()}ms</Typography>
                                    </>
                                )}

                                {ackTarget.errorMessage && (
                                    <>
                                        <Typography variant="caption" color="text.secondary" display="block">에러 메시지</Typography>
                                        <Box sx={{p: 1, bgcolor: 'grey.100', borderRadius: 1, mb: 1}}>
                                            <Typography variant="caption" component="pre" color="error.main" sx={{fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', m: 0}}>
                                                {ackTarget.errorMessage}
                                            </Typography>
                                        </Box>
                                    </>
                                )}
                            </Box>

                            {/* 확인 처리 섹션 */}
                            {ackTarget.status !== 'SUCCESS' && (
                                <Box sx={{pt: 2, borderTop: 1, borderColor: 'divider'}}>
                                    {ackTarget.acknowledged ? (
                                        <>
                                            <Stack direction="row" sx={{alignItems: 'center', mb: 1}}>
                                                <Typography variant="subtitle2" sx={{color: 'success.main', fontWeight: 600}}>
                                                    ✓ 확인됨
                                                </Typography>
                                                <Box sx={{flex: 1}}/>
                                                {!ackEditing && (
                                                    <Button size="small" onClick={() => setAckEditing(true)} sx={{fontSize: '0.75rem'}}>
                                                        사유 수정
                                                    </Button>
                                                )}
                                            </Stack>
                                            <Typography variant="caption" color="text.secondary" display="block">확인자</Typography>
                                            <Typography variant="body2" sx={{mb: 1}}>{ackTarget.acknowledgedByName ?? `id:${ackTarget.acknowledgedBy}`}</Typography>

                                            <Typography variant="caption" color="text.secondary" display="block">확인 시각</Typography>
                                            <Typography variant="body2" sx={{mb: 1}}>{formatDateTime(ackTarget.acknowledgedAt)}</Typography>

                                            <Typography variant="caption" color="text.secondary" display="block">사유</Typography>
                                            {ackEditing ? (
                                                <TextField
                                                    size="small"
                                                    fullWidth
                                                    value={ackNote}
                                                    onChange={(e) => setAckNote(e.target.value)}
                                                    inputProps={{maxLength: 500}}
                                                    sx={{mt: 0.5}}
                                                />
                                            ) : (
                                                <Typography variant="body2" sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>
                                                    {ackTarget.acknowledgeNote || '(없음)'}
                                                </Typography>
                                            )}

                                            {ackHistory.length > 0 && (
                                                <Box sx={{mt: 2}}>
                                                    <Button
                                                        size="small"
                                                        onClick={() => setAckHistoryOpen(v => !v)}
                                                        sx={{fontSize: '0.75rem', p: 0, minWidth: 0}}
                                                    >
                                                        {ackHistoryOpen ? '▼' : '▶'} 수정 이력 ({ackHistory.length}건)
                                                    </Button>
                                                    {ackHistoryOpen && (
                                                        <Box sx={{mt: 1, pl: 1, borderLeft: 2, borderColor: 'divider'}}>
                                                            {ackHistory.map(h => (
                                                                <Box key={h.id} sx={{mb: 1.5}}>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {formatDateTime(h.actedAt)} · {h.actedByName ?? `id:${h.actedBy}`} · {' '}
                                                                        <b>{h.action === 'ACKNOWLEDGE' ? '확인 처리' : h.action === 'EDIT_NOTE' ? '사유 수정' : '확인 취소'}</b>
                                                                    </Typography>
                                                                    {h.action === 'EDIT_NOTE' && (
                                                                        <>
                                                                            <Typography variant="caption" color="text.disabled" display="block" sx={{fontSize: '0.7rem'}}>
                                                                                이전: {h.oldNote || '(없음)'}
                                                                            </Typography>
                                                                            <Typography variant="caption" display="block" sx={{fontSize: '0.7rem'}}>
                                                                                이후: {h.newNote || '(없음)'}
                                                                            </Typography>
                                                                        </>
                                                                    )}
                                                                    {h.action === 'ACKNOWLEDGE' && h.newNote && (
                                                                        <Typography variant="caption" display="block" sx={{fontSize: '0.7rem'}}>
                                                                            사유: {h.newNote}
                                                                        </Typography>
                                                                    )}
                                                                    {h.action === 'CANCEL' && h.oldNote && (
                                                                        <Typography variant="caption" color="text.disabled" display="block" sx={{fontSize: '0.7rem'}}>
                                                                            취소 전 사유: {h.oldNote}
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                            ))}
                                                        </Box>
                                                    )}
                                                </Box>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Typography variant="subtitle2" sx={{mb: 1, fontWeight: 600}}>확인 처리</Typography>
                                            <TextField
                                                label="확인 사유 (선택)"
                                                placeholder="예: 서버 재시작 중 발생으로 정상. 실제 장애 아님"
                                                size="small"
                                                fullWidth
                                                value={ackNote}
                                                onChange={(e) => setAckNote(e.target.value)}
                                                inputProps={{maxLength: 500}}
                                            />
                                        </>
                                    )}
                                </Box>
                            )}
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    {ackTarget && ackTarget.acknowledged && (
                        <Button
                            onClick={cancelAck}
                            disabled={ackSaving}
                            variant="text"
                            sx={{color: 'error.main'}}
                        >
                            확인 취소
                        </Button>
                    )}
                    <Box sx={{flex: 1}}/>
                    <Button onClick={closeAck} disabled={ackSaving}>닫기</Button>
                    {ackTarget && !ackTarget.acknowledged && ackTarget.status !== 'SUCCESS' && (
                        <Button onClick={saveAck} disabled={ackSaving} variant="contained">확인</Button>
                    )}
                    {ackTarget && ackTarget.acknowledged && ackEditing && (
                        <Button onClick={saveAck} disabled={ackSaving} variant="contained">저장</Button>
                    )}
                </DialogActions>
            </Dialog>

            <Dialog open={!!editTarget} onClose={closeEdit} maxWidth="xs" fullWidth>
                <DialogTitle>Timeout 수정 — {editTarget?.schedulerName}</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Timeout (초)"
                        type="number"
                        size="small"
                        fullWidth
                        value={editTimeoutSec}
                        onChange={(e) => setEditTimeoutSec(e.target.value)}
                        inputProps={{min: 1, max: 86400}}
                        sx={{mt: 1}}
                    />
                    <TextField
                        label="변경 사유 (선택)"
                        size="small"
                        fullWidth
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        inputProps={{maxLength: 500}}
                        sx={{mt: 2}}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeEdit} disabled={editSaving}>취소</Button>
                    <Button onClick={saveEdit} disabled={editSaving} variant="contained">저장</Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}
