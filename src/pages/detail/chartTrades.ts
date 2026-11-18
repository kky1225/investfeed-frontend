import type {Candle, PriceLine, TradeMarker} from "../../lib/chart/types.ts";
import type {StockTrade, StockTradeHolding} from "../../type/HoldingType.ts";
import {parseChartTime} from "./chartCandles.ts";

// 내 매매(체결·보유)를 차트의 표시로 바꾼다. 여러 증권사의 매매는 캔들 하나에 매수·매도를 각각 하나로 합치고,
// 증권사별 내역은 표시에 마우스를 올렸을 때 적는 줄에 담는다.

const DATE_LENGTH = 8;  // yyyyMMdd. 이보다 길면 체결 시각이 있는 것
const MINUTE_MS = 60_000;

const quantityText = (quantity: number) => `${quantity.toLocaleString(undefined, {maximumFractionDigits: 6})}주`;

/** time 이 들어가는 캔들의 순번: time 이하에서 가장 늦게 시작한 캔들. 첫 캔들보다 앞이면 -1 */
const candleIndexAt = (candles: Candle[], time: number): number => {
    let low = 0;
    let high = candles.length - 1;
    let found = -1;
    while (low <= high) {
        const middle = (low + high) >> 1;
        if (candles[middle].time <= time) {
            found = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    return found;
};

interface Sum {
    quantity: number,
    amount: number,     // 수량 × 단가의 합. 평균 단가를 낼 때 쓴다
}

const add = (sum: Sum | undefined, quantity: number, price: number): Sum => ({
    quantity: (sum?.quantity ?? 0) + quantity,
    amount: (sum?.amount ?? 0) + quantity * price,
});

/**
 * 체결 목록을 캔들별 표시로 바꾼다.
 * - 일봉 이상: 체결한 날이 들어가는 캔들에 찍는다(주봉·월봉은 그 주·달의 캔들).
 * - 분봉(minutes 가 분 단위, 일봉 이상이면 null): 체결 시각이 있는 매매만 그 시각을 담는 캔들에 찍는다.
 *   시각을 주지 않는 증권사의 매매와, 그 시각의 캔들이 없는 매매(차트에 없는 장외 시간, 받아 두지 않은 날)는 찍지 않는다.
 * 받아 둔 첫 캔들보다 앞선 매매는 찍지 않는다(과거 구간을 이어 받으면 찍힌다).
 * formatPrice: 단가를 적는 방법.
 */
export const tradeMarkersOf = (
    candles: Candle[], trades: StockTrade[], minutes: number | null, formatPrice: (price: number) => string,
): TradeMarker[] => {
    const intraday = minutes !== null;
    // 캔들 순번 + 방향 → 전체 합과 증권사별 합
    const groups = new Map<string, { index: number, side: 'buy' | 'sell', total: Sum, brokers: Map<string, Sum> }>();
    trades.forEach(trade => {
        const hasTime = trade.dt.length > DATE_LENGTH;
        if (intraday && !hasTime) return;
        const time = parseChartTime(intraday ? trade.dt : trade.dt.slice(0, DATE_LENGTH));
        const index = Number.isFinite(time) ? candleIndexAt(candles, time) : -1;
        if (index < 0) return;
        // 분봉은 체결 시각이 그 캔들의 기간 안일 때만 찍는다. 아니면 앞 캔들(전날 마지막 캔들 등)에 잘못 붙는다.
        if (intraday && time >= candles[index].time + minutes * MINUTE_MS) return;
        const side = trade.side === 'BUY' ? 'buy' : 'sell';
        const key = `${index}|${side}`;
        const group = groups.get(key) ?? {index, side, total: {quantity: 0, amount: 0}, brokers: new Map<string, Sum>()};
        group.total = add(group.total, trade.quantity, trade.price);
        group.brokers.set(trade.broker, add(group.brokers.get(trade.broker), trade.quantity, trade.price));
        groups.set(key, group);
    });

    return [...groups.values()].map(({index, side, total, brokers}) => {
        const name = side === 'buy' ? '매수' : '매도';
        const summary = `${name} ${quantityText(total.quantity)} · 평균 ${formatPrice(total.amount / total.quantity)}`;
        const lines = brokers.size === 1
            ? [`${summary} (${[...brokers.keys()][0]})`]
            : [
                summary,
                ...[...brokers].map(([broker, sum]) => (
                    `${broker} ${quantityText(sum.quantity)} · ${formatPrice(sum.amount / sum.quantity)}`
                )),
            ];
        return {time: candles[index].time, side, lines};
    });
};

/**
 * 평단가 선. 여러 증권사에 나눠 갖고 있으면 수량으로 가중한 평균 하나만 긋고, 증권사별 수량·평단가는 선의 이름에 적는다.
 * 보유가 없으면 null. 평균은 priceDecimals 자리로 맞춘다(가격축 라벨이 나눗셈의 긴 소수를 그대로 적지 않게).
 */
export const averagePriceLineOf = (
    holdings: StockTradeHolding[], formatPrice: (price: number) => string, priceDecimals: number,
): PriceLine | null => {
    const total = holdings.reduce<Sum>((sum, holding) => add(sum, holding.quantity, holding.avgPrice), {quantity: 0, amount: 0});
    if (total.quantity <= 0) return null;
    const detail = holdings.length > 1
        ? ` (${holdings.map(({broker, quantity, avgPrice}) => `${broker} ${quantityText(quantity)} ${formatPrice(avgPrice)}`).join(' / ')})`
        : '';
    return {
        price: Number((total.amount / total.quantity).toFixed(priceDecimals)),
        title: `평단가 ${quantityText(total.quantity)}${detail}`,
        tone: 'neutral',
    };
};
