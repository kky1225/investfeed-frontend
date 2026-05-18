import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {requireOk} from '../../lib/apiResponse';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import {DataGrid, type GridColDef} from '@mui/x-data-grid';
import {
    fetchAdminRecommendPicks,
    fetchAdminMarketSnapshots,
    fetchAdminBackfillStatus,
    fetchAdminBacktestMetrics,
} from '../../api/admin/RecommendMonitoringApi';
import type {
    AdminRecommendPickRes,
    AdminMarketSnapshotRes,
    AdminBackfillStatusRes,
    AdminBacktestMetricsRes,
    GroupMetrics,
    HorizonMetrics,
    ModuleTrigger,
} from '../../type/RecommendMonitoringType';

/**
 * 관리자 — 추천 시스템 모니터링 + 백테스트.
 *
 * 표준 백테스트 도구 4계층 구성:
 *  1) Signal Inspector + Performance (탭 1) — 날짜별 신호 + N일 후 수익률
 *  2) Environment (탭 2)                   — 매크로 스냅샷
 *  3) Operational Health (탭 3)            — 백필 진행도
 *  4) Aggregate Metrics (탭 4)             — 적중률/평균수익률/표준편차 + 분해 통계
 */
export default function RecommendMonitoring() {
    const [tab, setTab] = useState(0);

    return (
        <Box sx={{p: 2}}>
            <Typography variant="h5" sx={{mb: 1}}>추천 시스템 모니터링</Typography>
            <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                매일 22:00 추천 + 22:30 백필 스케줄러 실행 결과. 사용자 노출 X — 관리자 전용.
            </Typography>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{mb: 2}}>
                <Tab label="1. 신호 + Performance" />
                <Tab label="2. 매크로 스냅샷" />
                <Tab label="3. 백필 진행도" />
                <Tab label="4. 백테스트 집계" />
            </Tabs>

            {tab === 0 && <SignalsPanel />}
            {tab === 1 && <SnapshotsPanel />}
            {tab === 2 && <BackfillPanel />}
            {tab === 3 && <MetricsPanel />}
        </Box>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// 탭 1: Signal Inspector + Performance
// ════════════════════════════════════════════════════════════════════════════
function SignalsPanel() {
    // date 미지정 = 오늘 (= stock_pick). YYYY-MM-DD 선택 시 stock_pick_history 조회.
    const today = new Date().toISOString().slice(0, 10);
    const [date, setDate] = useState<string>(today);
    const isHistorical = date !== today;

    const {data, isLoading, isError} = useQuery<AdminRecommendPickRes[]>({
        queryKey: ['admin-recommend-picks', date],
        queryFn: async () => requireOk(
            await fetchAdminRecommendPicks(isHistorical ? date : undefined),
            [],
        ),
    });

    const columns: GridColDef<AdminRecommendPickRes>[] = [
        // Signal
        {field: 'stkCd', headerName: '종목코드', width: 100},
        {field: 'stkNm', headerName: '종목명', width: 130},
        {field: 'marketType', headerName: '시장', width: 75},
        {field: 'originSide', headerName: '진영', width: 65},
        {
            field: 'type', headerName: '등급', width: 110,
            renderCell: (p) => <TypeChip type={p.value as string} />,
        },
        // Trigger (후행 모듈만 — 매크로는 동행지표라 백테스트에서 제외)
        {field: 'pvTrigger', headerName: 'PV', width: 85, renderCell: (p) => <TriggerChip v={p.value as ModuleTrigger} />},
        {field: 'maTrigger', headerName: 'MA', width: 85, renderCell: (p) => <TriggerChip v={p.value as ModuleTrigger} />},
        {field: 'vpTrigger', headerName: 'VP', width: 85, renderCell: (p) => <TriggerChip v={p.value as ModuleTrigger} />},
        {field: 'rsiTrigger', headerName: 'RSI', width: 85, renderCell: (p) => <TriggerChip v={p.value as ModuleTrigger} />},
        {field: 'hl52wTrigger', headerName: '52주위치', width: 90, renderCell: (p) => <TriggerChip v={p.value as ModuleTrigger} />},
        {field: 'breakoutTrigger', headerName: '신고저돌파', width: 95, renderCell: (p) => <TriggerChip v={p.value as ModuleTrigger} />},
        // Raw 지표
        {field: 'rsi14', headerName: 'RSI14', width: 80, valueFormatter: (v) => fmtNum(v as number | null, 1)},
        {field: 'flu5Pct', headerName: '5일등락%', width: 95, valueFormatter: (v) => fmtNum(v as number | null, 2)},
        {field: 'todayChangeRate', headerName: '당일%', width: 85, valueFormatter: (v) => fmtNum(v as number | null, 2)},
        {field: 'ma5', headerName: 'MA5', width: 100, valueFormatter: (v) => fmtNum(v as number | null, 0)},
        {field: 'ma20', headerName: 'MA20', width: 100, valueFormatter: (v) => fmtNum(v as number | null, 0)},
        {field: 'todayVolume', headerName: '당일거래량', width: 110, valueFormatter: (v) => fmtLong(v as number | null)},
        {field: 'avg20dVolume', headerName: '20일평균거래량', width: 130, valueFormatter: (v) => fmtLong(v as number | null)},
        // 52주 위치 (HighLow52wModule) — Stage Analysis
        {field: 'distFromLow52w', headerName: '저점거리%', width: 100, valueFormatter: (v) => fmtNum(v as number | null, 1)},
        {field: 'distFromHigh52w', headerName: '고점거리%', width: 100, valueFormatter: (v) => fmtNum(v as number | null, 1)},
        {
            field: 'closeAboveMa20', headerName: 'MA20위', width: 80,
            renderCell: (p) => p.value == null ? <span>-</span> : <span>{(p.value as boolean) ? '↑' : '↓'}</span>,
        },
        // 가격 + Performance (history 만 채워짐)
        {field: 'pickPrice', headerName: 'T일 종가', width: 95, valueFormatter: (v) => fmtLong(v as number | null)},
        {field: 'priceOpen1d', headerName: 'T+1 시가', width: 95, valueFormatter: (v) => fmtLong(v as number | null)},
        {
            field: 'ret1d', headerName: '1d 수익', width: 100,
            renderCell: (p) => <ReturnCell v={p.value as number | null} side={p.row.originSide} />,
        },
        {
            field: 'ret5d', headerName: '5d 수익', width: 100,
            renderCell: (p) => <ReturnCell v={p.value as number | null} side={p.row.originSide} />,
        },
        {
            field: 'ret20d', headerName: '20d 수익', width: 100,
            renderCell: (p) => <ReturnCell v={p.value as number | null} side={p.row.originSide} />,
        },
    ];

    if (isError) return <ErrorBanner text="데이터 조회 실패" />;

    return (
        <Box>
            {/* 컨트롤 바: 날짜 선택 */}
            <Paper sx={{p: 2, mb: 2}} variant="outlined">
                <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                        label="조회 일자"
                        type="date"
                        size="small"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        InputLabelProps={{shrink: true}}
                        sx={{width: 180}}
                    />
                    <Typography variant="body2" color="text.secondary">
                        {isHistorical
                            ? `stock_pick_history 조회 (가격/수익률 포함)`
                            : `stock_pick 현재 상태 (당일 22:00 이후 데이터, 가격 백필 X)`}
                    </Typography>
                    <Box sx={{flexGrow: 1}} />
                    <SummaryChips picks={data ?? []} />
                </Stack>
            </Paper>

            <Box sx={{height: 700, width: '100%'}}>
                <DataGrid
                    rows={data ?? []}
                    columns={columns}
                    getRowId={(r) => `${r.stkCd}-${r.pickDate ?? 'current'}`}
                    loading={isLoading}
                    density="compact"
                    disableRowSelectionOnClick
                    initialState={{pagination: {paginationModel: {pageSize: 50}}}}
                    pageSizeOptions={[25, 50, 100]}
                />
            </Box>
        </Box>
    );
}

function SummaryChips({picks}: {picks: AdminRecommendPickRes[]}) {
    if (picks.length === 0) return null;
    const byType = picks.reduce<Record<string, number>>((acc, p) => {
        acc[p.type] = (acc[p.type] ?? 0) + 1;
        return acc;
    }, {});
    const order = ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'];
    return (
        <Stack direction="row" spacing={1}>
            <Chip size="small" label={`총 ${picks.length}`} variant="outlined" />
            {order.map((t) => (byType[t] ? (
                <Chip key={t} size="small" label={`${t} ${byType[t]}`} variant="outlined" />
            ) : null))}
        </Stack>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// 탭 2: 매크로 스냅샷
// ════════════════════════════════════════════════════════════════════════════
function SnapshotsPanel() {
    const {data, isLoading, isError} = useQuery<AdminMarketSnapshotRes[]>({
        queryKey: ['admin-market-snapshots', 30],
        queryFn: async () => requireOk(await fetchAdminMarketSnapshots(30), []),
    });

    const columns: GridColDef<AdminMarketSnapshotRes>[] = [
        {field: 'capturedDate', headerName: '일자', width: 110},
        {field: 'kospiChangeRate', headerName: 'KOSPI %', width: 95, valueFormatter: (v) => fmtNum(v as number | null, 2)},
        {field: 'kospiForeignerSign', headerName: 'KOSPI 외인', width: 105, renderCell: (p) => <SignChip v={p.value as string | null} />},
        {field: 'kospiInstitutionSign', headerName: 'KOSPI 기관', width: 105, renderCell: (p) => <SignChip v={p.value as string | null} />},
        {field: 'kospiScenario', headerName: 'KOSPI 시나리오', width: 160, renderCell: (p) => <ScenarioChip v={p.value as string | null} />},
        {field: 'kosdaqChangeRate', headerName: 'KOSDAQ %', width: 95, valueFormatter: (v) => fmtNum(v as number | null, 2)},
        {field: 'kosdaqForeignerSign', headerName: 'KOSDAQ 외인', width: 110, renderCell: (p) => <SignChip v={p.value as string | null} />},
        {field: 'kosdaqInstitutionSign', headerName: 'KOSDAQ 기관', width: 110, renderCell: (p) => <SignChip v={p.value as string | null} />},
        {field: 'kosdaqScenario', headerName: 'KOSDAQ 시나리오', width: 160, renderCell: (p) => <ScenarioChip v={p.value as string | null} />},
        {field: 'capturedAt', headerName: '저장시각', width: 180},
    ];

    if (isError) return <ErrorBanner text="데이터 조회 실패" />;

    return (
        <Box sx={{height: 700}}>
            <DataGrid
                rows={data ?? []}
                columns={columns}
                getRowId={(r) => r.capturedDate}
                loading={isLoading}
                density="compact"
                disableRowSelectionOnClick
                initialState={{pagination: {paginationModel: {pageSize: 25}}}}
                pageSizeOptions={[25, 50]}
            />
        </Box>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// 탭 3: 백필 진행도
// ════════════════════════════════════════════════════════════════════════════
function BackfillPanel() {
    const {data, isLoading, isError} = useQuery<AdminBackfillStatusRes[]>({
        queryKey: ['admin-backfill-status', 25],
        queryFn: async () => requireOk(await fetchAdminBackfillStatus(25), []),
    });

    const columns: GridColDef<AdminBackfillStatusRes>[] = [
        {field: 'pickDate', headerName: 'pickDate', width: 130},
        {field: 'totalCount', headerName: '추천 수', width: 100},
        {
            field: 'filled1d', headerName: '1일 채움', width: 130,
            renderCell: (p) => <FillRate filled={p.value as number} total={p.row.totalCount} />,
        },
        {
            field: 'filled5d', headerName: '5일 채움', width: 130,
            renderCell: (p) => <FillRate filled={p.value as number} total={p.row.totalCount} />,
        },
        {
            field: 'filled20d', headerName: '20일 채움', width: 130,
            renderCell: (p) => <FillRate filled={p.value as number} total={p.row.totalCount} />,
        },
    ];

    if (isError) return <ErrorBanner text="데이터 조회 실패" />;

    return (
        <Box sx={{height: 700}}>
            <DataGrid
                rows={data ?? []}
                columns={columns}
                getRowId={(r) => r.pickDate}
                loading={isLoading}
                density="compact"
                disableRowSelectionOnClick
                initialState={{pagination: {paginationModel: {pageSize: 25}}}}
                pageSizeOptions={[25, 50]}
            />
        </Box>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// 탭 4: Aggregate Metrics (백테스트 집계)
// ════════════════════════════════════════════════════════════════════════════
function MetricsPanel() {
    const [periodDays, setPeriodDays] = useState<number>(30);

    const {data, isLoading, isError} = useQuery<AdminBacktestMetricsRes>({
        queryKey: ['admin-backtest-metrics', periodDays],
        queryFn: async () => requireOk(
            await fetchAdminBacktestMetrics(periodDays),
            {} as AdminBacktestMetricsRes,
        ),
    });

    if (isError) return <ErrorBanner text="집계 조회 실패" />;
    if (isLoading || !data) return <Typography sx={{p: 2}}>로딩 중...</Typography>;

    return (
        <Box>
            {/* 기간 선택 */}
            <Paper sx={{p: 2, mb: 2}} variant="outlined">
                <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="body2">기간:</Typography>
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={periodDays}
                        onChange={(_, v) => v && setPeriodDays(v)}
                    >
                        <ToggleButton value={7}>7일</ToggleButton>
                        <ToggleButton value={30}>30일</ToggleButton>
                        <ToggleButton value={90}>90일</ToggleButton>
                        <ToggleButton value={365}>1년</ToggleButton>
                    </ToggleButtonGroup>
                    <Typography variant="body2" color="text.secondary" sx={{ml: 2}}>
                        총 신호 수: {data.totalSignals ?? 0}
                    </Typography>
                </Stack>
            </Paper>

            {/* 백테스트 가정/한계 안내 (항상 표시) */}
            <Paper sx={{p: 2, mb: 2, bgcolor: 'info.light'}} variant="outlined">
                <Typography variant="body2" sx={{fontWeight: 600}}>백테스트 가정 + 한계</Typography>
                <Typography variant="caption" component="div" color="text.secondary" sx={{mt: 0.5}}>
                    • 신호: T일 22:00 후행지표 만장일치 적용 등급 (type)<br />
                    • 매수: T+1일 시가 / 평가: T+1·5·20일 종가<br />
                    • 적중률: BUY 진영 = ret &gt; 0 비율, SELL 진영 = ret &lt; 0 비율<br />
                    • <b>매크로(동행지표) 보정은 백테스트에서 제외</b> — 사용 시점의 시장 상황 반영이 본질이라
                    시간 lag (T일 마감 매크로 → T+1일 매수) 시 의미 변질.
                    매크로 ON 사용자의 정확한 백테스트는 구조적으로 불가능 (장 중 페이지 열람 시점이 사용자마다 다름).
                    매크로 환경의 영향은 아래 "매크로 시나리오별 분해" 에서 측정.
                </Typography>
            </Paper>

            {/* 데이터 부족 안내 */}
            {data.insufficientReason && (
                <Paper sx={{p: 2, mb: 2, bgcolor: 'warning.light'}} variant="outlined">
                    <Typography variant="body2">⚠️ {data.insufficientReason}</Typography>
                </Paper>
            )}

            {/* KPI: 호라이즌별 (1d / 5d / 20d) */}
            <Stack direction="row" spacing={2} sx={{mb: 3}}>
                <HorizonCard horizon="1일 후" m={data.metrics1d} />
                <HorizonCard horizon="5일 후" m={data.metrics5d} />
                <HorizonCard horizon="20일 후" m={data.metrics20d} />
            </Stack>

            {/* 분해 표 */}
            <Stack spacing={3}>
                <GroupTable title="매크로 시나리오별 (환경 영향)" rows={data.byScenario} />
                <GroupTable title="등급별 (type)" rows={data.byType} />
                <GroupTable title="진영별 (BUY / SELL)" rows={data.byOriginSide} />
                <GroupTable title="후행 모듈 trigger 패턴별" rows={data.byModuleTrigger} />
            </Stack>
        </Box>
    );
}

function HorizonCard({horizon, m}: {horizon: string; m: HorizonMetrics}) {
    const meanColor = m.meanReturn == null ? 'text.secondary' : m.meanReturn > 0 ? 'success.main' : 'error.main';
    return (
        <Paper sx={{p: 2, flexGrow: 1}} variant="outlined">
            <Typography variant="overline" color="text.secondary">{horizon} ({m.horizon})</Typography>
            <Typography variant="caption" display="block">평가 가능: {m.evaluable}건</Typography>
            <Box sx={{my: 1}}>
                <Typography variant="body2">평균 수익률</Typography>
                <Typography variant="h6" sx={{color: meanColor}}>
                    {fmtNum(m.meanReturn, 2)}%
                </Typography>
            </Box>
            <Box sx={{display: 'flex', gap: 2, flexWrap: 'wrap'}}>
                <KV label="적중률" value={`${fmtNum(m.hitRate, 1)}%`} />
                <KV label="표준편차" value={`${fmtNum(m.stdDev, 2)}%`} />
                <KV label="최대" value={`${fmtNum(m.maxReturn, 2)}%`} />
                <KV label="최소" value={`${fmtNum(m.minReturn, 2)}%`} />
            </Box>
        </Paper>
    );
}

function KV({label, value}: {label: string; value: string}) {
    return (
        <Box>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="body2">{value}</Typography>
        </Box>
    );
}

function GroupTable({title, rows}: {title: string; rows: GroupMetrics[]}) {
    if (rows.length === 0) {
        return (
            <Paper sx={{p: 2}} variant="outlined">
                <Typography variant="subtitle2" sx={{mb: 1}}>{title}</Typography>
                <Typography variant="caption" color="text.secondary">데이터 없음</Typography>
            </Paper>
        );
    }
    const columns: GridColDef<GroupMetrics>[] = [
        {field: 'groupKey', headerName: '그룹', flex: 1, minWidth: 200},
        {field: 'count', headerName: '신호 수', width: 90},
        {field: 'evaluable5d', headerName: '5d 평가 가능', width: 110},
        {
            field: 'meanReturn5d', headerName: '5d 평균 수익률', width: 130,
            renderCell: (p) => <ReturnCell v={p.value as number | null} side={null} />,
        },
        {field: 'hitRate5d', headerName: '5d 적중률', width: 110, valueFormatter: (v) => v == null ? '-' : `${fmtNum(v as number, 1)}%`},
    ];
    return (
        <Paper sx={{p: 2}} variant="outlined">
            <Typography variant="subtitle2" sx={{mb: 1}}>{title}</Typography>
            <Box sx={{height: Math.min(rows.length * 36 + 110, 400)}}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    getRowId={(r) => r.groupKey}
                    density="compact"
                    disableRowSelectionOnClick
                    hideFooter={rows.length <= 10}
                    initialState={{pagination: {paginationModel: {pageSize: 10}}}}
                    pageSizeOptions={[10, 25, 50]}
                />
            </Box>
        </Paper>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// 공통 셀 컴포넌트
// ════════════════════════════════════════════════════════════════════════════
function TypeChip({type}: {type: string | null}) {
    if (!type) return <span>-</span>;
    const color: 'default' | 'success' | 'error' =
        type === 'STRONG_BUY' || type === 'BUY' ? 'success'
        : type === 'STRONG_SELL' || type === 'SELL' ? 'error'
        : 'default';
    const variant = (type === 'STRONG_BUY' || type === 'STRONG_SELL') ? 'filled' : 'outlined';
    return <Chip size="small" label={type} color={color} variant={variant} />;
}

function TriggerChip({v}: {v: ModuleTrigger}) {
    if (!v || v === 'NONE') return <span style={{color: '#999'}}>-</span>;
    const color: 'success' | 'error' = v === 'PROMOTE' ? 'success' : 'error';
    return <Chip size="small" label={v} color={color} variant="outlined" />;
}

function SignChip({v}: {v: string | null}) {
    if (!v) return <span>-</span>;
    const color: 'success' | 'error' | 'default' =
        v === 'BUY' ? 'success' : v === 'SELL' ? 'error' : 'default';
    return <Chip size="small" label={v} color={color} variant="outlined" />;
}

function ScenarioChip({v}: {v: string | null}) {
    if (!v) return <span>-</span>;
    const promote = v === 'UP_BUY_BUY' || v === 'DOWN_SELL_SELL';
    const demote = v === 'UP_SELL_SELL' || v === 'DOWN_BUY_BUY';
    const color: 'success' | 'error' | 'warning' | 'default' =
        promote ? 'success' : demote ? 'error' :
        (v.startsWith('UP_') || v.startsWith('DOWN_')) ? 'warning' : 'default';
    return <Chip size="small" label={v} color={color} variant="outlined" />;
}

function FillRate({filled, total}: {filled: number; total: number}) {
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    const color = filled === total ? 'success.main' : filled > 0 ? 'warning.main' : 'text.secondary';
    return <Box sx={{color}}>{filled}/{total} ({pct}%)</Box>;
}

/**
 * 수익률 셀. side 가 'SELL' 이면 음수가 좋은 신호 (매도 성공) → 색상 반전.
 */
function ReturnCell({v, side}: {v: number | null; side: string | null}) {
    if (v == null) return <span style={{color: '#999'}}>-</span>;
    const success = side === 'SELL' ? v < 0 : v > 0;
    const color = success ? 'success.main' : 'error.main';
    return <Box sx={{color, fontFamily: 'monospace'}}>{fmtNum(v, 2)}%</Box>;
}

function ErrorBanner({text}: {text: string}) {
    return <Typography color="error" sx={{p: 2}}>{text}</Typography>;
}

function fmtNum(v: number | null | undefined, digits: number): string {
    if (v == null || Number.isNaN(v)) return '-';
    return v.toFixed(digits);
}

function fmtLong(v: number | null | undefined): string {
    if (v == null) return '-';
    return v.toLocaleString();
}
