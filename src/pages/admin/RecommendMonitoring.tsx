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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import {DataGrid, type GridColDef, type GridColumnGroupingModel, type GridRenderCellParams} from '@mui/x-data-grid';
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
            <Typography variant="h5" sx={{mb: 2}}>추천 시스템 모니터링</Typography>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{mb: 2}}>
                <Tab label="추천 종목" />
                <Tab label="매크로 스냅샷" />
                <Tab label="백필 진행도" />
                <Tab label="백테스트 집계" />
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

    // 행 클릭 → 상세 다이얼로그 (모니터링 에러 로그 패턴)
    const [selected, setSelected] = useState<AdminRecommendPickRes | null>(null);

    // 표는 핵심 컬럼만 — 세부 트리거/Raw지표/52주위치/백테스트 가격은 클릭 시 다이얼로그.
    const columns: GridColDef<AdminRecommendPickRes>[] = [
        {field: 'stkCd', headerName: '종목코드', width: 100},
        {field: 'stkNm', headerName: '종목명', flex: 1, minWidth: 130},
        {field: 'marketType', headerName: '시장', width: 75, align: 'center', headerAlign: 'center'},
        {field: 'originSide', headerName: '진영', width: 65, align: 'center', headerAlign: 'center'},
        {
            field: 'type', headerName: '등급', width: 130, align: 'center', headerAlign: 'center',
            renderCell: (p) => <TypeChip type={p.value as string} />,
        },
        {
            field: 'ret1d', headerName: '1d 수익', width: 100, align: 'right', headerAlign: 'right',
            renderCell: (p) => <ReturnCell v={p.value as number | null} side={p.row.originSide} type={p.row.type} />,
        },
        {
            field: 'ret5d', headerName: '5d 수익', width: 100, align: 'right', headerAlign: 'right',
            renderCell: (p) => <ReturnCell v={p.value as number | null} side={p.row.originSide} type={p.row.type} />,
        },
        {
            field: 'ret20d', headerName: '20d 수익', width: 100, align: 'right', headerAlign: 'right',
            renderCell: (p) => <ReturnCell v={p.value as number | null} side={p.row.originSide} type={p.row.type} />,
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
                    {isHistorical && (
                        <Typography variant="body2" color="text.secondary">
                            stock_pick_history 조회 (가격/수익률 포함). 종목 행 클릭 시 트리거·지표·백테스트 가격 상세.
                        </Typography>
                    )}
                    <Box sx={{flexGrow: 1}} />
                    <SummaryChips picks={data ?? []} />
                </Stack>
            </Paper>

            <DataGrid
                autoHeight
                rows={data ?? []}
                columns={columns}
                getRowId={(r) => `${r.stkCd}-${r.pickDate ?? 'current'}`}
                loading={isLoading}
                density="compact"
                disableRowSelectionOnClick
                onRowClick={(p) => setSelected(p.row as AdminRecommendPickRes)}
                initialState={{pagination: {paginationModel: {pageSize: 50}}}}
                pageSizeOptions={[25, 50, 100]}
                sx={{'& .MuiDataGrid-row': {cursor: 'pointer'}}}
            />

            <SignalDetailDialog pick={selected} onClose={() => setSelected(null)} />
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
    // 한국 관례 — 매수 진영(BUY/STRONG_BUY) 빨강, 매도 진영(SELL/STRONG_SELL) 파랑, HOLD 중립.
    const colorOf = (t: string): 'error' | 'info' | 'default' => {
        if (t === 'STRONG_BUY' || t === 'BUY') return 'error';
        if (t === 'SELL' || t === 'STRONG_SELL') return 'info';
        return 'default';
    };
    return (
        <Stack direction="row" spacing={1}>
            <Chip size="small" label={`총 ${picks.length}`} variant="outlined" />
            {order.map((t) => (byType[t] ? (
                <Chip key={t} size="small" color={colorOf(t)} label={`${t} ${byType[t]}`} variant="outlined" />
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

    const center = {headerAlign: 'center' as const, align: 'center' as const};
    const columns: GridColDef<AdminMarketSnapshotRes>[] = [
        {field: 'capturedDate', headerName: '일자', width: 120, ...center},
        {field: 'kospiChangeRate', headerName: '등락률', width: 110, ...center, renderCell: (p) => <ChangeRateCell v={p.value as number | null} />},
        {field: 'kospiForeignerSign', headerName: '외인', width: 90, ...center, renderCell: (p) => <SignChip v={p.value as string | null} />},
        {field: 'kospiInstitutionSign', headerName: '기관', width: 90, ...center, renderCell: (p) => <SignChip v={p.value as string | null} />},
        {field: 'kospiScenario', headerName: '매크로', width: 120, ...center, renderCell: (p) => <MacroEffectChip v={p.value as string | null} />},
        {field: 'kosdaqChangeRate', headerName: '등락률', width: 110, ...center, renderCell: (p) => <ChangeRateCell v={p.value as number | null} />},
        {field: 'kosdaqForeignerSign', headerName: '외인', width: 90, ...center, renderCell: (p) => <SignChip v={p.value as string | null} />},
        {field: 'kosdaqInstitutionSign', headerName: '기관', width: 90, ...center, renderCell: (p) => <SignChip v={p.value as string | null} />},
        {field: 'kosdaqScenario', headerName: '매크로', width: 120, ...center, renderCell: (p) => <MacroEffectChip v={p.value as string | null} />},
    ];

    const columnGroupingModel: GridColumnGroupingModel = [
        {
            groupId: 'KOSPI', headerName: 'KOSPI', headerAlign: 'center',
            children: [
                {field: 'kospiChangeRate'}, {field: 'kospiForeignerSign'},
                {field: 'kospiInstitutionSign'}, {field: 'kospiScenario'},
            ],
        },
        {
            groupId: 'KOSDAQ', headerName: 'KOSDAQ', headerAlign: 'center',
            children: [
                {field: 'kosdaqChangeRate'}, {field: 'kosdaqForeignerSign'},
                {field: 'kosdaqInstitutionSign'}, {field: 'kosdaqScenario'},
            ],
        },
    ];

    if (isError) return <ErrorBanner text="데이터 조회 실패" />;

    return (
        <DataGrid
            autoHeight
            rows={data ?? []}
            columns={columns}
            columnGroupingModel={columnGroupingModel}
            getRowId={(r) => r.capturedDate}
            loading={isLoading}
            density="compact"
            disableRowSelectionOnClick
            showColumnVerticalBorder
            showCellVerticalBorder
            initialState={{pagination: {paginationModel: {pageSize: 25}}}}
            pageSizeOptions={[25, 50]}
            sx={{
                '& .MuiDataGrid-columnHeaderTitle': {fontWeight: 700},
                '& .MuiDataGrid-columnHeader--filledGroup .MuiDataGrid-columnHeaderTitle': {
                    fontWeight: 800,
                },
            }}
        />
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
        <DataGrid
            autoHeight
            rows={data ?? []}
            columns={columns}
            getRowId={(r) => r.pickDate}
            loading={isLoading}
            density="compact"
            disableRowSelectionOnClick
            initialState={{pagination: {paginationModel: {pageSize: 25}}}}
            pageSizeOptions={[25, 50]}
        />
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
            {/* 기간 선택 — iOS Segmented Control 스타일 + 우측 통계 카드 */}
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
                gap={2}
                sx={{mb: 2.5, px: 0.5}}
            >
                <ToggleButtonGroup
                    exclusive
                    value={periodDays}
                    onChange={(_, v) => v && setPeriodDays(v)}
                    sx={{
                        p: 0.5,
                        bgcolor: 'action.hover',
                        borderRadius: 999,
                        gap: 0.25,
                        '& .MuiToggleButton-root': {
                            border: 0,
                            borderRadius: '999px !important',
                            px: 2.5,
                            py: 0.5,
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            textTransform: 'none',
                            color: 'text.secondary',
                            transition: 'all 0.2s',
                            '&:hover': {
                                bgcolor: 'action.selected',
                            },
                            '&.Mui-selected': {
                                bgcolor: 'background.paper',
                                color: 'primary.main',
                                fontWeight: 700,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                                '&:hover': {
                                    bgcolor: 'background.paper',
                                },
                            },
                        },
                    }}
                >
                    <ToggleButton value={7}>7일</ToggleButton>
                    <ToggleButton value={30}>30일</ToggleButton>
                    <ToggleButton value={90}>90일</ToggleButton>
                    <ToggleButton value={365}>1년</ToggleButton>
                </ToggleButtonGroup>

                <Box sx={{textAlign: 'right'}}>
                    <Typography
                        variant="caption"
                        sx={{
                            display: 'block',
                            color: 'text.secondary',
                            fontSize: '0.6875rem',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            lineHeight: 1,
                            mb: 0.25,
                        }}
                    >
                        집계 신호
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            lineHeight: 1.1,
                            color: 'text.primary',
                            fontFeatureSettings: '"tnum"',
                        }}
                    >
                        {(data.totalSignals ?? 0).toLocaleString()}
                        <Box
                            component="span"
                            sx={{
                                fontSize: '0.75rem',
                                fontWeight: 400,
                                color: 'text.secondary',
                                ml: 0.5,
                            }}
                        >
                            건
                        </Box>
                    </Typography>
                </Box>
            </Stack>

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
                <GroupTable title="등급별 (type)" rows={data.byType} />
                <GroupTable title="진영별 (BUY / SELL)" rows={data.byOriginSide} />
            </Stack>
        </Box>
    );
}

function HorizonCard({horizon, m}: {horizon: string; m: HorizonMetrics}) {
    const meanColor = m.meanReturn == null ? 'text.secondary' : m.meanReturn > 0 ? 'success.main' : 'error.main';
    // 신호 평균 − 시장 평균 (초과수익). 양수면 신호가 시장을 이김.
    const excess = (m.meanReturn != null && m.marketMeanReturn != null) ? (m.meanReturn - m.marketMeanReturn) : null;
    const excessColor = excess == null ? 'text.secondary' : excess > 0 ? 'success.main' : 'error.main';
    return (
        <Paper sx={{p: 2, flexGrow: 1}} variant="outlined">
            <Typography variant="overline" color="text.secondary">{horizon} ({m.horizon})</Typography>
            <Typography variant="caption" display="block">평가 가능: {m.evaluable}건</Typography>
            <Box sx={{my: 1}}>
                <Typography variant="body2">신호 평균 수익률</Typography>
                <Typography variant="h6" sx={{color: meanColor}}>
                    {fmtPct(m.meanReturn, 2)}
                </Typography>
            </Box>
            <Box sx={{display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1}}>
                <KV label="시장 평균" value={fmtPct(m.marketMeanReturn, 2)} />
                <Box>
                    <Typography variant="caption" color="text.secondary">초과수익 (신호−시장)</Typography>
                    <Typography variant="body2" sx={{color: excessColor, fontWeight: 600}}>
                        {fmtPctSigned(excess)}
                    </Typography>
                </Box>
            </Box>
            <Box sx={{display: 'flex', gap: 2, flexWrap: 'wrap'}}>
                <KV label="적중률" value={fmtPct(m.hitRate, 1)} />
                <KV label="표준편차" value={fmtPct(m.stdDev, 2)} />
                <KV label="최대" value={fmtPct(m.maxReturn, 2)} />
                <KV label="최소" value={fmtPct(m.minReturn, 2)} />
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
    // 1d/5d/20d × (신호 평균 / 시장 평균) 6열 + 그룹·신호수·5d 적중률
    // 신호 컬럼은 적중 색상(녹=성공, 빨=실패) — groupKey 에서 진영 추론해 ReturnCell 의 side 전달.
    // 시장 컬럼은 적중과 무관한 베이스라인이라 한국식 등락 색상(빨=양수, 파=음수) 사용.
    const signalCell = (p: GridRenderCellParams<GroupMetrics>) => (
        <ReturnCell v={p.value as number | null} side={inferSideFromGroup(p.row.groupKey)} type={p.row.groupKey}/>
    );
    const marketCell = (p: GridRenderCellParams<GroupMetrics>) => <MarketPctCell v={p.value as number | null}/>;
    const columns: GridColDef<GroupMetrics>[] = [
        {field: 'groupKey', headerName: '그룹', flex: 1, minWidth: 160},
        {field: 'count', headerName: '신호 수', width: 80, align: 'right', headerAlign: 'right'},
        {field: 'signalMean1dPct', headerName: '신호', width: 100, align: 'right', headerAlign: 'center', renderCell: signalCell},
        {field: 'marketMean1dPct', headerName: '시장', width: 100, align: 'right', headerAlign: 'center', renderCell: marketCell},
        {field: 'signalMean5dPct', headerName: '신호', width: 100, align: 'right', headerAlign: 'center', renderCell: signalCell},
        {field: 'marketMean5dPct', headerName: '시장', width: 100, align: 'right', headerAlign: 'center', renderCell: marketCell},
        {field: 'signalMean20dPct', headerName: '신호', width: 100, align: 'right', headerAlign: 'center', renderCell: signalCell},
        {field: 'marketMean20dPct', headerName: '시장', width: 100, align: 'right', headerAlign: 'center', renderCell: marketCell},
        {field: 'hitRate5d', headerName: '5d 적중률', width: 110, align: 'right', headerAlign: 'right', valueFormatter: (v) => fmtPct(v as number | null, 1)},
    ];
    const columnGroupingModel: GridColumnGroupingModel = [
        {
            groupId: 'h1d', headerName: '1일 후', headerAlign: 'center',
            children: [{field: 'signalMean1dPct'}, {field: 'marketMean1dPct'}],
        },
        {
            groupId: 'h5d', headerName: '5일 후', headerAlign: 'center',
            children: [{field: 'signalMean5dPct'}, {field: 'marketMean5dPct'}],
        },
        {
            groupId: 'h20d', headerName: '20일 후', headerAlign: 'center',
            children: [{field: 'signalMean20dPct'}, {field: 'marketMean20dPct'}],
        },
    ];
    return (
        <Paper sx={{p: 2}} variant="outlined">
            <Typography variant="subtitle2" sx={{mb: 1}}>{title}</Typography>
            <DataGrid
                autoHeight
                rows={rows}
                columns={columns}
                columnGroupingModel={columnGroupingModel}
                getRowId={(r) => r.groupKey}
                density="compact"
                disableRowSelectionOnClick
                showColumnVerticalBorder
                hideFooter={rows.length <= 10}
                initialState={{pagination: {paginationModel: {pageSize: 10}}}}
                pageSizeOptions={[10, 25, 50]}
            />
        </Paper>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// 추천 종목 상세 다이얼로그 (행 클릭 시 표출, 모니터링 에러로그 패턴)
// ════════════════════════════════════════════════════════════════════════════
function SignalDetailDialog({pick, onClose}: {pick: AdminRecommendPickRes | null; onClose: () => void}) {
    return (
        <Dialog open={!!pick} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                {pick && (
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography variant="h6" sx={{fontWeight: 700}}>{pick.stkNm}</Typography>
                        <Typography variant="body2" color="text.secondary">{pick.stkCd}</Typography>
                        <Chip size="small" label={pick.marketType ?? '-'} variant="outlined"/>
                        <Chip size="small" label={pick.originSide ?? '-'} variant="outlined"/>
                        <TypeChip type={pick.type}/>
                    </Stack>
                )}
            </DialogTitle>
            <DialogContent dividers>
                {pick && (
                    <Stack spacing={2}>
                        {/* 수익률 */}
                        <DetailSection title="수익률">
                            <Stack direction="row" spacing={4}>
                                <DetailField label="1d">
                                    <ReturnCell v={pick.ret1d} side={pick.originSide} type={pick.type}/>
                                </DetailField>
                                <DetailField label="5d">
                                    <ReturnCell v={pick.ret5d} side={pick.originSide} type={pick.type}/>
                                </DetailField>
                                <DetailField label="20d">
                                    <ReturnCell v={pick.ret20d} side={pick.originSide} type={pick.type}/>
                                </DetailField>
                            </Stack>
                        </DetailSection>

                        {/* 트리거 (후행 모듈) */}
                        <DetailSection title="트리거 (모듈 격상/격하 신호)">
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <TriggerBox label="PV"            v={pick.pvTrigger}        side={pick.originSide}/>
                                <TriggerBox label="MA"            v={pick.maTrigger}        side={pick.originSide}/>
                                <TriggerBox label="VP"            v={pick.vpTrigger}        side={pick.originSide}/>
                                <TriggerBox label="RSI"           v={pick.rsiTrigger}       side={pick.originSide}/>
                                <TriggerBox label="52주 위치"      v={pick.hl52wTrigger}     side={pick.originSide}/>
                                <TriggerBox label="52주 신고저가 돌파" v={pick.breakoutTrigger} side={pick.originSide}/>
                            </Stack>
                        </DetailSection>

                        {/* Raw 지표 */}
                        <DetailSection title="Raw 지표">
                            <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5}}>
                                <DetailField label="RSI14" value={fmtNum(pick.rsi14, 1)}/>
                                <DetailField label="5일등락%" value={fmtNum(pick.flu5Pct, 2)}/>
                                <DetailField label="당일%" value={fmtNum(pick.todayChangeRate, 2)}/>
                                <DetailField label="MA20위" value={pick.closeAboveMa20 == null ? '-' : (pick.closeAboveMa20 ? '↑' : '↓')}/>
                                <DetailField label="MA5" value={fmtNum(pick.ma5, 0)}/>
                                <DetailField label="MA20" value={fmtNum(pick.ma20, 0)}/>
                                <DetailField label="당일 거래량" value={fmtLong(pick.todayVolume)}/>
                                <DetailField label="20일 평균거래량" value={fmtLong(pick.avg20dVolume)}/>
                            </Box>
                        </DetailSection>

                        {/* 52주 위치 */}
                        <DetailSection title="52주 위치 (Stage Analysis)">
                            <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5}}>
                                <DetailField label="저점거리%" value={fmtNum(pick.distFromLow52w, 1)}/>
                                <DetailField label="고점거리%" value={fmtNum(pick.distFromHigh52w, 1)}/>
                            </Box>
                        </DetailSection>

                        {/* 백테스트 가격 */}
                        <DetailSection title="백테스트 가격">
                            <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5}}>
                                <DetailField label="T일 종가" value={fmtLong(pick.pickPrice)}/>
                                <DetailField label="T+1 시가" value={fmtLong(pick.priceOpen1d)}/>
                            </Box>
                        </DetailSection>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>닫기</Button>
            </DialogActions>
        </Dialog>
    );
}

function DetailSection({title, children}: {title: string; children: React.ReactNode}) {
    return (
        <Box>
            <Typography variant="overline" color="text.secondary" sx={{fontWeight: 700}}>{title}</Typography>
            <Divider sx={{mb: 1, mt: 0.5}}/>
            {children}
        </Box>
    );
}

function DetailField({label, value, children}: {label: string; value?: React.ReactNode; children?: React.ReactNode}) {
    return (
        <Box>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="body2" sx={{fontWeight: 600, fontFamily: 'monospace'}}>
                {children ?? value ?? '-'}
            </Typography>
        </Box>
    );
}

function TriggerBox({label, v, side}: {label: string; v: ModuleTrigger; side: string | null}) {
    return (
        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 160}}>
            <Typography variant="caption" color="text.secondary" sx={{minWidth: 90}}>{label}</Typography>
            <TriggerChip v={v} side={side}/>
        </Box>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// 공통 셀 컴포넌트
// ════════════════════════════════════════════════════════════════════════════
function TypeChip({type}: {type: string | null}) {
    if (!type) return <span>-</span>;
    // 사용자 페이지(RecommendCard.tsx) 색상 기준: BUY계열=error(빨강), SELL계열=info(파랑).
    const color: 'default' | 'error' | 'info' =
        type === 'STRONG_BUY' || type === 'BUY' ? 'error'
        : type === 'STRONG_SELL' || type === 'SELL' ? 'info'
        : 'default';
    const variant = (type === 'STRONG_BUY' || type === 'STRONG_SELL') ? 'filled' : 'outlined';
    return <Chip size="small" label={type} color={color} variant={variant} />;
}

/**
 * 모듈 트리거 칩. PROMOTE/DEMOTE 는 진영(side)에 따라 시장 의미가 정반대다
 * (promoteOnce: BUY→STRONG_BUY, SELL→STRONG_SELL = 해당 진영 신호 *강화*).
 * → 방향 포함 라벨 + 시장심리 색(강세=빨강 / 약세=파랑)으로 표시. MacroEffectChip 과 동일 규칙.
 *  - BUY  + PROMOTE → BUY 격상  (강세, 빨강)
 *  - BUY  + DEMOTE  → BUY 격하  (강세 약화, 파랑)
 *  - SELL + PROMOTE → SELL 격상 (약세, 파랑)
 *  - SELL + DEMOTE  → SELL 격하 (약세 약화, 빨강)
 */
function TriggerChip({v, side}: {v: ModuleTrigger; side: string | null}) {
    if (!v || v === 'NONE' || (side !== 'BUY' && side !== 'SELL')) {
        return <span style={{color: '#999'}}>-</span>;
    }
    const label = `${side} ${v === 'PROMOTE' ? '격상' : '격하'}`;
    // 강세(BUY 격상 / SELL 격하)=빨강, 약세(SELL 격상 / BUY 격하)=파랑
    const bullish = (side === 'BUY') === (v === 'PROMOTE');
    return <Chip size="small" label={label} color={bullish ? 'error' : 'info'} variant="outlined" />;
}

function SignChip({v}: {v: string | null}) {
    if (!v) return <span>-</span>;
    // 전역 색 체계: BUY=빨강(error), SELL=파랑(info).
    const color: 'error' | 'info' | 'default' =
        v === 'BUY' ? 'error' : v === 'SELL' ? 'info' : 'default';
    return <Chip size="small" label={v} color={color} variant="outlined" />;
}

/**
 * 매크로 시나리오를 그날 보정 효과로 환산해 표시.
 * 격상/격하는 진영(BUY/SELL)에 따라 의미가 정반대라, 단순 PROMOTE/DEMOTE 가 아니라
 * **방향까지 포함한 라벨**로 표시해야 오해가 없다(예: DOWN_SELL_SELL = SELL 격상).
 * 색은 시장 심리 기준 — 강세(BUY 격상/SELL 격하)=빨강, 약세(SELL 격상/BUY 격하)=파랑.
 *  - UP_BUY_BUY   → BUY 격상  (강세, 빨강)
 *  - DOWN_BUY_BUY → SELL 격하 (매도신호 완화, 빨강)
 *  - DOWN_SELL_SELL → SELL 격상 (약세, 파랑)
 *  - UP_SELL_SELL → BUY 격하 (상승신호 약화, 파랑)
 *  - 다이버전스(UP_BUY_SELL/DOWN_BUY_SELL)·NEUTRAL·기타 → 유지(-)
 */
function MacroEffectChip({v}: {v: string | null}) {
    const map: Record<string, {label: string; color: 'error' | 'info'}> = {
        UP_BUY_BUY:     {label: 'BUY 격상',  color: 'error'},
        DOWN_BUY_BUY:   {label: 'SELL 격하', color: 'error'},
        DOWN_SELL_SELL: {label: 'SELL 격상', color: 'info'},
        UP_SELL_SELL:   {label: 'BUY 격하',  color: 'info'},
    };
    const e = v ? map[v] : undefined;
    if (!e) return <span style={{color: '#999'}}>-</span>;
    return <Chip size="small" label={e.label} color={e.color} variant="outlined" />;
}

/** 지수 등락률 셀 — 값에 % 부착, 한국장 관례 색(상승=빨강 / 하락=파랑 / 보합·없음=회색). */
function ChangeRateCell({v}: {v: number | null}) {
    if (v == null) return <span style={{color: '#999'}}>-</span>;
    // 사용자 페이지 등락률 컨벤션(renderTradeColor)과 통일: 상승=빨/하락=파, 굵기·monospace 없음.
    const color = v > 0 ? 'error.main' : v < 0 ? 'info.main' : 'text.secondary';
    const sign = v > 0 ? '+' : '';
    return <Box sx={{color}}>{sign}{fmtNum(v, 2)}%</Box>;
}

function FillRate({filled, total}: {filled: number; total: number}) {
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    const color = filled === total ? 'success.main' : filled > 0 ? 'warning.main' : 'text.secondary';
    return <Box sx={{color}}>{filled}/{total} ({pct}%)</Box>;
}

/**
 * 수익률 셀. side 가 'SELL' 이면 음수가 좋은 신호 (매도 성공) → 색상 반전.
 * type 이 'HOLD' 면 관망(포지션 없음)이라 적중 판정 무의미 → 중립색(숫자만 표시).
 * (백테스트 집계는 별개로 HOLD 적중률도 산출 — 행별 색만 중립 처리)
 */
function ReturnCell({v, side, type}: {v: number | null; side: string | null; type?: string | null}) {
    if (v == null) return <span style={{color: '#999'}}>-</span>;
    if (type === 'HOLD') {
        return <Box sx={{color: 'text.secondary', fontFamily: 'monospace'}}>{fmtNum(v, 2)}%</Box>;
    }
    const success = side === 'SELL' ? v < 0 : v > 0;
    const color = success ? 'success.main' : 'error.main';
    return <Box sx={{color, fontFamily: 'monospace'}}>{fmtNum(v, 2)}%</Box>;
}

/**
 * byType 의 groupKey(등급) 또는 byOriginSide 의 groupKey(진영) 에서 매매 진영 추론.
 * STRONG_BUY/BUY → BUY, SELL/STRONG_SELL → SELL, HOLD/UNKNOWN → null (중립).
 * ReturnCell 의 side 인자에 전달해 적중 색상(녹=성공, 빨=실패) 판정에 사용.
 */
function inferSideFromGroup(groupKey: string): 'BUY' | 'SELL' | null {
    if (groupKey === 'STRONG_BUY' || groupKey === 'BUY') return 'BUY';
    if (groupKey === 'SELL' || groupKey === 'STRONG_SELL') return 'SELL';
    return null;
}

/**
 * 시장 평균(베이스라인) 셀. 적중 의미가 없는 단순 시장 등락률.
 * 한국식 등락 색상 적용 — 양수=빨강(error.main), 음수=파랑(info.main), 0=중립.
 */
function MarketPctCell({v}: {v: number | null}) {
    if (v == null) return <span style={{color: '#999'}}>-</span>;
    const color = v > 0 ? 'error.main' : v < 0 ? 'info.main' : 'text.primary';
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

function fmtPctSigned(v: number | null | undefined): string {
    if (v == null || Number.isNaN(v)) return '-';
    return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

/** null 안전 % 포맷. null/NaN 이면 "-" (단위 없음), 아니면 `${v.toFixed(d)}%`. */
function fmtPct(v: number | null | undefined, digits: number = 2): string {
    if (v == null || Number.isNaN(v)) return '-';
    return `${v.toFixed(digits)}%`;
}
