import type {Candle} from "../../lib/chart/types.ts";
import type {CryptoChart} from "../../type/CryptoType.ts";

// 서버가 주는 차트 목록을 차트의 캔들로 바꾼다. 상세 화면과 종목 비교가 함께 쓴다.

/** 키움 차트의 한 줄 (국내 주식 · 미국 주식) */
export interface KiwoomChartRow {
    dt?: string | null,         // yyyyMMdd 또는 yyyyMMddHHmmss
    curPrc?: string | null,
    openPric?: string | null,
    highPric?: string | null,
    lowPric?: string | null,
    trdeQty?: string | null,
}

/** 키움 차트 시각(yyyy, yyyyMMdd 또는 yyyyMMddHHmmss) → epoch ms. 월·일이 없으면 1로 본다. 연도도 없으면 NaN */
export const parseChartTime = (dt: string): number => dt.length < 4 ? NaN : new Date(
    Number(dt.slice(0, 4)),
    (Number(dt.slice(4, 6)) || 1) - 1,
    Number(dt.slice(6, 8)) || 1,
    Number(dt.slice(8, 10)),
    Number(dt.slice(10, 12)),
).getTime();

/** 키움 가격은 등락 부호(+/-)가 앞에 붙어 올 수 있어 떼고 읽는다. */
export const parseChartPrice = (price: string | null | undefined): number =>
    price ? Number(price.replace(/^[+-]/, '')) : NaN;

const isValid = (candle: Candle) => (
    [candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
);

/** 키움 차트 목록을 캔들(오래된 순)로 바꾼다. 값이 깨진 항목은 버린다. */
export const kiwoomCandles = (list: KiwoomChartRow[]): Candle[] => list
    .map(item => ({
        time: parseChartTime((item.dt ?? '').replace(/\s+/g, '')),
        open: parseChartPrice(item.openPric),
        high: parseChartPrice(item.highPric),
        low: parseChartPrice(item.lowPric),
        close: parseChartPrice(item.curPrc),
        volume: Number(item.trdeQty) || 0,
    }))
    .filter(isValid)
    .sort((a, b) => a.time - b.time);

/** 코인 차트 목록을 캔들(오래된 순)로 바꾼다. 숫자가 아닌 행은 뺀다. */
export const cryptoCandles = (list: CryptoChart[]): Candle[] => list
    .map(item => ({
        time: new Date(item.dt).getTime(),
        open: item.openingPrice,
        high: item.highPrice,
        low: item.lowPrice,
        close: item.tradePrice,
        volume: item.candleAccTradeVolume || 0,
    }))
    .filter(isValid)
    .sort((a, b) => a.time - b.time);
