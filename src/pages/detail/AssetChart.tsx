import {MouseEvent, useCallback, useLayoutEffect, useMemo, useRef, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import PriceTargetMoveDialog, {PriceTargetMove} from "./PriceTargetMoveDialog.tsx";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Select, {SelectChangeEvent} from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CandleChart from "../../components/chart/CandleChart.tsx";
import {ChartToolbarGroup} from "../../components/chart/ChartToolbarControls.tsx";
import {CandlePage, useCandleHistory} from "../../components/chart/useCandleHistory.ts";
import type {ComparisonMarket} from "../../components/chart/useChartComparisons.ts";
import {mergeCandles} from "../../lib/chart/merge.ts";
import type {Candle, PriceLine} from "../../lib/chart/types.ts";
import {requireOk} from "../../lib/apiResponse.ts";
import {fetchPriceTargets, updatePriceTarget} from "../../api/notification/NotificationApi.ts";
import {fetchStockCandles} from "../../api/stock/StockApi.ts";
import type {PriceTarget} from "../../type/NotificationType.ts";
import type {StockCandleRes, StockChartType} from "../../type/StockType.ts";
import {
    ChartMarket, chartStorageOf, countdownIntervalOf, isMinuteChart, MARKET_CHART_RULES, minuteChartType, minutesOf,
    timeUnitOf,
} from "./assetChart.ts";
import {kiwoomCandles} from "./chartCandles.ts";
import {createComparisonSource} from "./chartComparison.ts";

export interface AssetChartProps {
    market: ChartMarket,
    code: string,
    chartType: string,      // 지금 주기 (MINUTE_5, DAY …). 조회에 쓰므로 화면이 들고 있다
    onChartTypeChange: (chartType: string) => void,
    candles: Candle[],      // 화면이 조회한 캔들 (오래된 순)
    // 실시간 현재가. 주면 마지막 캔들의 종가·고가·저가에 반영한다(새 캔들은 만들지 않는다).
    // 화면이 체결을 직접 캔들에 쌓았으면(국내 종목 상세) 주지 않는다
    livePrice?: number | null,
    liveStamp?: number,     // 그 가격의 시각(epoch ms). 마지막 캔들보다 앞선 값이면 반영하지 않는다
    loading?: boolean,
    height?: number,        // 가격+거래량 영역의 기본 높이
}

const DEFAULT_HEIGHT = 480;
// 주기 버튼을 차트 위쪽 줄에 함께 놓을 수 있는 최소 너비. 이보다 좁으면 차트 아래에 놓는다(위쪽 줄의 설정 버튼이 잘리지 않게)
const TOOLBAR_MIN_WIDTH = 640;
const TOGGLE_MINUTE = 'MINUTE';
const NO_HISTORY: CandlePage = {candles: [], nextCursor: null};

/**
 * 자산 하나의 차트: 주기 버튼 + 캔들 차트.
 * 주기 버튼의 구성·놓는 자리, 저장 기준, 종목 비교, 목표가 선, 과거 구간 이어 받기처럼 화면마다 같아야 하는 것을 여기서 정한다.
 * 상세 화면과 멀티 화면이 모두 이것을 쓰므로, 차트 주변을 고칠 때는 이 파일과 assetChart.ts 만 고치면 된다.
 */
const AssetChart = ({
    market, code, chartType, onChartTypeChange, candles, livePrice, liveStamp, loading = false,
    height = DEFAULT_HEIGHT,
}: AssetChartProps) => {
    const rule = MARKET_CHART_RULES[market];
    const storage = chartStorageOf(market, code);
    const seriesKey = `${market}-${code}-${chartType}`;

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

    // 과거 구간. 차트 왼쪽 끝에 가까워지면 이전 구간을 이어 받아 앞에 붙인다. 조회가 있는 종류(국내 종목)만 한다.
    const fetchOlder = useCallback(async (cursor: string | null): Promise<CandlePage> => {
        if (!rule.history) return NO_HISTORY;
        const page = requireOk<StockCandleRes>(
            await fetchStockCandles(
                code, {chartType: chartType as StockChartType, cursor: cursor ?? undefined}, {skipGlobalError: true},
            ),
            '과거 차트 조회',
        );
        return {candles: kiwoomCandles(page.candles), nextCursor: page.nextCursor ?? null};
    }, [rule.history, code, chartType]);
    const {history, loadOlder} = useCandleHistory(seriesKey, fetchOlder);

    // 실시간 현재가를 마지막 캔들에 반영하고, 과거 구간을 앞에 붙인다.
    const fullCandles = useMemo(() => {
        const last = candles[candles.length - 1];
        const usable = last && typeof livePrice === 'number' && Number.isFinite(livePrice) && livePrice > 0
            && (liveStamp === undefined || liveStamp >= last.time);
        const live = usable
            ? [
                ...candles.slice(0, -1),
                {...last, close: livePrice, high: Math.max(last.high, livePrice), low: Math.min(last.low, livePrice)},
            ]
            : candles;
        return mergeCandles(history, live);
    }, [candles, history, livePrice, liveStamp]);

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

    // 종목 비교: 일봉 이상은 종류를 섞어, 분봉은 같은 종류끼리만 비교한다.
    const comparison = useMemo(
        () => (rule.comparison ? createComparisonSource(market as ComparisonMarket, chartType, code) : undefined),
        [rule.comparison, market, chartType, code],
    );

    return (
        <Box ref={containerRef}>
            {wide && loading && (
                <Stack direction="row" spacing={1} sx={{px: 2, pb: 1, alignItems: 'center', minHeight: 40}}>
                    {controls}
                </Stack>
            )}
            {/* 차트는 스스로 이동·확대하므로 차지한 너비에 맞춘다. 선·영역 등 차트 종류는 차트 안에서 고른다. */}
            {loading ? (
                <Skeleton variant="rectangular" height={height} sx={{mx: 2, mb: 2, borderRadius: 1}}/>
            ) : (
                <CandleChart
                    candles={fullCandles}
                    timeUnit={timeUnitOf(chartType)}
                    interval={countdownIntervalOf(market, chartType)}
                    seriesKey={seriesKey}
                    assetType={storage.assetType}
                    assetCode={storage.assetCode}
                    onLoadOlder={rule.history ? loadOlder : undefined}
                    comparison={comparison}
                    priceLines={targetLines}
                    onPriceLineMove={handleTargetMove}
                    toolbarStart={wide ? controls : undefined}
                    height={height}
                />
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
