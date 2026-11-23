import {MouseEvent, useCallback, useLayoutEffect, useMemo, useRef, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import PriceTargetMoveDialog, {PriceTargetMove} from "./PriceTargetMoveDialog.tsx";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Select, {SelectChangeEvent} from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CandleChart from "../../components/chart/CandleChart.tsx";
import {ChartToolbarGroup} from "../../components/chart/ChartToolbarControls.tsx";
import {useCandleHistory} from "../../components/chart/useCandleHistory.ts";
import type {ComparisonMarket} from "../../components/chart/useChartComparisons.ts";
import {mergeCandles} from "../../lib/chart/merge.ts";
import type {Candle, PriceLine} from "../../lib/chart/types.ts";
import {requireOk} from "../../lib/apiResponse.ts";
import {fetchPriceTargets, updatePriceTarget} from "../../api/notification/NotificationApi.ts";
import type {PriceTarget} from "../../type/NotificationType.ts";
import {
    ChartMarket, chartStorageOf, countdownIntervalOf, isMinuteChart, MARKET_CHART_RULES, minuteChartType, minutesOf,
    timeUnitOf,
} from "./assetChart.ts";
import {fetchCandlePage, hasCandleHistory} from "./chartHistory.ts";
import {createComparisonSource} from "./chartComparison.ts";
import {averagePriceLineOf, tradeMarkersOf} from "./chartTrades.ts";
import {useChartTradesSetting} from "../../components/chart/useChartStorage.ts";
import {fetchStockTrades} from "../../api/holding/HoldingApi.ts";
import {
    requestSecondaryAuth, useSecondaryAuthLockedContent, useSecondaryAuthUnlocked,
} from "../../lib/secondaryAuth.ts";
import type {StockTradeMarket, StockTradeRes} from "../../type/HoldingType.ts";

// 내 매매를 조회할 수 있는 자산과 그 시장. 여기 없는 자산(코인·지수·원자재)은 설정 창에 스위치가 없다
const TRADE_MARKETS: Partial<Record<ChartMarket, StockTradeMarket>> = {STOCK: 'KR', US_STOCK: 'US'};
const NO_TRADES: StockTradeRes = {trades: [], holdings: [], failedBrokers: []};
// 내 매매의 단가 표기. 원화는 원 단위로, 달러는 소수 둘째~넷째 자리까지
const TRADE_PRICE_FORMATS: Record<StockTradeMarket, (price: number) => string> = {
    KR: price => Math.round(price).toLocaleString(),
    US: price => price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4}),
};

export interface AssetChartProps {
    market: ChartMarket,
    code: string,
    exchange?: string,      // 미국 종목의 거래소 구분(ND·NY·NA). 주면 과거 구간을 이어 받는다
    chartType: string,    // 지금 주기 (MINUTE_5, DAY …). 조회에 쓰므로 화면이 들고 있다
    onChartTypeChange: (chartType: string) => void,
    candles: Candle[],      // 화면이 조회한 캔들 (오래된 순)
    // 실시간 현재가. 주면 마지막 캔들의 종가·고가·저가에 반영한다(새 캔들은 만들지 않는다).
    // 화면이 체결을 직접 캔들에 쌓았으면(국내 종목 상세) 주지 않는다
    livePrice?: number | null,
    liveStamp?: number,     // 그 가격의 시각(epoch ms). 마지막 캔들보다 앞선 값이면 반영하지 않는다
    loading?: boolean,
    height?: number,        // 가격+거래량 영역의 기본 높이
    // 우클릭 메뉴의 "이 가격에 목표가 알림". 목표가 알림 창을 가진 화면만 넘긴다(넘기지 않으면 메뉴에 없다)
    onPriceTarget?: (price: number) => void,
}

const DEFAULT_HEIGHT = 480;
// 주기 버튼을 차트 위쪽 줄에 함께 놓을 수 있는 최소 너비. 이보다 좁으면 차트 아래에 놓는다(위쪽 줄의 설정 버튼이 잘리지 않게)
// 위쪽 줄에 날짜로 이동 버튼(32px)과 간격(8px)이 늘어난 만큼 더한 값
const TOOLBAR_MIN_WIDTH = 680;
const TOGGLE_MINUTE = 'MINUTE';

