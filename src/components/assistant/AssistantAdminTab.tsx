import {useMemo, useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {BarChart} from '@mui/x-charts';
import {DataGrid, type GridColDef} from '@mui/x-data-grid';
import dayjs from 'dayjs';
import {createAssistantAlias, deleteAssistantAlias, fetchAssistantAliases, fetchAssistantMemberLogs, fetchAssistantUsage} from '../../api/admin/AssistantAdminApi';
import {fetchStockSearch} from '../../api/stock/StockApi';
import {fetchUsStockSearch} from '../../api/usStock/UsStockApi';
import {fetchCryptoSearch} from '../../api/crypto/CryptoApi';
import {requireOk} from '../../lib/apiResponse';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import type {AssistantAliasRes, AssistantChatLogRes, AssistantUsageSum, StockMarket} from '../../type/AssistantType';

const ALIAS_KEY = ['admin', 'assistant', 'aliases'] as const;
const MARKET_LABEL: Record<StockMarket, string> = {KR: '국내', US: '미국', CRYPTO: '코인'};
/** Python 비서 서비스의 월 비용 상한 (app/config.py monthly_cost_cap_usd) */
const MONTHLY_CAP_USD = 30;

const usd = (v: number) => `$${v.toFixed(v >= 1 ? 2 : 4)}`;
const num = (v: number) => v.toLocaleString();
/** 값이 없으면(구버전 응답·기록 없음) '-' — NaN 표시 방지 */
const sec = (ms: number | null | undefined) => (ms == null || Number.isNaN(ms) ? '-' : `${(ms / 1000).toFixed(1)}초`);
const pct = (part: number, total: number) => (total > 0 ? `${((part / total) * 100).toFixed(1)}%` : '0%');

function StatTile({label, value, sub, loading, color}: { label: string; value: string; sub?: string; loading: boolean; color?: string }) {
    return (
        <Card variant="outlined" sx={{height: '100%'}}>
            <CardContent>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
                <Typography variant="h6" sx={{mt: 1}} color={color}>{loading ? <Skeleton width={100}/> : value}</Typography>
                {sub && <Typography variant="caption" color="text.secondary">{loading ? <Skeleton width={80}/> : sub}</Typography>}
            </CardContent>
        </Card>
    );
}

type MemberRow = { id: number; no: number; loginId: string } & AssistantUsageSum;

/** 회원별 표: 핵심 열만 기본 표시, 토큰 세부는 열 메뉴에서 켠다 */
const MEMBER_COLUMNS: GridColDef<MemberRow>[] = [
    {field: 'no', headerName: 'No', width: 70, sortable: false},
    {field: 'loginId', headerName: '아이디', flex: 1, minWidth: 120},
    {field: 'turns', headerName: '질문 수', type: 'number', width: 90, description: '질문 1개와 답변 1개를 1회로 셈'},
    {field: 'costUsd', headerName: '비용', type: 'number', width: 100, valueFormatter: (v: number) => usd(v), description: 'LLM API 사용 금액 (토큰 기준 추정, USD)'},
    {field: 'rejectCount', headerName: '거절', type: 'number', width: 80, description: '비서 범위 밖 요청을 고정 문구로 거절 (매매 요청·모의투자·인사·범위 밖 질문)'},
    {field: 'askCount', headerName: '되묻기', type: 'number', width: 80, description: '종목·가격·방향·기간 등 정보가 빠져 다시 물어본 경우'},
    {field: 'errorCount', headerName: '오류·차단', type: 'number', width: 90, description: '처리 오류(시간 초과·LLM 오류) + 사용 상한(분당 10회·월 $30) 초과로 차단'},
    {field: 'avgLatencyMs', headerName: '평균 응답', type: 'number', width: 100, valueFormatter: (v: number | null) => sec(v), description: '질문부터 답변 완료까지 평균 시간'},
    {field: 'llmCalls', headerName: 'LLM 호출', type: 'number', width: 90},
    {field: 'inputTokens', headerName: '입력 토큰', type: 'number', width: 110},
    {field: 'cacheReadTokens', headerName: '캐시 읽기', type: 'number', width: 110},
    {field: 'outputTokens', headerName: '출력 토큰', type: 'number', width: 110},
];
const HIDDEN_TOKEN_COLUMNS = {llmCalls: false, inputTokens: false, cacheReadTokens: false, outputTokens: false};

/** 결과 칩 색 (문구는 서버 routeLabel) */
const ROUTE_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    TOOL: 'success', PICK: 'success', REJECT: 'warning', ASK_USER: 'info', BLOCKED: 'error', ERROR: 'error',
};

