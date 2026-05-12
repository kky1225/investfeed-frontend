import {Box, Chip, Tooltip} from "@mui/material";
import Typography from "@mui/material/Typography";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import {useEffect, useMemo, useRef, useState} from "react";
import {MarketType} from "../../type/timeType.ts";
import {fetchMarketInfo, getServerNow, getServerOffset} from "../../lib/serverTime.ts";
import {
    fetchRecommendList,
    fetchRecommendListStream,
    fetchRecommendSetting,
    saveRecommendSetting,
} from "../../api/recommend/RecommendApi.ts";
import {
    RecommendListItem,
    RecommendListRes,
    RecommendListStream,
    RecommendListStreamReq,
    RecommendListStreamRes,
    RiskPreset,
} from "../../type/RecommendType.ts";
import RecommendCard, {RecommendCardProps} from "../../components/RecommendCard.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {requireOk} from "../../lib/apiResponse.ts";
import {useAlert} from "../../context/AlertContext";

const RISK_PRESET_LABEL: Record<RiskPreset, string> = {
    AGGRESSIVE: '공격적',
    NORMAL: '보통',
    CONSERVATIVE: '안정적',
};

const RISK_PRESET_DESC: Record<RiskPreset, string> = {
    AGGRESSIVE: '위험 종목 필터링 없이 모든 추천 종목을 봅니다.',
    NORMAL: '정리매매·투자위험 종목을 제외합니다.',
    CONSERVATIVE: '관리/정리매매/단기과열/투자위험/투자경고/투자주의환기 종목을 모두 제외합니다.',
};

interface LiveRecommendUpdate {
    value: string;
    changeAmount: string;
    fluRt: string;
    trend: 'up' | 'down' | 'neutral';
}

const trendColor = (value: string): 'up' | 'down' | 'neutral' =>
    ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';

