import {useState} from "react";
import {usePollingQuery} from "../../lib/pollingQuery.ts";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import {fetchAssetDashboard} from "../../api/asset/AssetDashboardApi.ts";
import type {AssetDashboardRes} from "../../type/AssetDashboardType.ts";
import AssetSummaryCard from "./AssetSummaryCard.tsx";
import BrokerSummaryCards from "./BrokerSummaryCards.tsx";
import AssetAllocationChart from "./AssetAllocationChart.tsx";
import AssetGroupDetail from "./AssetGroupDetail.tsx";
import BlindToggle from "../../components/BlindToggle.tsx";
import BlindText from "../../components/BlindText.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import {goalTypeLabel} from "../../type/GoalType.ts";
import ApiKeyRequiredEmptyState from "../../components/ApiKeyRequiredEmptyState.tsx";
import {useApiKeyStatus} from "../../context/ApiKeyStatusContext.tsx";

export default function AssetDashboard() {
    const {apiBrokers, myApiBrokerIds, validBrokerIds, isLoaded: apiKeyLoaded} = useApiKeyStatus();
    const [selectedGroup, setSelectedGroup] = useState<'stock' | 'crypto' | null>(null);

    const hasMissing = apiKeyLoaded && [...myApiBrokerIds].some(id => !validBrokerIds.has(id));

    const {data, isLoading, lastUpdated, pollError} = usePollingQuery<AssetDashboardRes>(
        ['assetDashboard'],
        (config) => fetchAssetDashboard(config),
        {enabled: apiKeyLoaded && !hasMissing},
    );
    const loading = !apiKeyLoaded ? true : hasMissing ? false : (isLoading && !data);

    if (!loading && !data) {
        return (
            <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
                <Typography component="h2" variant="h6" sx={{mb: 2}}>
                    통합 자산 대시보드
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    자산 데이터를 불러올 수 없습니다.
                </Typography>
            </Box>
        );
    }

    const missingBrokerNames = apiBrokers
        .filter(b => myApiBrokerIds.has(b.id) && !validBrokerIds.has(b.id))
        .map(b => b.name);

    if (apiKeyLoaded && missingBrokerNames.length > 0) {
        const joined = missingBrokerNames.join(', ');
        return (
            <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}, py: 4}}>
                <Typography component="h2" variant="h6" sx={{mb: 3}}>통합 자산 대시보드</Typography>
                <ApiKeyRequiredEmptyState
                    brokerName={joined}
                    description={`통합 자산을 정확히 계산하려면 ${joined} API Key 를 등록해주세요.`}
                />
            </Box>
        );
    }

    const stockTotal = data?.stockSummary.evltAmt ?? 0;
    const cryptoTotal = data?.cryptoSummary.evltAmt ?? 0;

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 2}}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <Typography component="h2" variant="h6">
                        통합 자산 대시보드
                    </Typography>
                    <BlindToggle/>
                </Box>
                {!loading && <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>}
            </Box>

            <AssetSummaryCard
                totalAsset={data?.totalAsset ?? 0}
                totalEvltAmt={data?.totalEvltAmt ?? 0}
                totalPurAmt={data?.totalPurAmt ?? 0}
                totalEvltPl={data?.totalEvltPl ?? 0}
                totalPrftRt={data?.totalPrftRt ?? '0'}
                totalCash={data?.totalCash ?? 0}
                loading={loading}
            />

            {/* 실현손익 */}
            {(loading || data?.realizedPnl) && (
                <Card variant="outlined" sx={{mb: 3}}>
                    <CardContent>
                        <Typography variant="body2" sx={{color: 'text.secondary', mb: 1.5, fontWeight: 600}}>
                            실현손익
                        </Typography>
                        <Stack direction="row" spacing={4} divider={<Divider orientation="vertical" flexItem/>}>
                            {(['당월', '올해', '전체'] as const).map((label, i) => {
                                const value = data?.realizedPnl
                                    ? [data.realizedPnl.currentMonthPnl, data.realizedPnl.ytdPnl, data.realizedPnl.allTimePnl][i]
                                    : 0;
                                return (
                                    <Box key={label}>
                                        <Typography variant="body2" sx={{color: 'text.secondary'}}>{label}</Typography>
                                        <Typography variant="body1" sx={{
                                            fontWeight: 600,
                                            color: loading ? undefined : (value > 0 ? 'error.main' : value < 0 ? 'info.main' : 'text.primary')
                                        }}>
                                            {loading
                                                ? <Skeleton width={120}/>
                                                : <BlindText>{value > 0 ? '+' : ''}{value.toLocaleString()}원</BlindText>}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Stack>
                    </CardContent>
                </Card>
            )}

            {/* 투자 목표 */}
            {(loading || (data?.goals ?? []).length > 0) && (
                <Card variant="outlined" sx={{mb: 3}}>
                    <CardContent>
                        <Typography variant="body2" sx={{color: 'text.secondary', fontWeight: 600, mb: 1.5}}>
                            투자 목표
                        </Typography>
                        <Stack spacing={2}>
                            {loading ? (
                                Array.from({length: 3}).map((_, i) => (
                                    <Box key={i}>
                                        <Skeleton width={150} height={24} sx={{mb: 0.5}}/>
                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 0.5}}>
                                            <Skeleton variant="rounded" sx={{flex: 1, height: 8}}/>
                                            <Skeleton width={45}/>
                                        </Box>
                                        <Skeleton width={200}/>
                                    </Box>
                                ))
                            ) : (data?.goals ?? []).map((goal) => {
                                const rate = Math.min(goal.achievementRate, 100);
                                const isOver = goal.achievementRate >= 100;
                                return (
                                    <Box key={goal.id}>
                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 0.5}}>
                                            <Typography variant="body2" sx={{fontWeight: 600}}>
                                                {goalTypeLabel[goal.type]}
                                            </Typography>
                                            {goal.isAchieved && <Chip label="달성 완료" size="small" color="success" variant="outlined"/>}
                                        </Box>
                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 0.5}}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={rate}
                                                color={isOver ? 'success' : 'primary'}
                                                sx={{flex: 1, height: 8, borderRadius: 4}}
                                            />
                                            <Typography variant="caption" sx={{fontWeight: 600, minWidth: 45, textAlign: 'right'}}>
                                                {goal.achievementRate.toFixed(1)}%
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">
                                            <BlindText>{goal.currentAmount.toLocaleString()}원 / {goal.targetAmount.toLocaleString()}원</BlindText>
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Stack>
                    </CardContent>
                </Card>
            )}

            {/* 증권사/거래소별 현황 */}
            {loading ? (
                <Box sx={{mb: 3}}>
                    <Typography component="h2" variant="subtitle2" sx={{mb: 1.5}}>
                        증권사 / 거래소별 현황
                    </Typography>
                    <Grid container spacing={2}>
                        {Array.from({length: 3}).map((_, i) => (
                            <Grid key={i} size={{xs: 12, sm: 6, md: 4}}>
                                <Card variant="outlined" sx={{height: '100%'}}>
                                    <CardContent sx={{pb: '16px !important'}}>
                                        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5}}>
                                            <Skeleton width={80} height={24}/>
                                            <Skeleton variant="rounded" width={40} height={20}/>
                                        </Box>
                                        <Skeleton width={60} height={20}/>
                                        <Skeleton width={140} height={32} sx={{mb: 1.5}}/>
                                        <Divider sx={{mb: 1.5}}/>
                                        <Box sx={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1}}>
                                            {Array.from({length: 4}).map((_, j) => (
                                                <Box key={j}>
                                                    <Skeleton width={50}/>
                                                    <Skeleton width={100}/>
                                                </Box>
                                            ))}
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            ) : (
                <BrokerSummaryCards brokerSummaries={data!.brokerSummaries} brokerPnlList={data?.realizedPnl?.brokerPnlList}/>
            )}

            {/* 자산 배분 차트 */}
            {loading ? (
                <Card variant="outlined" sx={{mb: 3}}>
                    <CardContent>
                        <Skeleton width={120} height={28} sx={{mb: 2}}/>
                        <Box sx={{display: 'flex', justifyContent: 'center', py: 3}}>
                            <Skeleton variant="circular" width={240} height={240}/>
                        </Box>
                    </CardContent>
                </Card>
            ) : (
                <AssetAllocationChart
                    stockTotal={stockTotal}
                    cryptoTotal={cryptoTotal}
                    cashTotal={data!.totalCash}
                    totalAsset={data!.totalAsset}
                    selectedGroup={selectedGroup}
                    onGroupSelect={setSelectedGroup}
                />
            )}

            {!loading && selectedGroup === 'stock' && data!.stockSummary.holdings.length > 0 && (
                <AssetGroupDetail group="stock" summary={data!.stockSummary}/>
            )}

            {!loading && selectedGroup === 'crypto' && data!.cryptoSummary.holdings.length > 0 && (
                <AssetGroupDetail group="crypto" summary={data!.cryptoSummary}/>
            )}
        </Box>
    );
}
