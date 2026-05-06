import {useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {requireOk} from '../../lib/apiResponse';
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
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {DatePicker} from '@mui/x-date-pickers/DatePicker';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import type {Dayjs} from 'dayjs';
import {SparkLineChart} from '@mui/x-charts/SparkLineChart';
import LinearProgress from '@mui/material/LinearProgress';
import {
    fetchSchedulerOverview,
    fetchConfigLogsOverview,
    fetchRedisOverview,
    fetchErrorLogsOverview,
    fetchApiCallsOverview,
    fetchSystemOverview,
    updateSchedulerTimeout,
    triggerScheduler,
    acknowledgeSchedulerLog,
    cancelAcknowledgeSchedulerLog,
    fetchSchedulerLogAckHistory,
    invalidateRedisPrefix,
    acknowledgeErrorLog,
    cancelAcknowledgeErrorLog,
    fetchErrorLogAckHistory,
    bulkAcknowledgeSchedulerLogs,
    bulkAcknowledgeErrorLogs,
} from '../../api/admin/MonitoringApi';
import FreshnessIndicator from '../../components/FreshnessIndicator';
import type {
    SchedulerCatalogRes,
    SchedulerStatusRes,
    SchedulerLogRes,
    SchedulerConfigLogRes,
    SchedulerState,
    RedisPrefixRes,
    ErrorLogRes,
    SystemStatusRes,
    LogAckHistoryRes,
    UnacknowledgedCountRes,
    ApiCallStatsItemRes,
} from '../../type/MonitoringType';

type TabKey = 'scheduler' | 'config' | 'redis' | 'error' | 'apicall' | 'system';

function formatDateTime(s: string | null): string {
    if (!s) return '-';
    const d = new Date(s);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

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
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<TabKey>('scheduler');
    // 페이지/사이즈 (UI controls)
    const [logsPage, setLogsPage] = useState(0);
    const [logsSize, setLogsSize] = useState(20);
    const [configLogsPage, setConfigLogsPage] = useState(0);
    const [configLogsSize, setConfigLogsSize] = useState(20);
    const [errorLogsPage, setErrorLogsPage] = useState(0);
    const [errorLogsSize, setErrorLogsSize] = useState(50);
    // Dialog 상태
    const [errorAckTarget, setErrorAckTarget] = useState<ErrorLogRes | null>(null);
    const [errorAckNote, setErrorAckNote] = useState('');
    const [errorAckSaving, setErrorAckSaving] = useState(false);
    const [errorAckHistory, setErrorAckHistory] = useState<LogAckHistoryRes[]>([]);
    const [errorAckHistoryOpen, setErrorAckHistoryOpen] = useState(false);
    const [errorAckEditing, setErrorAckEditing] = useState(false);
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
    // 스케줄러 로그 필터 ('' = 전체)
    const [logsSchedulerFilter, setLogsSchedulerFilter] = useState<string>('');
    const [logsStatusFilter, setLogsStatusFilter] = useState<string>('');
    const [logsFromDate, setLogsFromDate] = useState<Dayjs | null>(null);
    const [logsToDate, setLogsToDate] = useState<Dayjs | null>(null);
    // 키워드 입력 — input 은 자유 편집, commit 은 fetch 트리거 (Enter/blur)
    const [logsMessageInput, setLogsMessageInput] = useState<string>('');
    const [logsMessageKeyword, setLogsMessageKeyword] = useState<string>('');
    // 미확인 필터 (탭별)
    const [logsUnackOnly, setLogsUnackOnly] = useState(false);
    const [errorUnackOnly, setErrorUnackOnly] = useState(false);
    // 에러 로그 필터
    const [errorFromDate, setErrorFromDate] = useState<Dayjs | null>(null);
    const [errorToDate, setErrorToDate] = useState<Dayjs | null>(null);
    const [errorMessageInput, setErrorMessageInput] = useState<string>('');
    const [errorMessageKeyword, setErrorMessageKeyword] = useState<string>('');
    // 일괄 확인 처리 다이얼로그
    const [bulkAckTarget, setBulkAckTarget] = useState<'scheduler' | 'error' | null>(null);
    const [bulkAckNote, setBulkAckNote] = useState('');
    const [bulkAckSaving, setBulkAckSaving] = useState(false);

    // ============================================================================
    // 탭별 useQuery — enabled 조건으로 비활성 탭은 폴링 정지 (네비게이션 시 자동 cleanup)
    // 모든 탭의 응답에 unackCount 포함됨 — 활성 탭의 data에서 직접 파생.
    // ============================================================================
    const schedulerQuery = useQuery({
        queryKey: ['monitoring', 'scheduler', logsPage, logsSize,
            logsSchedulerFilter, logsStatusFilter, logsUnackOnly,
            logsFromDate ? logsFromDate.format('YYYY-MM-DD') : null,
            logsToDate ? logsToDate.format('YYYY-MM-DD') : null,
            logsMessageKeyword],
        queryFn: async ({signal}) => requireOk(await fetchSchedulerOverview({
            page: logsPage,
            size: logsSize,
            schedulerName: logsSchedulerFilter || null,
            status: logsStatusFilter || null,
            acknowledged: logsUnackOnly ? false : null,
            fromDate: logsFromDate ? logsFromDate.format('YYYY-MM-DD') : null,
            toDate: logsToDate ? logsToDate.format('YYYY-MM-DD') : null,
            messageKeyword: logsMessageKeyword || null,
        }, {signal, skipGlobalError: true}), null),
        enabled: tab === 'scheduler',
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
    });

    const configQuery = useQuery({
        queryKey: ['monitoring', 'config', configLogsPage, configLogsSize],
        queryFn: async ({signal}) => requireOk(await fetchConfigLogsOverview(
            {page: configLogsPage, size: configLogsSize},
            {signal, skipGlobalError: true},
        ), null),
        enabled: tab === 'config',
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
    });

    const redisQuery = useQuery({
        queryKey: ['monitoring', 'redis'],
        queryFn: async ({signal}) => requireOk(await fetchRedisOverview({signal, skipGlobalError: true}), null),
        enabled: tab === 'redis',
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
    });

    const errorQuery = useQuery({
        queryKey: ['monitoring', 'error', errorLogsPage, errorLogsSize, errorUnackOnly,
            errorFromDate ? errorFromDate.format('YYYY-MM-DD') : null,
            errorToDate ? errorToDate.format('YYYY-MM-DD') : null,
            errorMessageKeyword],
        queryFn: async ({signal}) => requireOk(await fetchErrorLogsOverview({
            page: errorLogsPage,
            size: errorLogsSize,
            acknowledged: errorUnackOnly ? false : null,
            fromDate: errorFromDate ? errorFromDate.format('YYYY-MM-DD') : null,
            toDate: errorToDate ? errorToDate.format('YYYY-MM-DD') : null,
            messageKeyword: errorMessageKeyword || null,
        }, {signal, skipGlobalError: true}), null),
        enabled: tab === 'error',
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
    });

    const apiCallQuery = useQuery({
        queryKey: ['monitoring', 'apicall'],
        queryFn: async ({signal}) => requireOk(await fetchApiCallsOverview({signal, skipGlobalError: true}), null),
        enabled: tab === 'apicall',
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
    });

    const systemQuery = useQuery({
        queryKey: ['monitoring', 'system'],
        queryFn: async ({signal}) => requireOk(await fetchSystemOverview({signal, skipGlobalError: true}), null),
        enabled: tab === 'system',
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
    });

    // 활성 탭 query (loading/lastUpdated/error 파생용)
    const activeQuery = tab === 'scheduler' ? schedulerQuery
        : tab === 'config' ? configQuery
        : tab === 'redis' ? redisQuery
        : tab === 'error' ? errorQuery
        : tab === 'apicall' ? apiCallQuery
        : systemQuery;

    // 탭별 데이터 파생
    const catalog: SchedulerCatalogRes[] = schedulerQuery.data?.catalog ?? [];
    const statuses: SchedulerStatusRes[] = schedulerQuery.data?.statuses ?? [];
    const logs: SchedulerLogRes[] = schedulerQuery.data?.logs?.content ?? [];
    const logsTotal = schedulerQuery.data?.logs?.totalElements ?? 0;
    const configLogs: SchedulerConfigLogRes[] = configQuery.data?.logs?.content ?? [];
    const configLogsTotal = configQuery.data?.logs?.totalElements ?? 0;
    const redisPrefixes: RedisPrefixRes[] = redisQuery.data?.redis?.prefixes ?? [];
    const errorLogs: ErrorLogRes[] = errorQuery.data?.logs?.content ?? [];
    const errorLogsTotal = errorQuery.data?.logs?.totalElements ?? 0;
    const apiCallStats: ApiCallStatsItemRes[] = apiCallQuery.data?.stats?.items ?? [];
    const systemStatus: SystemStatusRes | null = systemQuery.data?.system ?? null;

    // unackCount — 가장 최근 응답한 query 결과에서 (모든 탭 응답에 포함)
    const unackCount: UnacknowledgedCountRes =
        activeQuery.data?.unackCount
        ?? schedulerQuery.data?.unackCount
        ?? configQuery.data?.unackCount
        ?? redisQuery.data?.unackCount
        ?? errorQuery.data?.unackCount
        ?? apiCallQuery.data?.unackCount
        ?? systemQuery.data?.unackCount
        ?? {schedulerLogs: 0, errorLogs: 0};

    const loading = activeQuery.isLoading;
    const lastUpdated = activeQuery.dataUpdatedAt ? new Date(activeQuery.dataUpdatedAt) : null;
    const pollError = !!activeQuery.error;

    /** 활성 탭의 query 무효화 → 즉시 refetch 트리거. mutation 후 호출. */
    const reloadCurrentTab = () => {
        queryClient.invalidateQueries({queryKey: ['monitoring', tab]});
    };

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
            setTimeout(reloadCurrentTab, 1500);
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
            if (res.code !== "0000") throw new Error(res.message || `에러 로그 확인 이력 조회 실패 (${res.code})`);
            setErrorAckHistory(res.result ?? []);
        } catch (error) {
            console.error(error);
        }
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
            if (res.code !== "0000") throw new Error(res.message || `에러 로그 확인 저장 실패 (${res.code})`);
            if (res.result) {
                setErrorAckTarget(res.result);
                setErrorAckEditing(false);
                // 이력 재조회
                const h = await fetchErrorLogAckHistory(res.result.id);
                if (h.code !== "0000") throw new Error(h.message || `에러 로그 확인 이력 조회 실패 (${h.code})`);
                setErrorAckHistory(h.result ?? []);
            }
            reloadCurrentTab();
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
            if (res.code !== "0000") throw new Error(res.message || `에러 로그 확인 취소 실패 (${res.code})`);
            if (res.result) {
                setErrorAckTarget(res.result);
                setErrorAckNote('');
                setErrorAckEditing(false);
                const h = await fetchErrorLogAckHistory(res.result.id);
                if (h.code !== "0000") throw new Error(h.message || `에러 로그 확인 이력 조회 실패 (${h.code})`);
                setErrorAckHistory(h.result ?? []);
            }
            reloadCurrentTab();
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
            if (res.code !== "0000") throw new Error(res.message || `스케줄러 로그 확인 이력 조회 실패 (${res.code})`);
            setAckHistory(res.result ?? []);
        } catch (error) {
            console.error(error);
            /* 이력 조회 실패해도 다이얼로그는 열림 */
        }
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
            if (res.code !== "0000") throw new Error(res.message || `스케줄러 로그 확인 저장 실패 (${res.code})`);
            if (res.result) {
                setAckTarget(res.result);
                setAckEditing(false);
                const h = await fetchSchedulerLogAckHistory(res.result.id);
                if (h.code !== "0000") throw new Error(h.message || `스케줄러 로그 확인 이력 조회 실패 (${h.code})`);
                setAckHistory(h.result ?? []);
            }
            reloadCurrentTab();
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
            if (res.code !== "0000") throw new Error(res.message || `스케줄러 로그 확인 취소 실패 (${res.code})`);
            if (res.result) {
                setAckTarget(res.result);
                setAckNote('');
                setAckEditing(false);
                const h = await fetchSchedulerLogAckHistory(res.result.id);
                if (h.code !== "0000") throw new Error(h.message || `스케줄러 로그 확인 이력 조회 실패 (${h.code})`);
                setAckHistory(h.result ?? []);
            }
            reloadCurrentTab();
        } catch (e) {
            console.error('스케줄러 로그 확인 취소 실패', e);
        } finally {
            setAckSaving(false);
        }
    };

    const openBulkAck = async (target: 'scheduler' | 'error') => {
        try {
            reloadCurrentTab();
        } catch (e) {
            console.error(e);
        }
        setBulkAckTarget(target);
        setBulkAckNote('');
    };
    const closeBulkAck = () => {
        if (bulkAckSaving) return;
        setBulkAckTarget(null);
    };
    const confirmBulkAck = async () => {
        if (!bulkAckTarget) return;
        setBulkAckSaving(true);
        try {
            const note = bulkAckNote.trim() || null;
            if (bulkAckTarget === 'scheduler') {
                await bulkAcknowledgeSchedulerLogs({note});
            } else {
                await bulkAcknowledgeErrorLogs({note});
            }
            setBulkAckTarget(null);
            reloadCurrentTab();
        } catch (e) {
            console.error('일괄 확인 처리 실패', e);
        } finally {
            setBulkAckSaving(false);
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
            reloadCurrentTab();
        } catch (e) {
            console.error('timeout 수정 실패', e);
        } finally {
            setEditSaving(false);
        }
    };

    const handleInvalidate = async (prefix: string) => {
        try {
            await invalidateRedisPrefix(prefix);
            reloadCurrentTab();
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

    const commitLogsKeyword = () => {
        if (logsMessageInput !== logsMessageKeyword) {
            setLogsMessageKeyword(logsMessageInput);
            setLogsPage(0);
        }
    };
    const commitErrorKeyword = () => {
        if (errorMessageInput !== errorMessageKeyword) {
            setErrorMessageKeyword(errorMessageInput);
            setErrorLogsPage(0);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{
            width: '100%',
            maxWidth: {sm: '100%', md: '1700px'},
            '& .MuiInputAdornment-root .MuiIconButton-root': {
                padding: '4px',
                border: 'none',
                backgroundColor: 'transparent',
                '& .MuiSvgIcon-root': { fontSize: '1.1rem' },
                '&:hover': {
                    border: 'none',
                    backgroundColor: 'transparent',
                },
                '&:focus, &:focus-visible, &.Mui-focusVisible': {
                    outline: 'none',
                    boxShadow: 'none',
                    backgroundColor: 'transparent',
                },
            },
        }}>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 1}}>
                <Typography component="h2" variant="h6">
                    모니터링
                </Typography>
                <Box sx={{flex: 1}}/>
                {!loading && <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>}
            </Box>

            {!loading && (
                <Stack direction="row" spacing={2} sx={{mb: 2, alignItems: 'center'}}>
                    <Typography variant="caption" sx={{color: 'text.secondary', fontWeight: 600}}>미확인:</Typography>
                    <Chip
                        label={`스케줄러 ${unackCount.schedulerLogs}건`}
                        size="small"
                        color={unackCount.schedulerLogs > 0 ? 'warning' : 'default'}
                        variant={unackCount.schedulerLogs > 0 ? 'filled' : 'outlined'}
                        onClick={() => setTab('scheduler')}
                        sx={{cursor: 'pointer'}}
                    />
                    <Chip
                        label={`에러 ${unackCount.errorLogs}건`}
                        size="small"
                        color={unackCount.errorLogs > 0 ? 'error' : 'default'}
                        variant={unackCount.errorLogs > 0 ? 'filled' : 'outlined'}
                        onClick={() => setTab('error')}
                        sx={{cursor: 'pointer'}}
                    />
                </Stack>
            )}

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{mb: 2, borderBottom: 1, borderColor: 'divider'}}>
                <Tab label="스케줄러" value="scheduler"/>
                <Tab label="설정 변경 이력" value="config"/>
                <Tab label="Redis" value="redis"/>
                <Tab label="에러 로그" value="error"/>
                <Tab label="외부 API" value="apicall"/>
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
                        const renderCard = (info: SchedulerCatalogRes) => {
                            const s = statuses.find((x) => x.schedulerName === info.schedulerName);
                            const state: SchedulerState = s?.state ?? 'PENDING';
                            const meta = STATE_META[state];
                            return (
                                <Grid key={info.schedulerName} size={{xs: 12, sm: 6, md: 4}} sx={{display: 'flex'}}>
                                    <Card variant="outlined" sx={{opacity: s ? 1 : 0.65, width: '100%', display: 'flex', flexDirection: 'column'}}>
                                        <CardContent sx={{flex: 1, display: 'flex', flexDirection: 'column'}}>
                                            <Stack direction="row" sx={{alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap'}}>
                                                <Tooltip title={meta.label} placement="top" arrow>
                                                    <Box sx={{width: 10, height: 10, borderRadius: '50%', bgcolor: meta.color, flexShrink: 0}}/>
                                                </Tooltip>
                                                <Typography variant="body2" sx={{fontWeight: 600}}>{info.schedulerName}</Typography>
                                                <Chip label={info.schedulerType} size="small"
                                                    color={info.schedulerType === 'FAST' ? 'info' : 'default'} variant="outlined"
                                                    sx={{fontSize: '0.65rem', height: 18}}/>
                                                <Chip label={info.label} size="small" variant="outlined"
                                                    sx={{fontSize: '0.65rem', height: 18}}/>
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
                        const catalogWithState = catalog.map((info) => {
                            const s = statuses.find((x) => x.schedulerName === info.schedulerName);
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
                                <Stack direction="row" spacing={0.75} sx={{alignItems: 'center', opacity: count === 0 ? 0.4 : 1}}>
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

                    <Stack direction="row" sx={{alignItems: 'center', mb: 1}}>
                        <Typography variant="subtitle2" sx={{color: 'text.secondary', fontWeight: 600}}>
                            실행 이력
                        </Typography>
                        <Box sx={{flex: 1}}/>
                        <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            disabled={unackCount.schedulerLogs === 0}
                            onClick={() => openBulkAck('scheduler')}
                        >
                            일괄 확인
                        </Button>
                    </Stack>
                    <Stack direction="row" sx={{alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap'}}>
                        <DatePicker
                            label="시작일"
                            value={logsFromDate}
                            onChange={(v) => { setLogsFromDate(v); setLogsPage(0); }}
                            format="YYYY-MM-DD"
                            slotProps={{textField: {size: 'small', sx: {width: 180}}, field: {clearable: true}}}
                        />
                        <DatePicker
                            label="종료일"
                            value={logsToDate}
                            onChange={(v) => { setLogsToDate(v); setLogsPage(0); }}
                            format="YYYY-MM-DD"
                            slotProps={{textField: {size: 'small', sx: {width: 180}}, field: {clearable: true}}}
                        />
                        <TextField
                            size="small"
                            label="메시지 키워드"
                            placeholder="Enter 또는 포커스 해제 시 검색"
                            value={logsMessageInput}
                            onChange={(e) => setLogsMessageInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitLogsKeyword(); }}
                            onBlur={commitLogsKeyword}
                            inputProps={{maxLength: 200}}
                            sx={{minWidth: 200}}
                        />
                        <TextField
                            select
                            size="small"
                            label="스케줄러"
                            value={logsSchedulerFilter}
                            onChange={(e) => { setLogsSchedulerFilter(e.target.value); setLogsPage(0); }}
                            sx={{minWidth: 200}}
                        >
                            <MenuItem value="">전체</MenuItem>
                            {catalog.map((c) => (
                                <MenuItem key={c.schedulerName} value={c.schedulerName}>{c.schedulerName}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            size="small"
                            label="상태"
                            value={logsStatusFilter}
                            onChange={(e) => { setLogsStatusFilter(e.target.value); setLogsPage(0); }}
                            sx={{minWidth: 130}}
                        >
                            <MenuItem value="">전체</MenuItem>
                            <MenuItem value="SUCCESS">SUCCESS</MenuItem>
                            <MenuItem value="FAILED">FAILED</MenuItem>
                            <MenuItem value="INTERRUPTED">INTERRUPTED</MenuItem>
                        </TextField>
                        <FormControlLabel
                            control={<Checkbox
                                size="small"
                                checked={logsUnackOnly}
                                onChange={(e) => { setLogsUnackOnly(e.target.checked); setLogsPage(0); }}
                            />}
                            label={<Typography variant="caption">미확인만 보기</Typography>}
                            sx={{mr: 0}}
                        />
                    </Stack>
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
                    <Stack direction="row" sx={{alignItems: 'center', mb: 1}}>
                        <Box sx={{flex: 1}}/>
                        <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={unackCount.errorLogs === 0}
                            onClick={() => openBulkAck('error')}
                        >
                            일괄 확인
                        </Button>
                    </Stack>
                    <Stack direction="row" sx={{alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap'}}>
                        <DatePicker
                            label="시작일"
                            value={errorFromDate}
                            onChange={(v) => { setErrorFromDate(v); setErrorLogsPage(0); }}
                            format="YYYY-MM-DD"
                            slotProps={{textField: {size: 'small', sx: {width: 180}}, field: {clearable: true}}}
                        />
                        <DatePicker
                            label="종료일"
                            value={errorToDate}
                            onChange={(v) => { setErrorToDate(v); setErrorLogsPage(0); }}
                            format="YYYY-MM-DD"
                            slotProps={{textField: {size: 'small', sx: {width: 180}}, field: {clearable: true}}}
                        />
                        <TextField
                            size="small"
                            label="메시지 키워드"
                            placeholder="Enter 또는 포커스 해제 시 검색"
                            value={errorMessageInput}
                            onChange={(e) => setErrorMessageInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitErrorKeyword(); }}
                            onBlur={commitErrorKeyword}
                            inputProps={{maxLength: 200}}
                            sx={{minWidth: 200}}
                        />
                        <FormControlLabel
                            control={<Checkbox
                                size="small"
                                checked={errorUnackOnly}
                                onChange={(e) => { setErrorUnackOnly(e.target.checked); setErrorLogsPage(0); }}
                            />}
                            label={<Typography variant="caption">미확인만 보기</Typography>}
                            sx={{mr: 0}}
                        />
                    </Stack>
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

            {/* Tab 4: 외부 API */}
            {tab === 'apicall' && (
                <Box>
                    <DataGrid
                        rows={apiCallStats.map((item) => ({id: item.provider, ...item}))}
                        columns={[
                            {field: 'label', headerName: 'Provider', width: 160},
                            {
                                field: 'recent7Days',
                                headerName: '7일 추세',
                                width: 180,
                                sortable: false,
                                renderCell: (p) => {
                                    const data = (p.value as ApiCallStatsItemRes['recent7Days']).map((d) => d.count);
                                    return (
                                        <Box sx={{width: '100%', height: '100%', display: 'flex', alignItems: 'center'}}>
                                            <SparkLineChart
                                                data={data}
                                                height={36}
                                                width={160}
                                                showHighlight
                                                showTooltip
                                                xAxis={{
                                                    data: (p.row as ApiCallStatsItemRes).recent7Days.map((d) => d.date),
                                                    scaleType: 'point',
                                                }}
                                            />
                                        </Box>
                                    );
                                },
                            },
                            {
                                field: 'usageRatio',
                                headerName: '사용률',
                                flex: 1,
                                minWidth: 240,
                                sortable: false,
                                renderCell: (p) => {
                                    const ratio = p.value as number | null;
                                    if (ratio == null) {
                                        // 한도 미지정 — 빈 회색 bar + "-" 로 row 시각 리듬 유지
                                        return (
                                            <Box sx={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 1}}>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={0}
                                                    sx={{
                                                        flex: 1,
                                                        height: 6,
                                                        borderRadius: 3,
                                                        backgroundColor: 'action.disabledBackground',
                                                        '& .MuiLinearProgress-bar': {backgroundColor: 'transparent'},
                                                    }}
                                                />
                                                <Typography variant="caption" color="text.disabled" sx={{minWidth: 40, textAlign: 'right'}}>
                                                    -
                                                </Typography>
                                            </Box>
                                        );
                                    }
                                    const pct = Math.min(ratio * 100, 100);
                                    const color = ratio >= 0.8 ? 'error' : ratio >= 0.5 ? 'warning' : 'primary';
                                    return (
                                        <Box sx={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 1}}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={pct}
                                                color={color}
                                                sx={{flex: 1, height: 6, borderRadius: 3}}
                                            />
                                            <Typography variant="caption" sx={{minWidth: 40, textAlign: 'right'}}>
                                                {(ratio * 100).toFixed(1)}%
                                            </Typography>
                                        </Box>
                                    );
                                },
                            },
                            {
                                field: 'todayCount',
                                headerName: '오늘 호출',
                                width: 110,
                                type: 'number',
                                valueFormatter: (v: number) => v?.toLocaleString() ?? '0',
                            },
                            {
                                field: 'dailyLimit',
                                headerName: '일간 한도',
                                width: 110,
                                type: 'number',
                                valueFormatter: (v: number | null) => v == null ? '-' : v.toLocaleString(),
                            },
                        ]}
                        loading={loading}
                        disableRowSelectionOnClick
                        autoHeight
                        hideFooter
                        rowHeight={56}
                        slotProps={{loadingOverlay: {variant: 'skeleton', noRowsVariant: 'skeleton'}}}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 3}}>
                        최근 7일 일별 호출 추세를 표시합니다. 한도가 명시되지 않은 API 도 호출 폭증 감지를 위해 sparkline 은 항상 노출됩니다.
                    </Typography>
                </Box>
            )}

            {/* Tab 5: 시스템 */}
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
                                        <Box sx={{p: 1, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100', borderRadius: 1, mb: 1}}>
                                            <Typography variant="caption" component="pre" color="error.main" sx={{fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', m: 0}}>
                                                {errorAckTarget.message}
                                            </Typography>
                                        </Box>
                                    </>
                                )}

                                {errorAckTarget.stackTrace && (
                                    <>
                                        <Typography variant="caption" color="text.secondary" display="block">Stack Trace</Typography>
                                        <Box sx={{p: 1, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100', borderRadius: 1, maxHeight: 200, overflow: 'auto'}}>
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
                                        <Box sx={{p: 1, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100', borderRadius: 1, mb: 1}}>
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

            <Dialog open={bulkAckTarget !== null} onClose={closeBulkAck} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {bulkAckTarget === 'scheduler' ? '스케줄러 로그 일괄 확인' : '에러 로그 일괄 확인'}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{mb: 2}}>
                        전체 미확인 <b>{bulkAckTarget === 'scheduler' ? unackCount.schedulerLogs : unackCount.errorLogs}건</b>을 일괄 확인합니다.
                    </Typography>
                    <TextField
                        label="사유 (선택)"
                        placeholder="비워두면 '일괄 확인'으로 기록됩니다"
                        size="small"
                        fullWidth
                        value={bulkAckNote}
                        onChange={(e) => setBulkAckNote(e.target.value)}
                        inputProps={{maxLength: 500}}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeBulkAck} disabled={bulkAckSaving}>취소</Button>
                    <Button
                        onClick={confirmBulkAck}
                        disabled={bulkAckSaving || (bulkAckTarget === 'scheduler' ? unackCount.schedulerLogs === 0 : unackCount.errorLogs === 0)}
                        variant="contained"
                    >
                        처리
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
        </LocalizationProvider>
    );
}