const RecommendList = () => {
    const [liveOverlay, setLiveOverlay] = useState<Map<string, LiveRecommendUpdate>>(new Map());
    const subscribedKeyRef = useRef<string>('');

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    const queryClient = useQueryClient();
    const {showAlert} = useAlert();

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<RecommendListRes>(
        ['recommendList'],
        (config) => fetchRecommendList(config),
    );

    const {data: settingData} = useQuery({
        queryKey: ['recommendSetting'],
        queryFn: async () => requireOk(await fetchRecommendSetting(), {riskPreset: 'NORMAL' as RiskPreset}),
    });
    const riskPreset: RiskPreset = settingData?.riskPreset ?? 'NORMAL';

    const saveSettingMutation = useMutation({
        mutationFn: async (preset: RiskPreset) => {
            requireOk(await saveRecommendSetting({riskPreset: preset}), '투자 성향 설정');
            return preset;
        },
        onSuccess: (preset) => {
            queryClient.setQueryData(['recommendSetting'], {riskPreset: preset});
            queryClient.invalidateQueries({queryKey: ['recommendList']});
            showAlert(`투자 성향이 '${RISK_PRESET_LABEL[preset]}'(으)로 변경되었습니다.`, 'success');
        },
        onError: (e) => {
            console.error(e);
            showAlert('투자 성향 변경에 실패했습니다.', 'error');
        },
    });

    const handlePresetSelect = (next: RiskPreset) => {
        if (next === riskPreset) return;
        saveSettingMutation.mutate(next);
    };

    const PRESET_ORDER: RiskPreset[] = ['AGGRESSIVE', 'NORMAL', 'CONSERVATIVE'];
    const PRESET_COLOR: Record<RiskPreset, 'error' | 'warning' | 'success'> = {
        AGGRESSIVE: 'error',
        NORMAL: 'warning',
        CONSERVATIVE: 'success',
    };

    // 키움 응답에 시각 필드가 없어 stamp 비교 불가. 폴링 도착 시 WS overlay 를
    // 비워서 stale 가격이 새 폴링 결과를 덮어쓰지 못하게 한다.
    useEffect(() => {
        if (!result) return;
        setLiveOverlay(new Map());
    }, [result]);

    // STRONG을 먼저 보여주기 위한 정렬 가중치
    const buyOrder: Record<string, number> = { STRONG_BUY: 0, BUY: 1 };
    const sellOrder: Record<string, number> = { STRONG_SELL: 0, SELL: 1 };

    const toCardProps = (item: RecommendListItem): RecommendCardProps => {
        const live = liveOverlay.get(item.stkCd);
        return {
            id: item.stkCd,
            title: item.stkNm,
            value: live?.value ?? Number(item.curPrc.replace(/^[+-]/, '')).toLocaleString(),
            changeAmount: live?.changeAmount ?? (item.predPre ?? '0'),
            fluRt: live?.fluRt ?? item.fluRt,
            trend: live?.trend ?? trendColor(item.preSig),
            type: item.type,
            todayDirection: item.todayDirection,
            isHolding: item.isHolding,
            streakDays: item.streakDays,
        };
    };

    const recommendDataList: RecommendCardProps[] = useMemo(() => {
        if (!result) return [];
        const list: RecommendListItem[] = result.recommendList ?? [];
        return [...list]
            .sort((a, b) => (buyOrder[a.type] ?? 99) - (buyOrder[b.type] ?? 99))
            .map(toCardProps);
    }, [result, liveOverlay]);

    const avoidDataList: RecommendCardProps[] = useMemo(() => {
        if (!result) return [];
        const list: RecommendListItem[] = result.avoidList ?? [];
        return [...list]
            .sort((a, b) => (sellOrder[a.type] ?? 99) - (sellOrder[b.type] ?? 99))
            .map(toCardProps);
    }, [result, liveOverlay]);

    const holdDataList: RecommendCardProps[] = useMemo(() => {
        if (!result) return [];
        const list: RecommendListItem[] = result.holdList ?? [];
        return list.map(toCardProps);
    }, [result, liveOverlay]);

    const loading = isLoading;

    const timeNow = async () => {
        const info = await fetchMarketInfo(MarketType.STOCK);
        if (!info) return;
        if (info.marketType !== MarketType.STOCK) return;

        chartTimer.current = getServerOffset();
        if (!info.isMarketOpen) marketTimer.current = info.startMarketTime - getServerNow();

        return {...info};
    };

    const recommendListStream = async (req: RecommendListStreamReq) => {
        try {
            const data = await fetchRecommendListStream(req);
            if (data.code !== "0000") throw new Error(data.message);
        } catch (error) {
            console.error(error);
        }
    };

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                const updates: RecommendListStream[] = data.data.map((entry: RecommendListStreamRes) => {
                    const values = entry.values;
                    return {
                        code: entry.item,
                        value: values["10"],
                        change: values["11"],
                        fluRt: values["12"],
                        trend: values["25"],
                    };
                });
                setLiveOverlay((prev) => {
                    const next = new Map(prev);
                    updates.forEach((u) => {
                        next.set(u.code, {
                            value: Number(u.value.replace(/^[+-]/, '')).toLocaleString(),
                            changeAmount: u.change,
                            fluRt: u.fluRt,
                            trend: trendColor(u.trend),
                        });
                    });
                    return next;
                });
            }
        };
        return socket;
    };

    // WebSocket 라이프사이클 — recommend/avoid/hold 종목 stkCd 들로 stream 등록.
    useEffect(() => {
        if (!result) return;
        const items = [
            ...(result.recommendList ?? []),
            ...(result.avoidList ?? []),
            ...(result.holdList ?? []),
        ].map((r: RecommendListItem) => r.stkCd);
        if (items.length === 0) return;

        const key = items.join(',');
        if (subscribedKeyRef.current === key) return;
        subscribedKeyRef.current = key;

        let socketTimeout: ReturnType<typeof setTimeout>;
        let socket: WebSocket | undefined;

        (async () => {
            const marketInfo = await timeNow();

            if (marketInfo?.isMarketOpen) {
                await recommendListStream({items});
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();
                    const again = await timeNow();
                    if (again?.isMarketOpen) {
                        await recommendListStream({items});
                        socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }
        })();

        return () => {
            socket?.close();
            clearTimeout(socketTimeout);
        };
    }, [result]);

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 1, gap: 2}}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography component="h2" variant="h6" sx={{lineHeight: 1}}>
                        추천 목록
                    </Typography>
                    <Tooltip title="이 리포트는 직전 거래일 종가 기준으로 작성되며, 매 거래일 22:00에 갱신됩니다." arrow>
                        <InfoOutlinedIcon fontSize="small" sx={{color: 'text.secondary', display: 'block'}}/>
                    </Tooltip>
                </Stack>
                <Box sx={{flex: 1}}/>
                <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
            </Box>
            <Box sx={{display: 'flex', alignItems: 'center', flexWrap: 'wrap', mb: 2, gap: 1}}>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{mr: 0.5}}>
                    <Typography variant="body2" sx={{color: 'text.secondary', fontWeight: 500}}>
                        투자 성향
                    </Typography>
                    <Tooltip title={RISK_PRESET_DESC[riskPreset]} arrow>
                        <InfoOutlinedIcon fontSize="small" sx={{color: 'text.secondary', display: 'block'}}/>
                    </Tooltip>
                </Stack>
                <Stack direction="row" spacing={0.5}>
                    {PRESET_ORDER.map((p) => {
                        const active = riskPreset === p;
                        return (
                            <Chip
                                key={p}
                                label={RISK_PRESET_LABEL[p]}
                                size="small"
                                clickable
                                onClick={() => handlePresetSelect(p)}
                                disabled={saveSettingMutation.isPending}
                                variant={active ? 'filled' : 'outlined'}
                                color={active ? PRESET_COLOR[p] : 'default'}
                                sx={{
                                    fontWeight: active ? 600 : 400,
                                    minWidth: 64,
                                    opacity: active ? 1 : 0.7,
                                }}
                            />
                        );
                    })}
                </Stack>
                {/* 추후 보정 모듈 체크박스(가격 모멘텀 / 매크로 등)가 같은 줄에 추가될 자리 */}
            </Box>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{mb: (theme) => theme.spacing(2)}}
            >
                <Typography component="h2" variant="h6">
                    매수 리포트
                </Typography>
                <Box sx={{width: '100%'}}>
                    <Grid
                        container
                        spacing={2}
                        columns={12}
                        sx={{mt: 1, mb: (theme) => theme.spacing(2)}}
                    >
                        {loading ? (
                            Array.from({length: 4}).map((_, index) => (
                                <Grid key={index} size={{xs: 12, md: 6}}>
                                    <Card variant="outlined" sx={{width: '100%'}}>
                                        <CardContent>
                                            <Skeleton width={140} height={24}/>
                                            <Stack direction="row" spacing={1} sx={{alignItems: 'center', mt: 1}}>
                                                <Skeleton width={120} height={40}/>
                                                <Skeleton width={60}/>
                                                <Skeleton variant="rounded" width={60} height={24}/>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))
                        ) : recommendDataList.length > 0 ?
                            recommendDataList.map((data: RecommendCardProps, index: number) => (
                                <Grid key={index} size={{xs: 12, md: 6}}>
                                    <RecommendCard {...data} />
                                </Grid>
                            )) : <p>매수 추천 종목 없음</p>
                        }
                    </Grid>
                </Box>
                <Typography component="h2" variant="h6">
                    매도 리포트
                </Typography>
                <Box sx={{width: '100%'}}>
                    <Grid
                        container
                        spacing={2}
                        columns={12}
                        sx={{mt: 1, mb: (theme) => theme.spacing(2)}}
                    >
                        {loading ? (
                            Array.from({length: 4}).map((_, index) => (
                                <Grid key={index} size={{xs: 12, md: 6}}>
                                    <Card variant="outlined" sx={{width: '100%'}}>
                                        <CardContent>
                                            <Skeleton width={140} height={24}/>
                                            <Stack direction="row" spacing={1} sx={{alignItems: 'center', mt: 1}}>
                                                <Skeleton width={120} height={40}/>
                                                <Skeleton width={60}/>
                                                <Skeleton variant="rounded" width={60} height={24}/>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))
                        ) : avoidDataList.length > 0 ?
                            avoidDataList.map((data: RecommendCardProps, index: number) => (
                                <Grid key={index} size={{xs: 12, md: 6}}>
                                    <RecommendCard {...data} />
                                </Grid>
                            )) : <p>매도 추천 종목 없음</p>
                        }
                    </Grid>
                </Box>
                <Typography component="h2" variant="h6">
                    관망
                </Typography>
                <Box sx={{width: '100%'}}>
                    <Grid
                        container
                        spacing={2}
                        columns={12}
                        sx={{mt: 1, mb: (theme) => theme.spacing(2)}}
                    >
                        {loading ? (
                            Array.from({length: 4}).map((_, index) => (
                                <Grid key={index} size={{xs: 12, md: 6}}>
                                    <Card variant="outlined" sx={{width: '100%'}}>
                                        <CardContent>
                                            <Skeleton width={140} height={24}/>
                                            <Stack direction="row" spacing={1} sx={{alignItems: 'center', mt: 1}}>
                                                <Skeleton width={120} height={40}/>
                                                <Skeleton width={60}/>
                                                <Skeleton variant="rounded" width={60} height={24}/>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))
                        ) : holdDataList.length > 0 ?
                            holdDataList.map((data: RecommendCardProps, index: number) => (
                                <Grid key={index} size={{xs: 12, md: 6}}>
                                    <RecommendCard {...data} />
                                </Grid>
                            )) : <p>관망 종목 없음</p>
                        }
                    </Grid>
                </Box>
            </Grid>
        </Box>
    );
};

export default RecommendList;
