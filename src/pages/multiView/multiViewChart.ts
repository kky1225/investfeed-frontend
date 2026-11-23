import {useEffect, useState} from "react";
import {useQueryClient, type QueryKey} from "@tanstack/react-query";
import type {AxiosRequestConfig} from "axios";
import {useAlert} from "../../context/AlertContext.tsx";
import type {Candle} from "../../lib/chart/types.ts";
import type {SelectedAsset, StreamUpdate} from "../../type/MultiViewType.ts";
import type {StockChartType, StockDetailRes} from "../../type/StockType.ts";
import type {UsStockChartType, UsStockDetailRes} from "../../type/UsStockType.ts";
import type {CryptoChartType, CryptoDetailRes} from "../../type/CryptoType.ts";
import type {CommodityChartType, CommodityDetailRes} from "../../type/CommodityType.ts";
import type {ApiResponse} from "../../type/AuthType.ts";
import {
    fetchMultiViewCommodityDetail, fetchMultiViewCryptoDetail, fetchMultiViewStockChart, fetchMultiViewUsStockChart,
} from "../../api/multiView/MultiViewApi.ts";
import {isMinuteChart} from "../detail/assetChart.ts";
import {cryptoCandles, kiwoomCandles} from "../detail/chartCandles.ts";

// 멀티 화면의 패널과 "차트 자세히 보기" 창이 함께 쓰는 것: 차트 조회, 머리(이름·가격·등락) 만들기, 캔들 변환.
// 차트 자체(주기 버튼, 저장 기준, 종목 비교 …)는 상세 화면과 같은 AssetChart 가 맡는다.

type StockChartRes = Pick<StockDetailRes, 'stockInfo' | 'stockChartList'>;
type UsStockChartRes = Pick<UsStockDetailRes, 'usStockInfo' | 'chartList'>;

/** 멀티 화면의 차트 조회 응답. 어느 것인지는 종목의 종류(asset.type)로 가린다 */
export type MultiViewChartRes = StockChartRes | UsStockChartRes | CryptoDetailRes | CommodityDetailRes;

/** 주기를 바꾼 조회의 상태. useQuery 의 결과를 그대로 넘긴다 */
interface ChartQueryState {
    data: unknown,
    isPlaceholderData: boolean,
    isError: boolean,
    isFetching: boolean,
}

/**
 * 주기를 바꾼 뒤 새 주기의 조회가 끝내 실패하면, 마지막으로 차트를 보여 준 주기로 되돌리고 안내 창을 띄운다.
 * 되돌리지 않으면 패널(창) 전체가 빈 자리로 바뀌어 주기 버튼까지 사라진다.
 * 실패한 조회는 지워 둔다. 남겨 두면 그 주기를 다시 골랐을 때 실패 상태로 시작해 직전 결과를 남기지 못한다.
 * assetKey: 지금 자산(다른 자산의 주기로 되돌리지 않게), queryKey: 지금 주기의 조회 키.
 */
export const useChartTypeFallback = (
    assetKey: string | null, chartType: string, setChartType: (chartType: string) => void,
    query: ChartQueryState, queryKey: QueryKey,
) => {
    const queryClient = useQueryClient();
    const showAlert = useAlert();
    // 마지막으로 차트를 보여 준 자산과 주기
    const [shown, setShown] = useState<{assetKey: string, chartType: string} | null>(null);
    const showing = query.data != null && !query.isPlaceholderData;
    if (showing && assetKey !== null && (shown?.assetKey !== assetKey || shown.chartType !== chartType)) {
        setShown({assetKey, chartType});
    }
    // 자산이 없어지면(창을 닫으면 자산을 비운다) 잊는다. 다시 연 창의 첫 조회가 실패했을 때 지난번 주기로 되돌리지 않게.
    if (assetKey === null && shown !== null) {
        setShown(null);
    }
    const failed = query.isError && !query.isFetching && query.data == null;
    const fallback = failed && shown !== null && shown.assetKey === assetKey && shown.chartType !== chartType
        ? shown.chartType
        : null;
    const failedKey = JSON.stringify(queryKey);
    useEffect(() => {
        if (fallback === null) return;
        queryClient.removeQueries({queryKey: JSON.parse(failedKey) as QueryKey, exact: true});
        setChartType(fallback);
        showAlert('주기를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.', 'warning');
    }, [fallback, failedKey, queryClient, setChartType, showAlert]);
};

export type Trend = 'up' | 'down' | 'neutral';

/** 패널 머리에 적는 값 */
export interface MultiViewSummary {
    title: string,
    value: string,      // 현재가 (표기까지 끝낸 글자)
    rate: string,       // 등락률 (% 없이)
    change: string,     // 등락 금액
    interval: string,   // 기준 시각
    trend: Trend,
}

export const fetchMultiViewChart = (
    asset: SelectedAsset, chartType: string, config?: AxiosRequestConfig,
): Promise<ApiResponse<MultiViewChartRes>> => {
    if (asset.type === 'STOCK') {
        return fetchMultiViewStockChart(asset.code, {chartType: chartType as StockChartType}, config);
    }
    if (asset.type === 'US_STOCK') {
        return fetchMultiViewUsStockChart(
            asset.code, {stexTp: asset.stexTp ?? '', chartType: chartType as UsStockChartType}, config,
        );
    }
    if (asset.type === 'CRYPTO') {
        return fetchMultiViewCryptoDetail(asset.code, {chartType: chartType as CryptoChartType}, config);
    }
    return fetchMultiViewCommodityDetail(asset.code, {chartType: chartType as CommodityChartType}, config);
};