const NORMAL_ROUTES = new Set(['TOOL', 'PICK']);

const LOG_COLUMNS: GridColDef<AssistantChatLogRes>[] = [
    {field: 'createdAt', headerName: '시각', width: 140, valueFormatter: (v: string) => dayjs(v).format('MM-DD HH:mm:ss')},
    {
        field: 'requestLabel', headerName: '요청 내용', flex: 1, minWidth: 180, sortable: false,
        description: '비서가 조회·실행한 기능 또는 요청 종류 (질문 원문 대신 표시). 마우스를 올리면 내부 코드가 보입니다',
        renderCell: (p) => (
            <Tooltip title={p.row.tools.length ? p.row.tools.join(', ') : ''}>
                <span>{p.row.requestLabel ?? '-'}</span>
            </Tooltip>
        ),
    },
    {
        field: 'routeLabel', headerName: '결과', width: 100,
        renderCell: (p) => <Chip size="small" label={p.row.routeLabel} color={ROUTE_COLOR[p.row.route] ?? 'default'} variant="outlined"/>,
    },
    {
        field: 'reasonLabel', headerName: '사유', flex: 1, minWidth: 180,
        renderCell: (p) => (
            <Tooltip title={p.row.reason ?? ''}>
                <span>{p.row.reasonLabel ?? '-'}</span>
            </Tooltip>
        ),
    },
    {field: 'toolErrorCount', headerName: '도구 오류', type: 'number', width: 90},
    {field: 'latencyMs', headerName: '응답', type: 'number', width: 80, valueFormatter: (v: number | null) => sec(v)},
    {field: 'costUsd', headerName: '비용', type: 'number', width: 90, valueFormatter: (v: number) => usd(v)},
];

/** 회원 처리 기록: 질문 원문 없이 결과·사유·도구만 (개인정보 최소 열람, 2026-10-04) */
function MemberLogDialog({member, month, onClose}: { member: { id: number; loginId: string } | null; month: string; onClose: () => void }) {
    const [issuesOnly, setIssuesOnly] = useState(true);
    const q = useQuery({
        queryKey: ['admin', 'assistant', 'member-logs', member?.id, month],
        queryFn: async ({signal}) => requireOk(await fetchAssistantMemberLogs(member!.id, month, {signal}), '처리 기록 조회'),
        enabled: !!member,
    });
    const rows = (q.data ?? []).filter((l) => !issuesOnly || !NORMAL_ROUTES.has(l.route));
    return (
        <Dialog open={!!member} onClose={onClose} fullWidth maxWidth="lg">
            <DialogTitle>
                {member?.loginId} · {month} 처리 기록
            </DialogTitle>
            <DialogContent>
                <Stack direction="row" alignItems="center" sx={{mb: 1}}>
                    <Typography variant="caption" color="text.secondary" sx={{flexGrow: 1}}>
                        질문 원문은 개인정보라 표시하지 않습니다. 결과·사유·사용 도구만 보입니다.
                    </Typography>
                    <FormControlLabel
                        control={<Switch size="small" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)}/>}
                        label={<Typography variant="body2">정상 응답 제외</Typography>}
                    />
                </Stack>
                {q.isError && <Alert severity="error" sx={{mb: 1}}>{(q.error as Error).message}</Alert>}
                <DataGrid
                    rows={rows}
                    columns={LOG_COLUMNS}
                    loading={q.isLoading}
                    density="compact"
                    disableRowSelectionOnClick
                    initialState={{pagination: {paginationModel: {pageSize: 10}}}}
                    pageSizeOptions={[10, 20, 50]}
                    localeText={{noRowsLabel: issuesOnly ? '거절·되묻기·오류·차단 기록이 없습니다' : '기록이 없습니다'}}
                    sx={{border: 0}}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>닫기</Button>
            </DialogActions>
        </Dialog>
    );
}

