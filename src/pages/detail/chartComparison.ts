import type {ComparisonAlign} from "../../lib/chart/comparison.ts";
import type {
    ChartComparisonSource, ComparisonMarket, ComparisonTarget,
} from "../../components/chart/useChartComparisons.ts";
import type {CandlePage} from "../../components/chart/useCandleHistory.ts";
import {fetchStockCandles, fetchStockSearch} from "../../api/stock/StockApi.ts";
import {fetchUsStockDetail, fetchUsStockSearch} from "../../api/usStock/UsStockApi.ts";
import {fetchCryptoDetail, fetchCryptoSearch} from "../../api/crypto/CryptoApi.ts";
import type {StockCandleRes, StockChartType} from "../../type/StockType.ts";
import type {UsStockChartType, UsStockDetailRes} from "../../type/UsStockType.ts";
import type {CryptoChartType, CryptoDetailRes} from "../../type/CryptoType.ts";
import {requireOk} from "../../lib/apiResponse.ts";
import {cryptoCandles, kiwoomCandles} from "./chartCandles.ts";

// 종목 비교에 쓰는 검색과 캔들 조회. 국내 주식·미국 주식·코인의 주기 이름이 같아(DAY, WEEK …) 그대로 넘긴다.

// 주기 → 캔들을 맞추는 기준. 여기에 없는 주기(분봉)는 캔들 시각으로 맞춘다
const ALIGN_BY: Record<string, ComparisonAlign | undefined> = {
    DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year',
};

const search = async (market: ComparisonMarket, keyword: string): Promise<ComparisonTarget[]> => {
    if (market === 'STOCK') {
        const found = requireOk<{ stkCd: string, stkNm: string }[] | null>(await fetchStockSearch(keyword), '종목 검색');
        return (found ?? []).map(item => ({market, code: item.stkCd, name: item.stkNm}));
    }
    if (market === 'US_STOCK') {
        const found = requireOk<{ stkCd: string, stkNm: string, stexTp?: string }[] | null>(
            await fetchUsStockSearch(keyword), '미국 종목 검색',
        );
        return (found ?? []).map(item => ({market, code: item.stkCd, name: item.stkNm, exchange: item.stexTp}));
    }
    const found = requireOk<{ market: string, koreanName: string }[] | null>(await fetchCryptoSearch(keyword), '코인 검색');
    return (found ?? []).map(item => ({market, code: item.market, name: item.koreanName}));
};

/** 과거를 이어 받는 조회가 없는 종류는 상세 조회가 주는 구간이 전부다. */
const singlePage = (candles: CandlePage['candles']): CandlePage => ({candles, nextCursor: null});

const fetchPage = async (chartType: string, target: ComparisonTarget, cursor: string | null): Promise<CandlePage> => {
    if (target.market === 'STOCK') {
        const page = requireOk<StockCandleRes>(
            await fetchStockCandles(
                target.code, {chartType: chartType as StockChartType, cursor: cursor ?? undefined}, {skipGlobalError: true},
            ),
            '비교 종목 차트 조회',
        );
        return {candles: kiwoomCandles(page.candles), nextCursor: page.nextCursor ?? null};
    }
    if (target.market === 'US_STOCK') {
        const detail = requireOk<UsStockDetailRes>(
            await fetchUsStockDetail(
                target.code, {stexTp: target.exchange ?? '', chartType: chartType as UsStockChartType}, {skipGlobalError: true},
            ),
            '비교 종목 차트 조회',
        );
        return singlePage(kiwoomCandles(detail.chartList ?? []));
    }
    const detail = requireOk<CryptoDetailRes>(
        await fetchCryptoDetail(target.code, {chartType: chartType as CryptoChartType}, {skipGlobalError: true}),
        '비교 코인 차트 조회',
    );
    return singlePage(cryptoCandles(detail.chartList ?? []));
};

/**
 * 상세 화면의 차트에 넘길 종목 비교 조회.
 * market: 보고 있는 화면의 종류, chartType: 지금 주기(MINUTE_5, DAY …).
 * 일봉·주봉·월봉·연봉은 종류를 섞어 비교하고, 분봉은 거래 시간이 달라 같은 종류끼리만 비교한다.
 */
export const createComparisonSource = (market: ComparisonMarket, chartType: string): ChartComparisonSource => {
    const align = ALIGN_BY[chartType] ?? 'time';
    return {
        market,
        mixed: align !== 'time',
        align,
        search,
        fetchPage: (target, cursor) => fetchPage(chartType, target, cursor),
    };
};
