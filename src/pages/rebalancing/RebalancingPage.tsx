import {useEffect, useState} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import Collapse from "@mui/material/Collapse";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import {DataGrid, type GridColDef} from "@mui/x-data-grid";
import BlindText from "../../components/BlindText.tsx";
import BlindToggle from "../../components/BlindToggle.tsx";
import {useBlindMode} from "../../context/BlindModeContext.tsx";
import type {RebalancingStatusRes, RatioDirection} from "../../type/RebalancingType.ts";
import {saveRebalancingSetting, fetchRebalancingStatus, deleteRebalancingSetting} from "../../api/rebalancing/RebalancingApi.ts";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import ApiKeyRequiredEmptyState from "../../components/ApiKeyRequiredEmptyState.tsx";
import {useApiKeyStatus} from "../../context/ApiKeyStatusContext.tsx";

const assetTypeLabel: Record<string, string> = {STOCK: '주식', CRYPTO: '코인', CASH: '현금'};

export default function RebalancingPage() {
    const {apiBrokers, myApiBrokerIds, validBrokerIds, isLoaded: apiKeyLoaded} = useApiKeyStatus();
    const [status, setStatus] = useState<RebalancingStatusRes | null>(null);
    const [stockRatio, setStockRatio] = useState("");
    const [stockDirection, setStockDirection] = useState<RatioDirection>("MAX");
    const [cryptoRatio, setCryptoRatio] = useState("");
    const [cryptoDirection, setCryptoDirection] = useState<RatioDirection>("MAX");
    const [cashRatio, setCashRatio] = useState("");
    const [cashDirection, setCashDirection] = useState<RatioDirection>("MIN");
    const [maxStockRatio, setMaxStockRatio] = useState("");
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<{stockRatio?: boolean; cryptoRatio?: boolean; cashRatio?: boolean; maxStockRatio?: boolean}>({});
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [pollError, setPollError] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const {isBlind} = useBlindMode();
    const [showTable, setShowTable] = useState(!isBlind);

    const loadStatus = async (silent: boolean = false) => {
        try {
            const res = await fetchRebalancingStatus(silent ? { skipGlobalError: true } : undefined);
            if (res.result) {
                setStatus(res.result);
                setStockRatio(String(res.result.setting.stockRatio));
                setStockDirection(res.result.setting.stockDirection);
                setCryptoRatio(String(res.result.setting.cryptoRatio));
                setCryptoDirection(res.result.setting.cryptoDirection);
                setCashRatio(String(res.result.setting.cashRatio));
                setCashDirection(res.result.setting.cashDirection);
                setMaxStockRatio(String(res.result.setting.maxStockRatio));
                setLastUpdated(new Date());
                setPollError(false);
            }
        } catch (error) {
            console.error(error);
            if (silent) setPollError(true);
            // 설정 없음
        } finally {
            setLoaded(true);
        }
    };

    useEffect(() => {
        setShowTable(!isBlind);
    }, [isBlind]);

    useEffect(() => {
        if (!apiKeyLoaded) return;

        const hasMissing = [...myApiBrokerIds].some(id => !validBrokerIds.has(id));
        if (hasMissing) return;

        let timeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;

        (async () => {
            await loadStatus();

            const now = Date.now();
            const waitTime = 60_000 - (now % 60_000);

            timeout = setTimeout(() => {
                loadStatus(true);
                interval = setInterval(() => {
                    loadStatus(true);
                }, 60_000);
            }, waitTime + 200);
        })();

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, [apiKeyLoaded, myApiBrokerIds, validBrokerIds]);

    const handleSave = async () => {
        const fieldErrs: {stockRatio?: boolean; cryptoRatio?: boolean; cashRatio?: boolean; maxStockRatio?: boolean} = {};
        if (!stockRatio) fieldErrs.stockRatio = true;
        if (!cryptoRatio) fieldErrs.cryptoRatio = true;
        if (!cashRatio) fieldErrs.cashRatio = true;
        if (!maxStockRatio) fieldErrs.maxStockRatio = true;
        if (Object.keys(fieldErrs).length > 0) {
            setFieldErrors(fieldErrs);
            setError("모든 비중을 입력해주세요.");
            return;
        }
        if (Number(maxStockRatio) <= 0 || Number(maxStockRatio) > 100) {
            setFieldErrors({maxStockRatio: true});
            setError("종목 최대 비중을 1~100% 사이로 입력해주세요.");
            return;
        }
        setFieldErrors({});
        setError("");
        try {
            await saveRebalancingSetting({
                stockRatio: Number(stockRatio), stockDirection,
                cryptoRatio: Number(cryptoRatio), cryptoDirection,
                cashRatio: Number(cashRatio), cashDirection,
                maxStockRatio: Number(maxStockRatio)
            });
            setEditMode(false);
            await loadStatus();
        } catch (err) {
            console.error(err);
            const axiosErr = err as {response?: {status?: number; data?: {code?: string; result?: Record<string, string>}}};
            if (axiosErr.response?.status === 400 && axiosErr.response?.data?.code === 'VALIDATION_4001') {
                const result = axiosErr.response.data.result ?? {};
                const serverFieldErrs: typeof fieldErrs = {};
                const messages: string[] = [];
                (['stockRatio', 'cryptoRatio', 'cashRatio', 'maxStockRatio'] as const).forEach(key => {
                    if (result[key]) { serverFieldErrs[key] = true; messages.push(result[key]); }
                });
                setFieldErrors(serverFieldErrs);
                setError(messages.join(' ') || '입력값을 확인해주세요.');
                return;
            }
            setError("설정 저장에 실패했습니다.");
        }
    };

    const handleDelete = async () => {
        try {
            await deleteRebalancingSetting();
            setStatus(null);
            setStockRatio(""); setCryptoRatio(""); setCashRatio(""); setMaxStockRatio("");
        } catch (error) {
            console.error(error);
            setError("설정 삭제에 실패했습니다.");
        }
        setDeleteOpen(false);
    };

    const columns: GridColDef[] = [
        {field: 'stkNm', headerName: '종목명', flex: 1, minWidth: 120},
        {field: 'brokerName', headerName: '증권사', width: 100},
        {field: 'currentRatio', headerName: '현재 비중', width: 100, align: 'right', headerAlign: 'right',
            renderCell: (params) => <Typography variant="body2" color="error.main" sx={{fontWeight: 600}}>{params.value}%</Typography>},
        {field: 'maxRatio', headerName: '상한', width: 80, align: 'right', headerAlign: 'right',
            renderCell: (params) => <Typography variant="body2">{params.value}%</Typography>},
        {field: 'sellQuantity', headerName: '매도 제안(주)', width: 110, align: 'right', headerAlign: 'right',
            renderCell: (params) => <BlindText><Typography variant="body2" sx={{fontWeight: 600}}>{params.value.toLocaleString()}주</Typography></BlindText>},
        {field: 'sellAmount', headerName: '매도 제안(금액)', width: 130, align: 'right', headerAlign: 'right',
            renderCell: (params) => <BlindText><Typography variant="body2">{params.value.toLocaleString()}원</Typography></BlindText>},
    ];

    const directionLabel = (d: string) => d === 'MIN' ? '이상' : '이하';

    const missingBrokerNames = apiBrokers
        .filter(b => myApiBrokerIds.has(b.id) && !validBrokerIds.has(b.id))
        .map(b => b.name);

    if (apiKeyLoaded && missingBrokerNames.length > 0) {
        const joined = missingBrokerNames.join(', ');
        return (
            <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}, py: 4}}>
                <Typography component="h2" variant="h6" sx={{mb: 3}}>리밸런싱</Typography>
                <ApiKeyRequiredEmptyState
                    brokerName={joined}
                    description={`자산 비율을 정확히 계산하려면 ${joined} API Key 를 등록해주세요.`}
                />
            </Box>
        );
    }

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
                <Typography component="h2" variant="h6">포트폴리오 리밸런싱</Typography>
                <BlindToggle/>
            </Box>

            {/* 비중 설정 스켈레톤 */}
            {!loaded && (
                <>
                    <Card variant="outlined" sx={{mb: 3}}>
                        <CardContent>
                            <Skeleton width={80} height={24} sx={{mb: 2}}/>
                            <Grid container spacing={2}>
                                {Array.from({length: 4}).map((_, i) => (
                                    <Grid key={i} size={{xs: 6, md: 3}}>
                                        <Box sx={{p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center'}}>
                                            <Skeleton width={40} sx={{mx: 'auto'}}/>
                                            <Skeleton width={60} height={32} sx={{mx: 'auto', my: 0.5}}/>
                                            <Skeleton variant="rounded" width={40} height={20} sx={{mx: 'auto'}}/>
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>
                        </CardContent>
                    </Card>
                    <Card variant="outlined" sx={{mb: 3}}>
                        <CardContent>
                            <Skeleton width={100} height={24} sx={{mb: 2}}/>
                            <Stack spacing={2}>
                                {Array.from({length: 3}).map((_, i) => (
                                    <Box key={i}>
                                        <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 0.5}}>
                                            <Skeleton width={80}/>
                                            <Skeleton width={200}/>
                                        </Box>
                                        <Skeleton variant="rounded" height={8} sx={{borderRadius: 4}}/>
                                    </Box>
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* 비중 설정 */}
            {loaded && <Card variant="outlined" sx={{mb: 3}}>
                <CardContent>
                    <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                            <Typography variant="body2" sx={{fontWeight: 600, color: 'text.secondary'}}>비중 설정</Typography>
                            <Tooltip title="매시 정각에 비중을 확인하여 조건 위반 시 알림이 발송됩니다. 알림 설정에서 on/off 가능합니다." placement="right">
                                <HelpOutlineIcon sx={{fontSize: 16, color: 'text.secondary'}}/>
                            </Tooltip>
                        </Box>
                        <Box sx={{display: 'flex', gap: 1}}>
                            {status && !editMode && (
                                <Button size="small" startIcon={<EditIcon/>} onClick={() => setEditMode(true)}>수정</Button>
                            )}
                            {status && (
                                <Button size="small" color="error" startIcon={<DeleteIcon/>} onClick={() => setDeleteOpen(true)}>삭제</Button>
                            )}
                        </Box>
                    </Box>

                    {status && !editMode ? (
                        /* 텍스트 보기 모드 - 카드 그리드 */
                        <Grid container spacing={2}>
                            {[
                                {label: '주식', ratio: status.setting.stockRatio, direction: status.setting.stockDirection},
                                {label: '코인', ratio: status.setting.cryptoRatio, direction: status.setting.cryptoDirection},
                                {label: '현금', ratio: status.setting.cashRatio, direction: status.setting.cashDirection},
                                {label: '종목 최대', ratio: status.setting.maxStockRatio, direction: 'MAX' as RatioDirection},
                            ].map((item) => (
                                <Grid key={item.label} size={{xs: 6, md: 3}}>
                                    <Box sx={{
                                        p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider',
                                        textAlign: 'center', bgcolor: 'background.paper',
                                    }}>
                                        <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                                        <Typography variant="h5" sx={{fontWeight: 700, my: 0.5}}>{item.ratio}%</Typography>
                                        <Chip
                                            label={item.label === '종목 최대' ? '이하' : directionLabel(item.direction)}
                                            size="small"
                                            color={item.direction === 'MIN' ? 'error' : 'info'}
                                            variant="outlined"
                                            sx={{fontSize: 11}}
                                        />
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    ) : (
                        /* 편집 모드 - 카드 그리드 */
                        <>
                            <Grid container spacing={2} sx={{mb: 2}}>
                                {[
                                    {label: '주식', key: 'stockRatio' as const, ratio: stockRatio, setRatio: setStockRatio, direction: stockDirection, setDirection: setStockDirection},
                                    {label: '코인', key: 'cryptoRatio' as const, ratio: cryptoRatio, setRatio: setCryptoRatio, direction: cryptoDirection, setDirection: setCryptoDirection},
                                    {label: '현금', key: 'cashRatio' as const, ratio: cashRatio, setRatio: setCashRatio, direction: cashDirection, setDirection: setCashDirection},
                                ].map((item) => (
                                    <Grid key={item.label} size={{xs: 6, md: 3}}>
                                        <Box sx={{p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center'}}>
                                            <Typography variant="caption" color="text.secondary" sx={{mb: 1, display: 'block'}}>{item.label}</Typography>
                                            <TextField size="small" value={item.ratio}
                                                onChange={(e) => { item.setRatio(e.target.value.replace(/[^0-9]/g, '')); if (fieldErrors[item.key]) setFieldErrors(prev => ({...prev, [item.key]: undefined})); }}
                                                error={!!fieldErrors[item.key]}
                                                sx={{width: 80, mb: 1}} slotProps={{htmlInput: {inputMode: 'numeric', maxLength: 3, style: {textAlign: 'center', fontWeight: 700, fontSize: '1.2rem'}}}}/>
                                            <Typography variant="body2" sx={{mb: 1}}>%</Typography>
                                            <TextField select size="small" value={item.direction} onChange={(e) => item.setDirection(e.target.value as RatioDirection)}
                                                sx={{width: 90}}>
                                                <MenuItem value="MIN">이상</MenuItem>
                                                <MenuItem value="MAX">이하</MenuItem>
                                            </TextField>
                                        </Box>
                                    </Grid>
                                ))}
                                <Grid size={{xs: 6, md: 3}}>
                                    <Box sx={{p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center'}}>
                                        <Typography variant="caption" color="text.secondary" sx={{mb: 1, display: 'block'}}>종목 최대</Typography>
                                        <TextField size="small" value={maxStockRatio}
                                            onChange={(e) => { setMaxStockRatio(e.target.value.replace(/[^0-9]/g, '')); if (fieldErrors.maxStockRatio) setFieldErrors(prev => ({...prev, maxStockRatio: undefined})); }}
                                            error={!!fieldErrors.maxStockRatio}
                                            sx={{width: 80, mb: 1}} slotProps={{htmlInput: {inputMode: 'numeric', maxLength: 3, style: {textAlign: 'center', fontWeight: 700, fontSize: '1.2rem'}}}}/>
                                        <Typography variant="body2" sx={{mb: 1}}>%</Typography>
                                        <Chip label="이하" size="small" color="info" variant="outlined" sx={{fontSize: 11}}/>
                                    </Box>
                                </Grid>
                            </Grid>
                            {error && <Typography variant="caption" color="error" sx={{mb: 1, display: 'block'}}>{error}</Typography>}
                            <Stack direction="row" spacing={1}>
                                <Button variant="contained" size="small" startIcon={<SaveIcon/>} onClick={handleSave}>저장</Button>
                                {status && <Button size="small" onClick={() => setEditMode(false)}>취소</Button>}
                            </Stack>
                        </>
                    )}
                </CardContent>
            </Card>}

            {status && (
                <>
                    <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: 1}}>
                        <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
                    </Box>

                    {/* 현재 비중 현황 */}
                    <Card variant="outlined" sx={{mb: 3}}>
                        <CardContent>
                            <Typography variant="body2" sx={{fontWeight: 600, color: 'text.secondary', mb: 2}}>현재 비중 현황</Typography>
                            <Stack spacing={2}>
                                {[
                                    {label: '주식', current: status.currentRatios.stockRatio, target: status.setting.stockRatio, direction: status.setting.stockDirection, amount: status.currentRatios.stockAmount},
                                    {label: '코인', current: status.currentRatios.cryptoRatio, target: status.setting.cryptoRatio, direction: status.setting.cryptoDirection, amount: status.currentRatios.cryptoAmount},
                                    {label: '현금', current: status.currentRatios.cashRatio, target: status.setting.cashRatio, direction: status.setting.cashDirection, amount: status.currentRatios.cashAmount},
                                ].map((item) => {
                                    const isViolation = item.direction === 'MAX' ? item.current > item.target : item.current < item.target;
                                    return (
                                        <Box key={item.label}>
                                            <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 0.5}}>
                                                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                                    <Typography variant="body2" sx={{fontWeight: 600}}>{item.label}</Typography>
                                                    {isViolation
                                                        ? <Chip label={item.direction === 'MIN' ? '미달' : '초과'} size="small" color="error" variant="outlined" sx={{height: 20}}/>
                                                        : <Chip label="달성" size="small" color="success" variant="outlined" sx={{height: 20}}/>
                                                    }
                                                </Box>
                                                <Typography variant="body2">
                                                    <BlindText>{item.current}% ({item.amount.toLocaleString()}원)</BlindText> / 목표 {item.target}% {directionLabel(item.direction)}
                                                </Typography>
                                            </Box>
                                            <LinearProgress
                                                variant="determinate"
                                                value={!isViolation ? 100 : Math.min(item.current, 100)}
                                                color={isViolation ? 'error' : 'success'}
                                                sx={{height: 8, borderRadius: 4}}
                                            />
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </CardContent>
                    </Card>

                    {/* 자산 유형 경고 */}
                    {status.overweightAssets.length > 0 && (
                        <Box sx={{mb: 3}}>
                            {status.overweightAssets.map((item) => {
                                const isCash = item.assetType === 'CASH';
                                let message;
                                if (item.direction === 'MIN') {
                                    message = isCash
                                        ? <>{assetTypeLabel[item.assetType]} 비중이 목표({item.targetRatio}% 이상)에 미달합니다. 약 <BlindText><b>{item.excessAmount.toLocaleString()}원</b></BlindText> 규모의 자산 처분을 검토하세요.</>
                                        : <>{assetTypeLabel[item.assetType]} 비중이 목표({item.targetRatio}% 이상)에 미달합니다. 약 <BlindText><b>{item.excessAmount.toLocaleString()}원</b></BlindText> 추가 매수를 검토하세요.</>;
                                } else {
                                    message = isCash
                                        ? <>{assetTypeLabel[item.assetType]} 비중이 목표({item.targetRatio}% 이하)를 초과했습니다. 약 <BlindText><b>{item.excessAmount.toLocaleString()}원</b></BlindText> 규모의 투자를 검토하세요.</>
                                        : <>{assetTypeLabel[item.assetType]} 비중이 목표({item.targetRatio}% 이하)를 초과했습니다. 약 <BlindText><b>{item.excessAmount.toLocaleString()}원</b></BlindText> 처분을 검토하세요.</>;
                                }
                                return (
                                    <Alert severity="warning" key={item.assetType} sx={{mb: 1}}>
                                        {message}
                                    </Alert>
                                );
                            })}
                        </Box>
                    )}

                    {/* 종목 비중 초과 */}
                    {status.overweightStocks.length > 0 && (
                        <Card variant="outlined" sx={{mb: 3}}>
                            <CardContent>
                                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
                                    <Typography variant="body2" sx={{fontWeight: 600, color: 'text.secondary'}}>
                                        종목 비중 초과 (상한 {status.setting.maxStockRatio}%)
                                    </Typography>
                                    <Button
                                        size="small"
                                        endIcon={showTable ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
                                        onClick={() => setShowTable(!showTable)}
                                    >
                                        {showTable ? '접기' : '펼치기'}
                                    </Button>
                                </Box>
                                <Collapse in={showTable}>
                                    <DataGrid
                                        rows={status.overweightStocks.map((s, i) => ({...s, id: i}))}
                                        columns={columns}
                                        disableRowSelectionOnClick
                                        pageSizeOptions={[10, 20, 50, 100]}
                                        initialState={{pagination: {paginationModel: {pageSize: 10}}}}
                                        slotProps={{
                                            loadingOverlay: {
                                                variant: 'skeleton',
                                                noRowsVariant: 'skeleton',
                                            },
                                        }}
                                        localeText={{noRowsLabel: '데이터가 없습니다.'}}
                                        sx={{'& .MuiDataGrid-cell': {display: 'flex', alignItems: 'center'}, border: 'none'}}
                                    />
                                </Collapse>
                            </CardContent>
                        </Card>
                    )}

                    {status.overweightAssets.length === 0 && status.overweightStocks.length === 0 && (
                        <Alert severity="success">모든 비중이 목표 범위 내에 있습니다.</Alert>
                    )}
                </>
            )}

            <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>리밸런싱 설정 삭제</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">리밸런싱 설정을 삭제하시겠습니까? 알림이 더 이상 발송되지 않습니다.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteOpen(false)}>취소</Button>
                    <Button color="error" onClick={handleDelete}>삭제</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