/** 조회 응답을 캔들(오래된 순)로 바꾼다. */
export const candlesOf = (asset: SelectedAsset, data: MultiViewChartRes): Candle[] => {
    if (asset.type === 'STOCK') return kiwoomCandles((data as StockChartRes).stockChartList ?? []);
    if (asset.type === 'US_STOCK') return kiwoomCandles((data as UsStockChartRes).chartList ?? []);
    if (asset.type === 'CRYPTO') return cryptoCandles((data as CryptoDetailRes).chartList ?? []);
    return kiwoomCandles((data as CommodityDetailRes).commodityChartList ?? []);
};

const unsigned = (raw: string | null | undefined) => Number(String(raw ?? '0').replace(/^[+-]/, ''));

const usdFormat = (value: number) => value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4});

const kiwoomTrend = (sign: string | null | undefined): Trend => {
    if (sign === '1' || sign === '2') return 'up';
    if (sign === '4' || sign === '5') return 'down';
    return 'neutral';
};

/** 키움 시각(yyyyMMddHHmmss) → "yyyy.MM.dd HH:mm". 장 시간 밖(20시~8시)이면 "장마감" */
const kiwoomTimeLabel = (tm: string | null | undefined) => {
    if (!tm) return '';
    const date = `${tm.substring(0, 4)}.${tm.substring(4, 6)}.${tm.substring(6, 8)}`;
    const hour = Number(tm.substring(8, 10));
    return hour >= 20 || hour < 8 ? `${date} 장마감` : `${date} ${tm.substring(8, 10)}:${tm.substring(10, 12)}`;
};

/** 업비트 시각("2026-03-17T14:30:00" 또는 "20260318 143000") → "yyyy.MM.dd HH:mm" */
const cryptoTimeLabel = (dateTime: string | null | undefined) => {
    if (!dateTime) return '';
    if (dateTime.includes('T')) return dateTime.replace(/-/g, '.').replace('T', ' ').substring(0, 16);
    const cleaned = dateTime.replace(/\s+/g, '');
    if (cleaned.length < 12) return dateTime;
    return `${cleaned.substring(0, 4)}.${cleaned.substring(4, 6)}.${cleaned.substring(6, 8)} ${cleaned.substring(8, 10)}:${cleaned.substring(10, 12)}`;
};

/** 조회 응답에서 패널 머리에 적을 값을 만든다. 응답이 비어 있으면 null */
export const summaryOf = (asset: SelectedAsset, data: MultiViewChartRes): MultiViewSummary | null => {
    if (asset.type === 'STOCK') {
        const info = (data as StockChartRes).stockInfo;
        if (!info) return null;
        return {
            title: info.stkNm,
            value: unsigned(info.curPrc).toLocaleString(),
            rate: info.fluRt,
            change: info.predPre || '0',
            interval: kiwoomTimeLabel(info.tm),
            trend: kiwoomTrend(info.preSig),
        };
    }
    if (asset.type === 'US_STOCK') {
        const info = (data as UsStockChartRes).usStockInfo;
        if (!info) return null;
        const change = Number(info.predPre ?? '0');
        return {
            title: `${info.stkNm ?? info.stkEnm ?? asset.name} (${asset.code})`,
            value: usdFormat(unsigned(info.curPrc)),
            rate: String(info.fluRt ?? '0').replace(/^\+/, ''),
            change: String(Number.isFinite(change) ? change : 0),
            interval: '',
            trend: kiwoomTrend(info.predPreSig),
        };
    }
    if (asset.type === 'CRYPTO') {
        const info = (data as CryptoDetailRes).cryptoInfo;
        if (!info) return null;
        return {
            title: info.koreanName ?? asset.name,
            value: Number(info.tradePrice ?? 0).toLocaleString(),
            rate: ((info.signedChangeRate ?? 0) * 100).toFixed(2),
            change: String(info.signedChangePrice ?? 0),
            interval: cryptoTimeLabel(info.tradeDateTimeKst),
            trend: info.change === 'RISE' ? 'up' : info.change === 'FALL' ? 'down' : 'neutral',
        };
    }
    const info = (data as CommodityDetailRes).commodityInfo;
    if (!info) return null;
    return {
        title: info.stkNm,
        value: unsigned(info.curPrc).toLocaleString(),
        rate: info.fluRt ?? '0',
        change: info.predPre ?? '0',
        interval: kiwoomTimeLabel(info.tm),
        trend: kiwoomTrend(info.predPreSig),
    };
};

/** 실시간으로 받은 값을 머리에 덮어쓴다. */
export const withStream = (
    asset: SelectedAsset, summary: MultiViewSummary, stream: StreamUpdate | null | undefined,
): MultiViewSummary => {
    if (!stream) return summary;
    const price = Number(stream.value);
    return {
        ...summary,
        value: asset.type === 'US_STOCK' ? usdFormat(price) : price.toLocaleString(),
        rate: asset.type === 'US_STOCK' ? stream.fluRt.replace(/^\+/, '') : stream.fluRt,
        change: asset.type === 'US_STOCK' || asset.type === 'CRYPTO' ? String(Number(stream.predPre)) : stream.predPre,
        trend: stream.trend,
    };
};

/**
 * 차트의 마지막 캔들에 반영할 실시간 가격. 반영하지 않을 때는 null.
 * 미국 종목의 일봉 이상은 정규장 캔들인데 실시간 값은 장외 가격일 수 있어 반영하지 않는다.
 */
export const livePriceOf = (
    asset: SelectedAsset, chartType: string, stream: StreamUpdate | null | undefined,
): number | null => {
    if (!stream) return null;
    if (asset.type === 'US_STOCK' && !isMinuteChart(chartType)) return null;
    return Math.abs(Number(stream.value));
};
