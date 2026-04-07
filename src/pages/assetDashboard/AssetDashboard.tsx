import {useEffect, useRef, useState} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import {fetchAssetDashboard} from "../../api/asset/AssetDashboardApi.ts";
import type {AssetDashboardRes} from "../../type/AssetDashboardType.ts";
import AssetSummaryCard from "./AssetSummaryCard.tsx";
import AssetAllocationChart from "./AssetAllocationChart.tsx";
import AssetGroupDetail from "./AssetGroupDetail.tsx";

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
                <Typography component="h2" variant="h6">
                    통합 자산 대시보드
                </Typography>
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