/**
 * 자산 하나의 차트: 주기 버튼 + 캔들 차트.
 * 주기 버튼의 구성·놓는 자리, 저장 기준, 종목 비교, 목표가 선, 과거 구간 이어 받기처럼 화면마다 같아야 하는 것을 여기서 정한다.
 * 상세 화면과 멀티 화면이 모두 이것을 쓰므로, 차트 주변을 고칠 때는 이 파일과 assetChart.ts 만 고치면 된다.
 */
const AssetChart = ({
    market, code, exchange, chartType, onChartTypeChange, candles, livePrice, liveStamp, loading = false,
    height = DEFAULT_HEIGHT, onPriceTarget,
}: AssetChartProps) => {
    const rule = MARKET_CHART_RULES[market];
    const storage = chartStorageOf(market, code);

    // 주기를 바꿔 새 캔들을 받는 동안에는 차트를 내리지 않는다. 직전 주기의 차트를 그대로 두고 그 위에 로딩 표시만 덮는다.
    // 차트를 내렸다 다시 만들면 비교 종목·이어 받은 과거 구간·저장 실패 표시가 사라지고, 단축키 대상도 바뀐다.
    // 다른 자산으로 바뀐 동안에는 두지 않는다(그 자산의 차트가 아니므로).
    const assetKey = `${market}-${code}`;
    const [settled, setSettled] = useState<{assetKey: string, chartType: string, candles: Candle[]} | null>(null);
    if (!loading && (settled?.assetKey !== assetKey || settled.chartType !== chartType || settled.candles !== candles)) {
        setSettled({assetKey, chartType, candles});
    }
    const holding = loading && settled?.assetKey === assetKey ? settled : null;
    // 차트에 그리는 주기와 캔들. 주기 버튼은 고른 주기(chartType)를 바로 보여 준다.
    const shownType = holding?.chartType ?? chartType;
    const shownCandles = holding?.candles ?? candles;
    const seriesKey = `${market}-${code}-${shownType}`;

    // 주기 버튼. 분봉 단위는 마지막에 고른 것을 기억해, 일봉에서 분봉 버튼을 누르면 그 단위로 돌아간다.
    const currentMinutes = minutesOf(chartType);
    const [lastMinutes, setLastMinutes] = useState(rule.defaultMinute);
    const minutes = currentMinutes ?? (rule.minutes.includes(lastMinutes) ? lastMinutes : rule.defaultMinute);
    const toggle = isMinuteChart(chartType) ? TOGGLE_MINUTE : chartType;

    const handleToggle = (_event: MouseEvent<HTMLElement>, next: string | null) => {
        if (next === null) return;
        onChartTypeChange(next === TOGGLE_MINUTE ? minuteChartType(minutes) : next);
    };
    const handleMinutes = (event: SelectChangeEvent) => {
        const next = Number(event.target.value);
        setLastMinutes(next);
        onChartTypeChange(minuteChartType(next));
    };

    const controls = (
        <ChartToolbarGroup size="small" value={toggle} exclusive onChange={handleToggle} aria-label="차트 주기">
            <ToggleButton value={TOGGLE_MINUTE} aria-label="분봉">
                {/* 버튼 안의 선택 상자는 글자 크기·색을 버튼에서 물려받고, 화살표는 작은 아래 화살표 하나만 둔다. */}
                <Select
                    size="small"
                    value={String(minutes)}
                    onChange={handleMinutes}
                    variant="standard"
                    disableUnderline
                    IconComponent={ArrowDropDownIcon}
                    sx={{
                        boxShadow: 'none',
                        backgroundColor: 'transparent',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        color: 'inherit',
                        '& .MuiSelect-select': {py: 0, pl: 0, minHeight: 0},
                        '& .MuiSelect-icon': {color: 'inherit'},
                    }}
                >
                    {rule.minutes.map(option => (
                        <MenuItem key={option} value={String(option)}>{option}분</MenuItem>
                    ))}
                </Select>
            </ToggleButton>
            <ToggleButton value="DAY" aria-label="일봉">일</ToggleButton>
            <ToggleButton value="WEEK" aria-label="주봉">주</ToggleButton>
            <ToggleButton value="MONTH" aria-label="월봉">월</ToggleButton>
            {rule.year && <ToggleButton value="YEAR" aria-label="연봉">년</ToggleButton>}
        </ChartToolbarGroup>
    );

    // 주기 버튼을 놓는 자리는 화면이 아니라 이 차트가 차지한 너비로 정한다. 멀티 화면의 좁은 패널에서도 같은 규칙이 된다.
    const containerRef = useRef<HTMLDivElement>(null);
    const [wide, setWide] = useState(true);
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const update = () => setWide(container.clientWidth >= TOOLBAR_MIN_WIDTH);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // 과거 구간. 차트 왼쪽 끝에 가까워지면 이전 구간을 이어 받아 앞에 붙인다.
    const hasHistory = hasCandleHistory(market, shownType, exchange);
    const fetchOlder = useCallback(
        (cursor: string | null) => fetchCandlePage(market, code, shownType, cursor, exchange),
        [market, code, shownType, exchange],
    );
    const {history, loadOlder, done: historyDone} = useCandleHistory(seriesKey, fetchOlder);

    // 실시간 현재가를 마지막 캔들에 반영하고, 과거 구간을 앞에 붙인다.
    // 직전 주기의 차트를 두는 동안에는 실시간 가격을 반영하지 않는다. 화면은 새로 고른 주기를 기준으로 가격을 주므로
    // (미국 종목은 분봉에만 장외 가격을 준다 등) 직전 주기 캔들에 넣으면 맞지 않을 수 있다.
    const shownLive = holding ? null : livePrice;
    const fullCandles = useMemo(() => {
        const last = shownCandles[shownCandles.length - 1];
        const usable = last && typeof shownLive === 'number' && Number.isFinite(shownLive) && shownLive > 0
            && (liveStamp === undefined || liveStamp >= last.time);
        const live = usable
            ? [
                ...shownCandles.slice(0, -1),
                {...last, close: shownLive, high: Math.max(last.high, shownLive), low: Math.min(last.low, shownLive)},
            ]
            : shownCandles;
        return mergeCandles(history, live);
    }, [shownCandles, history, shownLive, liveStamp]);

    // 이 자산에 등록한 목표가 알림을 차트에 선으로 표시한다. 목표가 알림 창과 같은 조회를 공유해 등록·삭제가 바로 반영된다.
    const {data: priceTargets} = useQuery<PriceTarget[]>({
        queryKey: ['priceTargets'],
        queryFn: async ({signal}) => requireOk(await fetchPriceTargets({signal, skipGlobalError: true}), [] as PriceTarget[]),
        refetchOnWindowFocus: false,
    });
    // 목표가 선을 끌어 놓으면 확인 창을 띄우고, 확인하면 그 가격으로 바꾼다. 창이 떠 있는 동안에는 선을 놓은 자리에 그린다.
    const [targetMove, setTargetMove] = useState<PriceTargetMove | null>(null);
    const queryClient = useQueryClient();
    const moveMutation = useMutation({
        mutationFn: async ({target, price, direction}: PriceTargetMove) =>
            requireOk(await updatePriceTarget(target.id, {targetPrice: price, direction}), '목표가 변경'),
        onSuccess: updated => {
            queryClient.setQueryData<PriceTarget[]>(['priceTargets'], previous => (
                (previous ?? []).map(target => target.id === updated.id ? updated : target)
            ));
            queryClient.invalidateQueries({queryKey: ['priceTargets']});
            setTargetMove(null);
        },
        onError: error => console.error(error),
    });
    const lastClose = fullCandles[fullCandles.length - 1]?.close;
    /** 목표가를 price 로 옮겼을 때의 내용. 방향은 목표가 알림 창과 같은 규칙: 현재가 이상이면 "이상", 미만이면 "이하" */
    const moveOf = (target: PriceTarget, price: number): PriceTargetMove => ({
        target,
        price,
        // 현재가를 모르면 방향은 그대로 둔다.
        direction: lastClose === undefined ? target.direction : price >= lastClose ? 'ABOVE' : 'BELOW',
    });
    const handleTargetMove = (id: string, price: number) => {
        const target = (priceTargets ?? []).find(item => String(item.id) === id);
        if (!target || price === target.targetPrice) return;
        moveMutation.reset();
        setTargetMove(moveOf(target, price));
    };
    const targetLines = useMemo<PriceLine[]>(
        () => (priceTargets ?? [])
            .filter(target => target.assetType === storage.assetType && target.assetCode === storage.assetCode)
            .map(target => {
                const moved = targetMove?.target.id === target.id ? targetMove : null;
                return {
                    id: String(target.id),
                    price: moved?.price ?? target.targetPrice,
                    title: '목표가',
                    tone: (moved?.direction ?? target.direction) === 'ABOVE' ? 'up' : 'down',
                };
            }),
        [priceTargets, storage.assetType, storage.assetCode, targetMove],
    );

    // 내 매매(매수·매도 지점, 평단가 선). 설정 창에서 켜 두었고 2차 인증을 한 동안에만 조회하고 표시한다.
    // 인증 상태는 상단의 자물쇠와 같은 값을 본다(lib/secondaryAuth.ts): 인증하면 바로 조회하고, 시간이 다 되면 그 순간 지운다.
    const tradeMarket = TRADE_MARKETS[market];
    const tradesOn = useChartTradesSetting() && tradeMarket !== undefined;
    const unlocked = useSecondaryAuthUnlocked();
    // 켜 두었는데 인증 전이라 가려진 동안에는 상단 자물쇠가 점을 찍어 알린다. 차트에는 따로 표시하지 않는다.
    useSecondaryAuthLockedContent('내 매매 표시', tradesOn && !unlocked);
    const tradesQuery = useQuery({
        queryKey: ['chartTrades', tradeMarket, code],
        queryFn: async ({signal}): Promise<StockTradeRes> => {
            // 화면이 아는 인증 상태가 서버와 어긋났더라도(다른 기기에서 다시 인증 등) 인증 창을 띄우지 않고 조용히 실패하게 한다.
            const res = requireOk(
                await fetchStockTrades(code, tradeMarket ?? 'KR', {signal, skipGlobalError: true, secondaryAuthSilent: true}),
                NO_TRADES,
            );
            // 응답에 빠지거나 null 인 항목이 있어도(서버가 예전 모양으로 답하는 동안 등) 화면이 깨지지 않게 빈 목록으로 채운다.
            return {trades: res.trades ?? [], holdings: res.holdings ?? [], failedBrokers: res.failedBrokers ?? []};
        },
        enabled: tradesOn && unlocked,
        retry: false,
        staleTime: 0,
        // 받아 둔 내역을 남겨 두지 않는다. 남겨 두면 다른 종목을 보고 돌아왔을 때 2차 인증이 풀려 있어도 잠깐 다시 그려진다.
        gcTime: 0,
    });
    // 스위치를 켰는데 인증 전이면 그 자리에서 2차 비밀번호를 묻는다. 인증하면 위 조회가 바로 시작된다.
    const handleTradesChange = (visible: boolean) => {
        if (visible && !unlocked) requestSecondaryAuth();
    };
    // 이 화면을 연 뒤에 받은 내역만, 인증된 동안에만 보여 준다.
    const myTrades = tradesOn && unlocked && tradesQuery.isSuccess && tradesQuery.isFetchedAfterMount
        ? tradesQuery.data
        : NO_TRADES;
    const tradesNotice = myTrades.failedBrokers.length > 0
        ? `${myTrades.failedBrokers.join(', ')} 조회에 실패해 그 증권사의 매매가 빠져 있습니다.`
        : undefined;
    const formatTradePrice = TRADE_PRICE_FORMATS[tradeMarket ?? 'KR'];
    const tradeMarkers = useMemo(
        () => tradeMarkersOf(fullCandles, myTrades.trades, minutesOf(shownType), formatTradePrice),
        [fullCandles, myTrades, shownType, formatTradePrice],
    );
    const priceLines = useMemo(() => {
        // 평단가는 종목 통화 기준이다: 국내는 원 단위, 미국은 달러 소수 넷째 자리까지.
        const averageLine = averagePriceLineOf(myTrades.holdings, formatTradePrice, tradeMarket === 'US' ? 4 : 0);
        return averageLine ? [...targetLines, averageLine] : targetLines;
    }, [targetLines, myTrades, formatTradePrice, tradeMarket]);

    // 종목 비교: 일봉 이상은 종류를 섞어, 분봉은 같은 종류끼리만 비교한다.
    const comparison = useMemo(
        () => (rule.comparison ? createComparisonSource(market as ComparisonMarket, shownType, code) : undefined),
        [rule.comparison, market, shownType, code],
    );

    // 목표가 알림 창은 원화 목표가를 원 단위 정수로만 받는다(달러는 소수 4자리). 1원 미만 단위가 있는 가격(저가 코인 등)은
    // 반올림하면 값과 방향이 달라지므로 우클릭 메뉴에 띄우지 않는다.
    const canPriceTarget = market === 'US_STOCK' ? undefined : (price: number) => Number.isInteger(price) && price > 0;

    // 그릴 차트가 아직 없으면(처음 열거나 다른 자산으로 바뀐 동안) 자리만 잡아 둔다.
    const waiting = loading && !holding;

    return (
        <Box ref={containerRef}>
            {wide && waiting && (
                <Stack direction="row" spacing={1} sx={{px: 2, pb: 1, alignItems: 'center', minHeight: 40}}>
                    {controls}
                </Stack>
            )}
            {/* 차트는 스스로 이동·확대하므로 차지한 너비에 맞춘다. 선·영역 등 차트 종류는 차트 안에서 고른다. */}
            {waiting ? (
                <Skeleton variant="rectangular" height={height} sx={{mx: 2, mb: 2, borderRadius: 1}}/>
            ) : (
                <Box sx={{position: 'relative'}}>
                    <CandleChart
                        candles={fullCandles}
                        timeUnit={timeUnitOf(shownType)}
                        interval={countdownIntervalOf(market, shownType)}
                        seriesKey={seriesKey}
                        assetType={storage.assetType}
                        assetCode={storage.assetCode}
                        onLoadOlder={hasHistory ? loadOlder : undefined}
                        hasOlder={hasHistory && !historyDone}
                        comparison={comparison}
                        priceLines={priceLines}
                        onPriceLineMove={handleTargetMove}
                        onPriceTarget={onPriceTarget}
                        canPriceTarget={canPriceTarget}
                        tradeMarkers={tradeMarkers}
                        onTradesChange={tradeMarket ? handleTradesChange : undefined}
                        tradesNotice={tradesNotice}
                        toolbarStart={wide ? controls : undefined}
                        height={height}
                    />
                    {holding && (
                        // 직전 주기의 차트 위에 덮는 로딩 표시. 차트 조작은 막지 않는다.
                        <Box
                            sx={{
                                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                pointerEvents: 'none',
                            }}
                        >
                            <CircularProgress size={32}/>
                        </Box>
                    )}
                </Box>
            )}
            <PriceTargetMoveDialog
                move={targetMove}
                saving={moveMutation.isPending}
                failed={moveMutation.isError}
                onPriceChange={price => setTargetMove(previous => previous && moveOf(previous.target, price))}
                onConfirm={() => targetMove && moveMutation.mutate(targetMove)}
                onCancel={() => setTargetMove(null)}
            />
            {!wide && (
                <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap">
                    {controls}
                </Box>
            )}
        </Box>
    );
};

export default AssetChart;