function UsageSection() {
    const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
    const [keyword, setKeyword] = useState('');
    const [selected, setSelected] = useState<MemberRow | null>(null);
    const q = useQuery({
        queryKey: ['admin', 'assistant', 'usage', month],
        queryFn: async ({signal}) => requireOk(await fetchAssistantUsage(month, {signal}), '비서 사용량 조회'),
    });
    const total = q.data?.total;
    const loading = q.isLoading;

    // 일자별 차트: 기록 없는 날도 0 으로 채워 달력 축을 유지 (이번 달은 오늘까지)
    const daily = useMemo(() => {
        const start = dayjs(`${month}-01`);
        const last = start.isSame(dayjs(), 'month') ? dayjs().date() : start.daysInMonth();
        const byDate = new Map((q.data?.daily ?? []).map((d) => [d.date, d.usage]));
        return Array.from({length: last}, (_, i) => {
            const date = start.add(i, 'day').format('YYYY-MM-DD');
            const u = byDate.get(date);
            return {day: `${i + 1}일`, cost: u?.costUsd ?? 0, turns: u?.turns ?? 0};
        });
    }, [month, q.data]);

    const members: MemberRow[] = useMemo(() => {
        const k = keyword.trim().toLowerCase();
        return (q.data?.members ?? [])
            // 번호는 회원 관리 화면처럼 목록 순서(서버가 비용 순 정렬)로 매기고, 검색해도 유지한다
            .map((m, i) => ({id: m.memberId, no: i + 1, loginId: m.loginId ?? `#${m.memberId}`, ...m.usage}))
            .filter((m) => !k || m.loginId.toLowerCase().includes(k));
    }, [q.data, keyword]);

    return (
        <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <TextField size="small" type="month" label="조회 월" value={month} onChange={(e) => setMonth(e.target.value)} slotProps={{inputLabel: {shrink: true}}}/>
                {q.isError && <Alert severity="error" sx={{py: 0}}>{(q.error as Error).message}</Alert>}
            </Stack>

            <Grid container spacing={2}>
                <Grid size={{xs: 12, sm: 6, md: 3}}>
                    <StatTile label="이번 달 비용" loading={loading}
                              value={total ? `${usd(total.costUsd)} / $${MONTHLY_CAP_USD}` : '-'}
                              sub={total ? `월 상한의 ${pct(total.costUsd, MONTHLY_CAP_USD)}` : undefined}
                              color={total && total.costUsd >= MONTHLY_CAP_USD * 0.8 ? 'error.main' : undefined}/>
                </Grid>
                <Grid size={{xs: 12, sm: 6, md: 3}}>
                    <StatTile label="질문 수" loading={loading}
                              value={total ? `${num(total.turns)}회` : '-'}
                              sub={total ? `LLM 호출 ${num(total.llmCalls)}회` : undefined}/>
                </Grid>
                <Grid size={{xs: 12, sm: 6, md: 3}}>
                    <StatTile label="오류·차단 비율" loading={loading}
                              value={total ? pct(total.errorCount, total.turns) : '-'}
                              sub={total ? `거절 ${num(total.rejectCount)} · 되묻기 ${num(total.askCount)}` : undefined}
                              color={total && total.errorCount > 0 ? 'error.main' : undefined}/>
                </Grid>
                <Grid size={{xs: 12, sm: 6, md: 3}}>
                    <StatTile label="평균 응답 시간" loading={loading}
                              value={total ? sec(total.avgLatencyMs) : '-'}/>
                </Grid>
            </Grid>

            <Card variant="outlined">
                <CardContent>
                    <Typography variant="subtitle2" sx={{fontWeight: 600}}>일자별 비용</Typography>
                    <BarChart
                        borderRadius={4}
                        xAxis={[{scaleType: 'band', data: daily.map((d) => d.day), categoryGapRatio: 0.4}]}
                        yAxis={[{valueFormatter: (v: number | null) => (v == null ? '' : `$${v}`), width: 56}]}
                        series={[{
                            data: daily.map((d) => d.cost),
                            label: '비용',
                            valueFormatter: (v, {dataIndex}) => (v == null ? '' : `${usd(v)} · 질문 ${num(daily[dataIndex].turns)}회`),
                        }]}
                        height={220}
                        margin={{left: 8, right: 8, top: 16, bottom: 8}}
                        grid={{horizontal: true}}
                        hideLegend
                        loading={loading}
                    />
                </CardContent>
            </Card>

            <Card variant="outlined">
                <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{mb: 1.5}}>
                        <Typography variant="subtitle2" sx={{fontWeight: 600}}>회원별 사용량</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{flexGrow: 1}}>행을 누르면 처리 기록을 볼 수 있습니다</Typography>
                        <TextField size="small" placeholder="아이디 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                                   slotProps={{input: {startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small"/></InputAdornment>}}}/>
                    </Stack>
                    <DataGrid
                        rows={members}
                        columns={MEMBER_COLUMNS}
                        loading={loading}
                        density="compact"
                        disableRowSelectionOnClick
                        initialState={{
                            pagination: {paginationModel: {pageSize: 10}},
                            sorting: {sortModel: [{field: 'costUsd', sort: 'desc'}]},
                            columns: {columnVisibilityModel: HIDDEN_TOKEN_COLUMNS},
                        }}
                        pageSizeOptions={[10, 20, 50]}
                        localeText={{noRowsLabel: '기록이 없습니다'}}
                        onRowClick={(p) => setSelected(p.row)}
                        sx={{border: 0, '& .MuiDataGrid-row': {cursor: 'pointer'}}}
                    />
                </CardContent>
            </Card>
            <MemberLogDialog member={selected} month={month} onClose={() => setSelected(null)}/>
        </Stack>
    );
}

