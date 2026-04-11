import {useEffect, useRef, useState} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import {fetchAssetDashboard} from "../../api/asset/AssetDashboardApi.ts";
import type {AssetDashboardRes} from "../../type/AssetDashboardType.ts";
import AssetSummaryCard from "./AssetSummaryCard.tsx";
import BrokerSummaryCards from "./BrokerSummaryCards.tsx";
import AssetAllocationChart from "./AssetAllocationChart.tsx";
import AssetGroupDetail from "./AssetGroupDetail.tsx";
import BlindToggle from "../../components/BlindToggle.tsx";
import BlindText from "../../components/BlindText.tsx";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import {goalTypeLabel} from "../../type/GoalType.ts";

export default function AssetDashboard() {
    const [data, setData] = useState<AssetDashboardRes | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<'stock' | 'crypto' | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const lastUpdatedRef = useRef<Date | null>(null);

    const loadDashboard = async () => {
        try {
            const res = await fetchAssetDashboard();
            if (res.code === "0000") {
                setData(res.result);
                const now = new Date();
                lastUpdatedRef.current = now;
                setLastUpdated(now);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;

        (async () => {
            await loadDashboard();
            setLoading(false);

            const now = Date.now();
            const waitTime = 60_000 - (now % 60_000);

            timeout = setTimeout(() => {
                loadDashboard();
                interval = setInterval(() => {
                    loadDashboard();
                }, 60_000);
            }, waitTime + 200);
        })();

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, []);

    if (loading) {
        return (
            <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300}}>
                <CircularProgress/>
            </Box>
        );
    }

    if (!data) {
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

    const stockTotal = data.stockSummary.evltAmt;
    const cryptoTotal = data.cryptoSummary.evltAmt;

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 2}}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <Typography component="h2" variant="h6">
                        통합 자산 대시보드
                    </Typography>
                    <BlindToggle/>
                </Box>
                {lastUpdated && (
                    <Typography variant="caption" color="text.secondary">
                        {lastUpdated.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})} 기준
                    </Typography>
                )}
            </Box>

            <AssetSummaryCard
                totalAsset={data.totalAsset}
                totalEvltAmt={data.totalEvltAmt}
                totalPurAmt={data.totalPurAmt}
                totalEvltPl={data.totalEvltPl}
                totalPrftRt={data.totalPrftRt}
                totalCash={data.totalCash}
            />

            {data?.realizedPnl && (
                <Card variant="outlined" sx={{mb: 3}}>
                    <CardContent>
                        <Typography variant="body2" sx={{color: 'text.secondary', mb: 1.5, fontWeight: 600}}>
                            실현손익
                        </Typography>
                        <Stack direction="row" spacing={4} divider={<Divider orientation="vertical" flexItem/>}>
                            <Box>
                                <Typography variant="body2" sx={{color: 'text.secondary'}}>당월</Typography>
                                <Typography variant="body1" sx={{
                                    fontWeight: 600,
                                    color: data?.realizedPnl.currentMonthPnl > 0 ? 'error.main' : data?.realizedPnl.currentMonthPnl < 0 ? 'info.main' : 'text.primary'
                                }}>
                                    <BlindText>{data?.realizedPnl.currentMonthPnl > 0 ? '+' : ''}{data?.realizedPnl.currentMonthPnl.toLocaleString()}원</BlindText>
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="body2" sx={{color: 'text.secondary'}}>올해</Typography>
                                <Typography variant="body1" sx={{
                                    fontWeight: 600,
                                    color: data?.realizedPnl.ytdPnl > 0 ? 'error.main' : data?.realizedPnl.ytdPnl < 0 ? 'info.main' : 'text.primary'
                                }}>
                                    <BlindText>{data?.realizedPnl.ytdPnl > 0 ? '+' : ''}{data?.realizedPnl.ytdPnl.toLocaleString()}원</BlindText>
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="body2" sx={{color: 'text.secondary'}}>전체</Typography>
                                <Typography variant="body1" sx={{
                                    fontWeight: 600,
                                    color: data?.realizedPnl.allTimePnl > 0 ? 'error.main' : data?.realizedPnl.allTimePnl < 0 ? 'info.main' : 'text.primary'
                                }}>
                                    <BlindText>{data?.realizedPnl.allTimePnl > 0 ? '+' : ''}{data?.realizedPnl.allTimePnl.toLocaleString()}원</BlindText>
                                </Typography>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>
            )}

            {/* 투자 목표 (표시만) */}
            {(data?.goals ?? []).length > 0 && (
                <Card variant="outlined" sx={{mb: 3}}>
                    <CardContent>
                        <Typography variant="body2" sx={{color: 'text.secondary', fontWeight: 600, mb: 1.5}}>
                            투자 목표
                        </Typography>
                        <Stack spacing={2}>
                            {(data?.goals ?? []).map((goal) => {
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

            <BrokerSummaryCards brokerSummaries={data.brokerSummaries} brokerPnlList={data?.realizedPnl?.brokerPnlList}/>

            <AssetAllocationChart
                stockTotal={stockTotal}
                cryptoTotal={cryptoTotal}
                cashTotal={data.totalCash}
                totalAsset={data.totalAsset}
                selectedGroup={selectedGroup}
                onGroupSelect={setSelectedGroup}
            />

            {selectedGroup === 'stock' && data.stockSummary.holdings.length > 0 && (
                <AssetGroupDetail group="stock" summary={data.stockSummary}/>
            )}

            {selectedGroup === 'crypto' && data.cryptoSummary.holdings.length > 0 && (
                <AssetGroupDetail group="crypto" summary={data.cryptoSummary}/>
            )}
        </Box>
    );
}
