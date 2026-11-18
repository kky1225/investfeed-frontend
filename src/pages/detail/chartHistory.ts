import type {CandlePage} from "../../components/chart/useCandleHistory.ts";
import type {Candle} from "../../lib/chart/types.ts";
import type {ApiResponse} from "../../type/AuthType.ts";
import type {CryptoChart} from "../../type/CryptoType.ts";
import {requireOk} from "../../lib/apiResponse.ts";
import {fetchCommodityCandles} from "../../api/commodity/CommodityApi.ts";
import {fetchCryptoCandles} from "../../api/crypto/CryptoApi.ts";
import {fetchIndexCandles} from "../../api/index/IndexApi.ts";
import {fetchStockCandles} from "../../api/stock/StockApi.ts";
import {fetchUsStockCandles} from "../../api/usStock/UsStockApi.ts";
import type {StockChartType} from "../../type/StockType.ts";
import {ChartMarket, isMinuteChart} from "./assetChart.ts";
import {cryptoCandles, indexCandles, kiwoomCandles, KiwoomChartRow} from "./chartCandles.ts";

// 차트의 과거 구간 조회. 자산 종류마다 조회와 캔들 변환이 다른 것을 여기 한 곳에 모은다.

/** 서버가 주는 과거 구간 한 페이지 */
interface CandlePageRes<Row> {
    candles: Row[],
    nextCursor: string | null,
}

const NO_HISTORY: CandlePage = {candles: [], nextCursor: null};
const QUIET = {skipGlobalError: true};  // 실패해도 화면에 오류를 띄우지 않는다(잠시 뒤 다시 시도한다)

const pageOf = <Row>(
    res: ApiResponse<CandlePageRes<Row>>, toCandles: (rows: Row[]) => Candle[],
): CandlePage => {
    const page = requireOk<CandlePageRes<Row>>(res, '과거 차트 조회');
    return {candles: toCandles(page.candles), nextCursor: page.nextCursor ?? null};
};

/**
 * 과거 구간을 이어 받을 수 있는 차트인지.
 * 미국 종목은 거래소를 알아야 조회할 수 있고, 원자재 분봉은 당일 것만 있어 이어 받을 과거가 없다.
 */
export const hasCandleHistory = (market: ChartMarket, chartType: string, exchange?: string): boolean => {
    if (market === 'US_STOCK') return Boolean(exchange);
    if (market === 'COMMODITY') return !isMinuteChart(chartType);
    return true;
};

/** 과거 구간 한 페이지. cursor 가 null 이면 가장 최근 구간, 앞선 페이지의 nextCursor 를 주면 그 이전 구간 */
export const fetchCandlePage = async (
    market: ChartMarket, code: string, chartType: string, cursor: string | null, exchange?: string,
): Promise<CandlePage> => {
    if (!hasCandleHistory(market, chartType, exchange)) return NO_HISTORY;
    const req = {chartType, cursor: cursor ?? undefined};
    switch (market) {
        case 'STOCK':
            return pageOf<KiwoomChartRow>(
                await fetchStockCandles(code, {...req, chartType: chartType as StockChartType}, QUIET), kiwoomCandles,
            );
        case 'US_STOCK':
            return pageOf<KiwoomChartRow>(
                await fetchUsStockCandles(code, {...req, stexTp: exchange ?? ''}, QUIET), kiwoomCandles,
            );
        case 'CRYPTO':
            return pageOf<CryptoChart>(await fetchCryptoCandles(code, req, QUIET), cryptoCandles);
        case 'INDEX':
            return pageOf<KiwoomChartRow>(await fetchIndexCandles(code, req, QUIET), indexCandles);
        case 'COMMODITY':
            return pageOf<KiwoomChartRow>(await fetchCommodityCandles(code, req, QUIET), kiwoomCandles);
    }
};