interface StockOption { code: string; name: string; market: StockMarket; }

/** 별칭 추가: 종목은 코드 입력 대신 이름 검색으로 고른다 (헤더 통합 검색과 같은 API) */
function AliasAddDialog({open, onClose}: { open: boolean; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [alias, setAlias] = useState('');
    const [stock, setStock] = useState<StockOption | null>(null);
    const [options, setOptions] = useState<StockOption[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const reset = () => { setAlias(''); setStock(null); setOptions([]); setError(''); };
    const close = () => { reset(); onClose(); };

    const create = useMutation({
        mutationFn: async () => requireOk(await createAssistantAlias({alias: alias.trim(), market: stock!.market, stkCd: stock!.code}), '별칭 등록'),
        onSuccess: () => { void queryClient.invalidateQueries({queryKey: ALIAS_KEY}); close(); },
        onError: (e) => setError((e as Error).message),
    });

    const search = (keyword: string) => {
        if (timer.current) clearTimeout(timer.current);
        if (!keyword.trim()) { setOptions([]); return; }
        timer.current = setTimeout(async () => {
            setSearching(true);
            try {
                const [kr, us, coin] = await Promise.all([
                    fetchStockSearch(keyword.trim()), fetchUsStockSearch(keyword.trim()), fetchCryptoSearch(keyword.trim()),
                ]);
                setOptions([
                    ...((kr.result ?? []) as { stkCd: string; stkNm: string }[]).map((s) => ({code: s.stkCd, name: s.stkNm, market: 'KR' as const})),
                    ...((us.result ?? []) as { stkCd: string; stkNm: string }[]).map((s) => ({code: s.stkCd, name: s.stkNm, market: 'US' as const})),
                    ...((coin.result ?? []) as { market: string; koreanName: string }[]).map((c) => ({code: c.market, name: c.koreanName, market: 'CRYPTO' as const})),
                ]);
            } catch {
                setOptions([]);
            } finally {
                setSearching(false);
            }
        }, 300);
    };

    const submit = () => {
        if (!alias.trim() || !stock) { setError('별칭과 종목을 입력해 주세요'); return; }
        create.mutate();
    };

    return (
        <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
            <DialogTitle>별칭 추가</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{pt: 1}}>
                    <TextField size="small" label="별칭" placeholder="예: 삼전, 하닉, 엔비" value={alias} onChange={(e) => setAlias(e.target.value)} autoFocus/>
                    <Autocomplete
                        size="small"
                        options={options}
                        value={stock}
                        loading={searching}
                        filterOptions={(x) => x}
                        onChange={(_, v) => setStock(v)}
                        onInputChange={(_, v, reason) => { if (reason === 'input') search(v); }}
                        isOptionEqualToValue={(a, b) => a.market === b.market && a.code === b.code}
                        getOptionLabel={(o) => `${o.name} (${o.code})`}
                        renderOption={(props, o) => (
                            <li {...props} key={`${o.market}-${o.code}`}>
                                <Typography variant="body2" sx={{flexGrow: 1}}>{o.name}</Typography>
                                <Typography variant="caption" color="text.secondary">{MARKET_LABEL[o.market]} · {o.code}</Typography>
                            </li>
                        )}
                        noOptionsText="종목명을 입력하세요"
                        renderInput={(params) => <TextField {...params} label="종목" placeholder="종목명 검색"/>}
                    />
                    {error && <Alert severity="error" sx={{py: 0}}>{error}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={close}>취소</Button>
                <Button variant="contained" onClick={submit} disabled={create.isPending}>등록</Button>
            </DialogActions>
        </Dialog>
    );
}

function AliasSection() {
    const queryClient = useQueryClient();
    const [keyword, setKeyword] = useState('');
    const [addOpen, setAddOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<AssistantAliasRes | null>(null);
    const q = useQuery({
        queryKey: ALIAS_KEY,
        queryFn: async ({signal}) => requireOk(await fetchAssistantAliases({signal}), '별칭 조회'),
    });
    const remove = useMutation({
        mutationFn: async (id: number) => requireOk(await deleteAssistantAlias(id), '별칭 삭제'),
        onSuccess: () => { setDeleteTarget(null); void queryClient.invalidateQueries({queryKey: ALIAS_KEY}); },
        onError: () => setDeleteTarget(null),
    });

    const rows = useMemo(() => {
        const k = keyword.trim().toLowerCase();
        return (q.data ?? []).filter((a) => !k || a.alias.toLowerCase().includes(k) || a.stkCd.toLowerCase().includes(k));
    }, [q.data, keyword]);

    const columns: GridColDef<AssistantAliasRes>[] = [
        {field: 'alias', headerName: '별칭', flex: 1, minWidth: 120},
        {field: 'market', headerName: '시장', width: 90, valueFormatter: (v: StockMarket) => MARKET_LABEL[v]},
        {field: 'stkCd', headerName: '종목 코드', width: 140},
        {field: 'createdAt', headerName: '등록일', width: 120, valueFormatter: (v: string) => dayjs(v).format('YYYY-MM-DD')},
        {
            field: 'actions', headerName: '', width: 60, sortable: false, filterable: false, align: 'right',
            renderCell: (p) => (
                <IconButton size="small" aria-label="삭제" onClick={() => setDeleteTarget(p.row)}><DeleteOutlineIcon fontSize="small"/></IconButton>
            ),
        },
    ];

    return (
        <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
                채팅에서 쓰는 종목 별명을 종목에 연결합니다. 비서는 정확한 종목명 → 별칭 → 부분 일치 순서로 종목을 찾으며,
                부분 일치로 후보가 여럿이면 되묻습니다. 자주 되묻는 이름을 등록해 두면 바로 찾습니다.
            </Typography>
            <Card variant="outlined">
                <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{mb: 1.5}}>
                        <TextField size="small" placeholder="별칭·종목 코드 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} sx={{flexGrow: 1, maxWidth: 320}}
                                   slotProps={{input: {startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small"/></InputAdornment>}}}/>
                        <Box sx={{flexGrow: 1}}/>
                        <Button variant="contained" startIcon={<AddIcon/>} onClick={() => setAddOpen(true)}>별칭 추가</Button>
                    </Stack>
                    {q.isError && <Alert severity="error" sx={{mb: 1}}>{(q.error as Error).message}</Alert>}
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        loading={q.isLoading}
                        density="compact"
                        disableRowSelectionOnClick
                        initialState={{
                            pagination: {paginationModel: {pageSize: 10}},
                            sorting: {sortModel: [{field: 'createdAt', sort: 'desc'}]},
                        }}
                        pageSizeOptions={[10, 20, 50]}
                        localeText={{noRowsLabel: '등록된 별칭이 없습니다'}}
                        sx={{border: 0}}
                    />
                </CardContent>
            </Card>
            <AliasAddDialog open={addOpen} onClose={() => setAddOpen(false)}/>
            <DeleteConfirmDialog
                open={!!deleteTarget}
                title="별칭 삭제"
                message={`'${deleteTarget?.alias}' 별칭을 삭제할까요?`}
                pending={remove.isPending}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
            />
        </Stack>
    );
}

/** 모니터링 화면 "AI 비서" 탭: 사용량 / 종목 별칭 하위 탭 (권한 ADMIN_MONITORING 공용) */
export default function AssistantAdminTab() {
    const [sub, setSub] = useState<'usage' | 'alias'>('usage');
    return (
        <Stack spacing={2}>
            <ToggleButtonGroup size="small" exclusive value={sub} onChange={(_, v) => v && setSub(v)}>
                <ToggleButton value="usage" sx={{px: 2}}>사용량</ToggleButton>
                <ToggleButton value="alias" sx={{px: 2}}>종목 별칭</ToggleButton>
            </ToggleButtonGroup>
            {sub === 'usage' ? <UsageSection/> : <AliasSection/>}
        </Stack>
    );
}
