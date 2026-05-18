import {Box, Chip, Divider, Switch, Tooltip} from "@mui/material";
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
        queryFn: async () => requireOk(
            await fetchRecommendSetting(),
            {riskPreset: 'NORMAL' as RiskPreset, priceVolatilityEnabled: false, movingAverageEnabled: false, marketIndexEnabled: false, volumePriceEnabled: false, rsiEnabled: false, highLow52wEnabled: false, breakoutEnabled: false},
        ),
    });
    const riskPreset: RiskPreset = settingData?.riskPreset ?? 'NORMAL';
    const priceVolatilityEnabled: boolean = settingData?.priceVolatilityEnabled ?? false;
    const movingAverageEnabled: boolean = settingData?.movingAverageEnabled ?? false;
    const marketIndexEnabled: boolean = settingData?.marketIndexEnabled ?? false;
    const volumePriceEnabled: boolean = settingData?.volumePriceEnabled ?? false;
    const rsiEnabled: boolean = settingData?.rsiEnabled ?? false;
    const highLow52wEnabled: boolean = settingData?.highLow52wEnabled ?? false;
    const breakoutEnabled: boolean = settingData?.breakoutEnabled ?? false;

    const saveSettingMutation = useMutation({
        mutationFn: async (req: {riskPreset: RiskPreset; priceVolatilityEnabled: boolean; movingAverageEnabled: boolean; marketIndexEnabled: boolean; volumePriceEnabled: boolean; rsiEnabled: boolean; highLow52wEnabled: boolean; breakoutEnabled: boolean}) => {
            requireOk(await saveRecommendSetting(req), '추천 설정');
            return req;
        },
        onSuccess: (req) => {
            queryClient.setQueryData(['recommendSetting'], req);
            queryClient.invalidateQueries({queryKey: ['recommendList']});
        },
        onError: (e) => {
            console.error(e);
            showAlert('설정 변경에 실패했습니다.', 'error');
        },
    });

    const handlePresetSelect = (next: RiskPreset) => {
        if (next === riskPreset) return;
        saveSettingMutation.mutate({riskPreset: next, priceVolatilityEnabled, movingAverageEnabled, marketIndexEnabled, volumePriceEnabled, rsiEnabled, highLow52wEnabled, breakoutEnabled}, {
            onSuccess: () => showAlert(`투자 성향이 '${RISK_PRESET_LABEL[next]}'(으)로 변경되었습니다.`, 'success'),
        });
    };

    const handlePriceVolatilityToggle = (next: boolean) => {
        if (next === priceVolatilityEnabled) return;
        saveSettingMutation.mutate({riskPreset, priceVolatilityEnabled: next, movingAverageEnabled, marketIndexEnabled, volumePriceEnabled, rsiEnabled, highLow52wEnabled, breakoutEnabled}, {
            onSuccess: () => showAlert(`가격 변동성 보정이 ${next ? '적용' : '해제'}되었습니다.`, 'success'),
        });
    };

    const handleMovingAverageToggle = (next: boolean) => {
        if (next === movingAverageEnabled) return;
        saveSettingMutation.mutate({riskPreset, priceVolatilityEnabled, movingAverageEnabled: next, marketIndexEnabled, volumePriceEnabled, rsiEnabled, highLow52wEnabled, breakoutEnabled}, {
            onSuccess: () => showAlert(`이동평균선 보정이 ${next ? '적용' : '해제'}되었습니다.`, 'success'),
        });
    };

    const handleMarketIndexToggle = (next: boolean) => {
        if (next === marketIndexEnabled) return;
        saveSettingMutation.mutate({riskPreset, priceVolatilityEnabled, movingAverageEnabled, marketIndexEnabled: next, volumePriceEnabled, rsiEnabled, highLow52wEnabled, breakoutEnabled}, {
            onSuccess: () => showAlert(`지수 매크로 보정이 ${next ? '적용' : '해제'}되었습니다.`, 'success'),
        });
    };

    const handleVolumePriceToggle = (next: boolean) => {
        if (next === volumePriceEnabled) return;
        saveSettingMutation.mutate({riskPreset, priceVolatilityEnabled, movingAverageEnabled, marketIndexEnabled, volumePriceEnabled: next, rsiEnabled, highLow52wEnabled, breakoutEnabled}, {
            onSuccess: () => showAlert(`거래량 보정이 ${next ? '적용' : '해제'}되었습니다.`, 'success'),
        });
    };

    const handleRsiToggle = (next: boolean) => {
        if (next === rsiEnabled) return;
        saveSettingMutation.mutate({riskPreset, priceVolatilityEnabled, movingAverageEnabled, marketIndexEnabled, volumePriceEnabled, rsiEnabled: next, highLow52wEnabled, breakoutEnabled}, {
            onSuccess: () => showAlert(`RSI 보정이 ${next ? '적용' : '해제'}되었습니다.`, 'success'),
        });
    };

    const handleHighLow52wToggle = (next: boolean) => {
        if (next === highLow52wEnabled) return;
        saveSettingMutation.mutate({riskPreset, priceVolatilityEnabled, movingAverageEnabled, marketIndexEnabled, volumePriceEnabled, rsiEnabled, highLow52wEnabled: next, breakoutEnabled}, {
            onSuccess: () => showAlert(`52주 위치 보정이 ${next ? '적용' : '해제'}되었습니다.`, 'success'),
        });
    };

    const handleBreakoutToggle = (next: boolean) => {
        if (next === breakoutEnabled) return;
        saveSettingMutation.mutate({riskPreset, priceVolatilityEnabled, movingAverageEnabled, marketIndexEnabled, volumePriceEnabled, rsiEnabled, highLow52wEnabled, breakoutEnabled: next}, {
            onSuccess: () => showAlert(`신고저 돌파 보정이 ${next ? '적용' : '해제'}되었습니다.`, 'success'),
        });
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
                    <Tooltip title="이 리포트는 직전 거래일 종가 기준으로 작성되며, 매 거래일 22:00에 갱신됩니다. 당일 매매 동향은 장 중 5분 간격으로 갱신됩니다." arrow>
                        <InfoOutlinedIcon fontSize="small" sx={{color: 'text.secondary', display: 'block'}}/>
                    </Tooltip>
                </Stack>
                <Box sx={{flex: 1}}/>
                <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
            </Box>
            <Card variant="outlined" sx={{mb: 1.5}}>
                <CardContent sx={{py: 1.5, "&:last-child": {pb: 1.5}}}>
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{mb: 1.25}}>
                        <Typography variant="subtitle2" sx={{color: 'text.secondary', fontWeight: 600}}>
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
                </CardContent>
            </Card>
            <Card variant="outlined" sx={{mb: 2}}>
                <CardContent sx={{py: 1.5, "&:last-child": {pb: 1.5}}}>
                    {/* 그룹 1: 종목 분석 (전일 데이터 스냅샷) */}
                    <Box sx={{mb: 0.5}}>
                        <Typography variant="subtitle2" sx={{fontWeight: 600}}>
                            종목 분석
                        </Typography>
                        <Typography variant="caption" sx={{color: 'text.secondary', display: 'block', mb: 1.25}}>
                            전일 장마감 이후에 저장된 종목 데이터로 리포트 등급을 조정합니다.
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={3} useFlexGap sx={{flexWrap: 'wrap', alignItems: 'center'}}>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Typography variant="body2">가격 변동성</Typography>
                                <Tooltip title="추천과 반대로 가격이 움직일 때 등급을 조정합니다." arrow>
                                    <InfoOutlinedIcon fontSize="small" sx={{color: 'text.secondary', display: 'block'}}/>
                                </Tooltip>
                            </Stack>
                            <Switch
                                size="small"
                                checked={priceVolatilityEnabled}
                                onChange={(e) => handlePriceVolatilityToggle(e.target.checked)}
                                disabled={saveSettingMutation.isPending}
                            />
                        </Box>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Typography variant="body2">이동평균선</Typography>
                                <Tooltip title="단기 이동평균선이 골든/데드크로스 진입 시 추천과 같은 방향이면 등급을 조정합니다." arrow>
                                    <InfoOutlinedIcon fontSize="small" sx={{color: 'text.secondary', display: 'block'}}/>
                                </Tooltip>
                            </Stack>
                            <Switch
                                size="small"
                                checked={movingAverageEnabled}
                                onChange={(e) => handleMovingAverageToggle(e.target.checked)}
                                disabled={saveSettingMutation.isPending}
                            />
                        </Box>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Typography variant="body2">거래량</Typography>
                                <Tooltip title="당일 거래량이 평소를 크게 웃돌면 가격 움직임에 따라 등급을 조정합니다." arrow>
                                    <InfoOutlinedIcon fontSize="small" sx={{color: 'text.secondary', display: 'block'}}/>
                                </Tooltip>
                            </Stack>
                            <Switch
                                size="small"
                                checked={volumePriceEnabled}
                                onChange={(e) => handleVolumePriceToggle(e.target.checked)}
                                disabled={saveSettingMutation.isPending}
                            />
                        </Box>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Typography variant="body2">RSI</Typography>
                                <Tooltip title="RSI 지표와 모멘텀 변화에 따라 등급을 조정합니다." arrow>
                                    <InfoOutlinedIcon fontSize="small" sx={{color: 'text.secondary', display: 'block'}}/>
                                </Tooltip>
                            </Stack>
                            <Switch
                                size="small"
                                checked={rsiEnabled}
                                onChange={(e) => handleRsiToggle(e.target.checked)}
                                disabled={saveSettingMutation.isPending}
                            />
                        </Box>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Typography variant="body2">52주 위치</Typography>
                                <Tooltip title="52주 고저점 대비 주가의 위치에 따라 등급을 조정합니다." arrow>
                                    <InfoOutlinedIcon fontSize="small" sx={{color: 'text.secondary', display: 'block'}}/>
                                </Tooltip>
                            </Stack>
                            <Switch
                                size="small"
                                checked={highLow52wEnabled}
                                onChange={(e) => handleHighLow52wToggle(e.target.checked)}
                                disabled={saveSettingMutation.isPending}
                            />
                        </Box>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Typography variant="body2">신고저 돌파</Typography>
                                <Tooltip title="신고가·신저가 돌파와 거래량 동반 여부에 따라 등급을 조정합니다." arrow>
                                    <InfoOutlinedIcon fontSize="small" sx={{color: 'text.secondary', display: 'block'}}/>
                                </Tooltip>
                            </Stack>
                            <Switch
                                size="small"
                                checked={breakoutEnabled}
                                onChange={(e) => handleBreakoutToggle(e.target.checked)}
                                disabled={saveSettingMutation.isPending}
                            />
                        </Box>
                    </Stack>

                    <Divider sx={{my: 1.5}} />

                    {/* 그룹 2: 시장 환경 (실시간) */}
                    <Box sx={{mb: 0.5}}>
                        <Typography variant="subtitle2" sx={{fontWeight: 600}}>
                            시장 환경
                        </Typography>
                        <Typography variant="caption" sx={{color: 'text.secondary', display: 'block', mb: 1.25}}>
                            실시간 시장 데이터로 추천 등급을 조정합니다. 당일 시장 환경에 따라 시점별로 등급이 변할 수 있습니다.
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={3} useFlexGap sx={{flexWrap: 'wrap', alignItems: 'center'}}>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Typography variant="body2">지수 매크로</Typography>
                                <Tooltip title="등락율 및 투자자별 매매 동향에 따라 등급을 조정합니다." arrow>
                                    <InfoOutlinedIcon fontSize="small" sx={{color: 'text.secondary', display: 'block'}}/>
                                </Tooltip>
                            </Stack>
                            <Switch
                                size="small"
                                checked={marketIndexEnabled}
                                onChange={(e) => handleMarketIndexToggle(e.target.checked)}
                                disabled={saveSettingMutation.isPending}
                            />
                        </Box>
                    </Stack>
                </CardContent>
            </Card>
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
