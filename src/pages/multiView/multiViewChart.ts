import type {AxiosRequestConfig} from "axios";
import type {Candle, CandleInterval, TimeUnit} from "../../lib/chart/types.ts";
import type {ChartComparisonSource} from "../../components/chart/useChartComparisons.ts";
import type {AssetType} from "../../type/NotificationType.ts";
import type {SelectedAsset, StreamUpdate} from "../../type/MultiViewType.ts";
import type {StockChartType, StockDetailRes} from "../../type/StockType.ts";
import type {UsStockChartType, UsStockDetailRes} from "../../type/UsStockType.ts";
import type {CryptoChartType, CryptoDetailRes} from "../../type/CryptoType.ts";
import type {CommodityChartType, CommodityDetailRes} from "../../type/CommodityType.ts";
import type {ApiResponse} from "../../type/AuthType.ts";
import {
    fetchMultiViewCommodityDetail, fetchMultiViewCryptoDetail, fetchMultiViewStockChart, fetchMultiViewUsStockChart,
} from "../../api/multiView/MultiViewApi.ts";
import {createComparisonSource} from "../detail/chartComparison.ts";
import {cryptoCandles, kiwoomCandles} from "../detail/chartCandles.ts";

// 멀티 화면의 패널과 "차트 자세히 보기" 창이 함께 쓰는 것: 차트 조회, 머리(이름·가격·등락) 만들기, 캔들 변환.

type StockChartRes = Pick<StockDetailRes, 'stockInfo' | 'stockChartList'>;
type UsStockChartRes = Pick<UsStockDetailRes, 'usStockInfo' | 'chartList'>;

/** 멀티 화면의 차트 조회 응답. 어느 것인지는 종목의 종류(asset.type)로 가린다 */
export type MultiViewChartRes = StockChartRes | UsStockChartRes | CryptoDetailRes | CommodityDetailRes;

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

/** 차트 주기 버튼의 값(MINUTE, DAY …)과 분 단위를 조회에 쓰는 주기 이름으로 바꾼다. */
export const chartTypeOf = (toggle: string, minuteUnit: string) => (
    toggle === 'MINUTE' ? `MINUTE_${minuteUnit}` : toggle
);

export const isMinuteChart = (chartType: string) => chartType.startsWith('MINUTE');

/** 날짜 눈금 표기 단위. 주봉은 날짜까지 적는다 */
export const timeUnitOf = (chartType: string): TimeUnit => {
    if (isMinuteChart(chartType)) return 'minute';
    if (chartType === 'MONTH') return 'month';
    if (chartType === 'YEAR') return 'year';
    return 'day';
};

// 분봉 한 개가 담는 기간. 차트가 캔들 마감까지 남은 시간을 적는 데 쓴다 (일봉 이상은 적지 않는다)
const INTERVALS: Record<string, CandleInterval | undefined> = {
    MINUTE_1: {unit: 'minute', count: 1},
    MINUTE_3: {unit: 'minute', count: 3},
    MINUTE_5: {unit: 'minute', count: 5},
    MINUTE_30: {unit: 'minute', count: 30},
};

/** 미국 종목의 분봉 시각은 미국 동부 시각이라 기기 시계와 맞지 않아 남은 시간을 적지 않는다. */
export const intervalOf = (asset: SelectedAsset, chartType: string): CandleInterval | undefined => (
    asset.type === 'US_STOCK' ? undefined : INTERVALS[chartType]
);

/** 그린 선을 저장하는 기준. 상세 화면과 같아서 상세에서 그린 선이 그대로 보인다 */
export const chartStorageOf = (asset: SelectedAsset): { assetType: AssetType, assetCode: string } => {
    if (asset.type === 'CRYPTO') return {assetType: 'CRYPTO', assetCode: asset.code};
    if (asset.type === 'US_STOCK') return {assetType: 'STOCK', assetCode: `${asset.code}_US`};
    if (asset.type === 'COMMODITY') return {assetType: 'STOCK', assetCode: `${asset.code}_COMMODITY`};
    return {assetType: 'STOCK', assetCode: asset.code};
};

/** 종목 비교 조회. 원자재는 비교하지 않는다 */
export const comparisonOf = (asset: SelectedAsset, chartType: string): ChartComparisonSource | undefined => (
    asset.type === 'COMMODITY' ? undefined : createComparisonSource(asset.type, chartType, asset.code)
);

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
 * 실시간 가격을 마지막 캔들의 종가·고가·저가에 반영한다. 새 캔들은 주기적 조회로 받는다.
 * 미국 종목의 일봉 이상은 정규장 캔들인데 실시간 값은 장외 가격일 수 있어 반영하지 않는다.
 */
export const withLivePrice = (
    asset: SelectedAsset, chartType: string, candles: Candle[], stream: StreamUpdate | null | undefined,
): Candle[] => {
    const last = candles[candles.length - 1];
    const price = stream ? Math.abs(Number(stream.value)) : NaN;
    if (!last || !Number.isFinite(price) || price <= 0) return candles;
    if (asset.type === 'US_STOCK' && !isMinuteChart(chartType)) return candles;
    return [
        ...candles.slice(0, -1),
        {...last, close: price, high: Math.max(last.high, price), low: Math.min(last.low, price)},
    ];
};
