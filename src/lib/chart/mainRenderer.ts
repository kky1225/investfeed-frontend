import {Candle, ChartStyle, ChartType, PriceLine, SeriesStroke, TimeUnit} from "./types.ts";import {Series} from "./indicators.ts";
import {
    createLinearScale, createLogScale, decimalsOf, formatPercent, formatPrice, formatVolume, logTicks, niceTicks,
} from "./scale.ts";
import {timeTicks} from "./timeAxis.ts";
import {ComparisonLine, scaleComparison} from "./comparison.ts";
import {
    AXIS_LABEL_OFFSET, AXIS_TAG_HEIGHT, FONT_SIZE, LEGEND_LEFT, PRICE_PANE_TOP, TIME_AXIS_HEIGHT,
} from "./constants.ts";
import {clamp, isNumber, Layout, Span, tagCenterWithin, VisibleRange} from "./layout.ts";
import {candleColor, lineColor, Painter, textColorOf} from "./painter.ts";
import {drawIndicatorPane, OverlayIndicator, PaneIndicator} from "./indicatorPanes.ts";

// 아래 장: 캔들·거래량·이동평균선·축·현재가 선·가격선·보조지표 영역

export const PANE_GAP = 8;      // 가격 영역과 거래량 영역 사이. 둘을 나누는 선은 이 가운데에 긋는다
const PRICE_TICK_GAP = 32;      // 가격 눈금 사이 최소 간격
const TIME_TICK_GAP = 96;       // 날짜 눈금 사이 최소 간격
const TIME_LABEL_GAP = 12;      // 날짜 눈금의 글자와 글자 사이에 남기는 최소 여백
const CURRENT_PRICE_DASH = [2, 2];
const COUNTDOWN_HEIGHT = 14;    // 현재가 라벨 아래에 남은 시간을 적는 줄의 높이
const PRICE_LINE_DASH = [6, 4];
const PRICE_LINE_TITLE_OFFSET = 8;  // 선과 그 위 이름 사이
const ACTIVE_PRICE_LINE_WIDTH = 2;  // 마우스를 올렸거나 끌고 있는 가격선의 굵기 (보통 선의 배수)
const PRICE_LINE_TITLE_GAP = 18;    // 가격선 사이가 이보다 좁으면 이름이 위 선과 겹치므로 적지 않는다
// 내 매매 화살표: 막대 끝에 화살촉이 달린 선 화살표 (트레이딩뷰의 체결 표시와 같은 모양)
// 차트의 다른 선(캔들 꼬리, 지표 선)과 어울리게 가늘고 작게 둔다. 굵고 크면 차트 위에 따로 얹은 것처럼 뜬다
const TRADE_MARK_HALF_WIDTH = 4;    // 화살촉의 반 너비
const TRADE_MARK_HEAD_HEIGHT = 4.5; // 화살촉의 높이
const TRADE_MARK_LENGTH = 13;       // 화살표 전체 길이 (화살촉 끝에서 막대 끝까지)
const TRADE_MARK_GAP = 4;           // 캔들과 화살촉 끝 사이
const TRADE_MARK_LINE_WIDTH = 1.5;  // 화살표 선 굵기
const TRADE_MARK_HALO = 1;          // 화살표를 둘러싼 바탕색 테두리의 두께

/** 내 매매 표시 하나: 캔들 순번과 방향 */
export interface TradeMark {
    index: number,
    side: 'buy' | 'sell',
}

/** 현재가 라벨이 차지한 자리. line: 현재가 선의 높이(라벨은 가격 영역 안으로 당겨져 선과 어긋날 수 있다). */
interface TagSpan extends Span {
    line: number,
}
const EXTREME_LABEL_GAP = 4;        // 최고·최저가 표시와 캔들 사이 (가로)
// 거래량 눈금: 보이는 구간의 상위 2% 를 뺀 값의 2배까지만 잡는다. 튀는 막대 하나가 나머지를 납작하게 누르지 않게 한다
const VOLUME_PERCENTILE = 0.98;
const VOLUME_OUTLIER_RATIO = 2;
const MIN_PRICE_TICK_GAP = 20;      // 가격 눈금 글자가 겹치지 않는 최소 간격 (로그 축에서 촘촘한 눈금을 거를 때)
const CLOSE_LINE_COLOR = 4;         // 선·영역 차트의 선 색 (style.lineColors 안에서의 순서)
const AREA_FILL_ALPHA = 0.12;
const PERCENT_DECIMALS = 2;         // 퍼센트 축에서 현재가·십자선·수평선 라벨의 소수 자릿수
const BASELINE_DASH = [2, 2];       // 기준선 차트의 기준 가격에 긋는 점선

export interface MainInput {
    candles: Candle[],          // 한 개 이상
    chartType: ChartType,
    shapes: Candle[],           // 모양을 그릴 캔들. 하이킨아시면 다시 만든 캔들이고, 그 밖에는 candles 와 같다
    logScale: boolean,          // 가격축을 로그로
    percentScale: boolean,      // 가격축에 가격 대신 등락률(%)을 적는다. 기준은 보이는 첫 캔들의 종가
    priceZoom: number,         // 가격축 세로 배율. 1 이면 보이는 구간에 딱 맞추고, 클수록 범위가 넓어져 캔들이 납작해진다
    // 가격 범위를 위아래로 옮긴 정도. 보이는 범위의 몇 배인지로 적는다(0 이면 가운데, 양수면 범위가 위로 가서 캔들이 내려간다)
    priceShift: number,
    timeUnit: TimeUnit,
    style: ChartStyle,
    width: number,             // 캔버스 너비 (CSS px)
    mainHeight: number,         // 가격+거래량 영역의 높이. 날짜축을 포함한다 (CSS px)
    volumeRatio: number,        // 가격+거래량 높이 중 거래량 영역의 비율
    indicatorHeights: number[], // indicators 와 같은 순서의 영역 높이 (CSS px)
    range: VisibleRange,
    averages: Series[],         // 이동평균선
    averageColors: number[],    // 이동평균선마다의 색 순번. 없는 자리는 순서대로의 색
    averageStrokes: SeriesStroke[],     // 이동평균선마다의 굵기·점선. 없는 자리는 굵기 1, 실선
    indicators: PaneIndicator[],        // 위에서 아래로 쌓을 별도 영역 지표
    priceOverlays: OverlayIndicator[],  // 가격 영역에 겹칠 지표
    volumeOverlays: OverlayIndicator[], // 거래량 영역에 겹칠 지표
    priceLines: PriceLine[],
    activePriceLine: string | null, // 마우스를 올렸거나 끌고 있는 가격선의 id. 그 선을 강조해 그린다
    tradeMarks: TradeMark[],        // 내 매매 표시
    // 비교 종목: 주 종목의 캔들 순번에 맞춘 종가와 선 색 순번. 있으면 percentScale 도 켜서 넘길 것
    comparisons: { closes: Series, color: number }[],
    flatByPrevClose: boolean,
    grid: boolean,              // 격자선(가격 눈금의 가로선, 날짜 눈금의 세로선)을 그을지. 눈금 글자와 경계선은 늘 그린다
    axisWidth: number,      // 오른쪽 가격축 너비 (CSS px)
    valueDecimals: number,      // 캔들 가격의 소수 자릿수
    countdown: string | null,   // 현재가 라벨 아래에 적을, 마지막 캔들이 마감하기까지 남은 시간. 없으면 적지 않는다
}

/** 한 번 그리는 동안 여러 함수가 함께 쓰는 값. 높이·너비는 CSS px, 이름이 Px 로 끝나면 기기 픽셀 */
interface Frame {
    painter: Painter,
    style: ChartStyle,
    candles: Candle[],
    shapes: Candle[],
    chartType: ChartType,
    logScale: boolean,
    visible: Candle[],      // 보이는 캔들
    range: VisibleRange,
    timeUnit: TimeUnit,
    flatByPrevClose: boolean,
    grid: boolean,
    plotWidth: number,
    plotBottom: number,     // 날짜축 위
    mainBottom: number,     // 거래량 영역 아래 (보조지표 위)
    priceTop: number,
    priceBottom: number,
    volumeTop: number,
    priceMin: number,
    priceMax: number,
    volumeMax: number,
    priceY: (value: number) => number,
    volumeY: (value: number) => number,
    line: number,
    plotRightPx: number,
    plotBottomPx: number,
    axisLabelX: number,
    axisWidthPx: number,
    valueDecimals: number,
    percentBase: number | null,     // 퍼센트 축의 기준 가격(0%). 퍼센트 축이 아니면 null
    /** 가격축에 적을 글자: 퍼센트 축이면 기준 대비 등락률, 아니면 decimals 자리의 가격 */
    axisText: (price: number, decimals: number) => string,
    baseline: number,               // 기준선 차트의 기준 가격
    countdown: string | null,       // 현재가 라벨 아래에 적을 남은 시간
    comparisons: { line: ComparisonLine, color: number }[],     // 비교 종목의 선
}

/** 가격 눈금: 가로 격자 + 오른쪽 라벨. 눈금의 소수 자릿수를 돌려준다. */
const drawPriceAxis = (frame: Frame): number => {
    const {painter, style, candles, priceMin, priceMax, priceTop, priceBottom, priceY, line, plotRightPx, axisLabelX} = frame;
    const ctx = painter.ctx;
    const maxCount = Math.floor((priceBottom - priceTop) / PRICE_TICK_GAP);
    const {percentBase} = frame;
    // 퍼센트 축은 등락률이 보기 좋은 숫자(±5%, ±10%)가 되는 자리에 눈금을 놓는다.
    const toPercent = (price: number) => (price / (percentBase ?? 1) - 1) * 100;
    const percentTicks = percentBase ? niceTicks(toPercent(priceMin), toPercent(priceMax), maxCount) : null;
    const priceTicks = percentTicks
        ? {values: percentTicks.values.map(percent => percentBase! * (1 + percent / 100)), decimals: 0}
        : frame.logScale ? logTicks(priceMin, priceMax, maxCount) : niceTicks(priceMin, priceMax, maxCount);
    const labelOf = (value: number) => percentTicks
        ? formatPercent(toPercent(value), percentTicks.decimals)
        : formatPrice(value, priceTicks.decimals);
    ctx.textAlign = 'left';
    // 현재가 라벨에 가려질 눈금 글자는 적지 않는다(격자선은 그린다).
    const labelClearance = painter.px(AXIS_TAG_HEIGHT);
    // 남은 시간을 적으면 현재가 라벨이 그만큼 아래로 길어진다.
    const countdownHeight = frame.countdown ? painter.px(COUNTDOWN_HEIGHT) : 0;
    const clearanceBelow = labelClearance + countdownHeight;
    // 라벨은 가격 영역 안으로 당겨져 놓이므로 그 자리를 기준으로 본다. 현재가가 범위 밖이면 라벨이 없으니 가릴 것도 없다.
    const currentPrice = candles[candles.length - 1].close;
    const currentPriceY = currentPrice < priceMin || currentPrice > priceMax
        ? Infinity
        : tagCenter(frame, painter.px(priceY(currentPrice)), countdownHeight);
    // 로그 축의 눈금은 아래쪽으로 갈수록 촘촘해지므로, 위에서부터 보며 바로 위 눈금과 너무 붙은 것은 건너뛴다.
    const minGap = painter.px(MIN_PRICE_TICK_GAP);
    let previousY = -Infinity;
    [...priceTicks.values].reverse().forEach(value => {
        const y = painter.px(priceY(value));
        if (y - previousY < minGap) return;
        previousY = y;
        if (frame.grid) {
            ctx.fillStyle = style.gridColor;
            ctx.fillRect(0, y, plotRightPx, line);
        }
        if (y - currentPriceY > -labelClearance && y - currentPriceY < clearanceBelow) return;
        ctx.fillStyle = style.textColor;
        ctx.fillText(labelOf(value), axisLabelX, y);
    });
    return priceTicks.decimals;
};

/** 거래량 눈금: 오른쪽 라벨만 */
const drawVolumeAxis = ({painter, style, volumeMax, volumeY, axisLabelX}: Frame) => {
    const ctx = painter.ctx;
    ctx.fillStyle = style.textColor;
    niceTicks(0, volumeMax, 2).values
        .filter(value => value > 0)
        .forEach(value => {
            ctx.fillText(formatVolume(value), axisLabelX, painter.px(volumeY(value)));
        });
};

/**
 * 날짜 눈금: 세로 격자 + 아래 라벨. 달력의 경계(날·달·분기·해가 바뀌는 첫 캔들)에 놓는다.
 * 경계의 간격이 고르지 않아 글자가 겹치는 자리는 큰 경계를 남기고 작은 쪽을 뺀다.
 */
const drawTimeAxis = ({painter, style, candles, range, timeUnit, grid, plotBottom, line, plotRightPx, plotBottomPx}: Frame) => {
    const ctx = painter.ctx;
    const gap = painter.px(TIME_LABEL_GAP);
    const placed: { x: number, half: number, label: string }[] = [];
    ctx.textAlign = 'center';
    timeTicks(candles, range, timeUnit, TIME_TICK_GAP)
        .map(tick => ({...tick, x: painter.centerX(tick.index, range), half: ctx.measureText(tick.label).width / 2}))
        .filter(tick => tick.x - tick.half >= 0 && tick.x + tick.half <= plotRightPx)
        .sort((a, b) => b.rank - a.rank || a.index - b.index)
        .forEach(tick => {
            if (placed.some(other => Math.abs(other.x - tick.x) < other.half + tick.half + gap)) return;
            placed.push(tick);
        });
    placed.forEach(({x, label}) => {
        if (grid) {
            ctx.fillStyle = style.gridColor;
            ctx.fillRect(x, 0, line, plotBottomPx);
        }
        ctx.fillStyle = style.textColor;
        ctx.fillText(label, x, painter.px(plotBottom + TIME_AXIS_HEIGHT / 2));
    });
};

/** 축 경계선과 가격·거래량 사이의 선 */
const drawBorders = ({painter, style, volumeTop, line, plotRightPx, plotBottomPx}: Frame) => {
    const ctx = painter.ctx;
    ctx.fillStyle = style.gridColor;
    ctx.fillRect(plotRightPx, 0, line, plotBottomPx);
    ctx.fillRect(0, plotBottomPx, plotRightPx + line, line);
    ctx.fillRect(0, painter.px(volumeTop - PANE_GAP / 2), plotRightPx, line);
};

/** 선·영역 차트: 종가를 선으로 잇고, 영역이면 선 아래를 가격 영역 바닥까지 옅게 채운다. */
const drawCloseLine = ({painter, style, candles, chartType, range, priceBottom, priceY}: Frame) => {
    const ctx = painter.ctx;
    const color = lineColor(style, CLOSE_LINE_COLOR);
    const closes: Series = candles.map(candle => candle.close);

    if (chartType === 'area') {
        // 선과 같이 양옆 한 칸씩 더 잡아 가장자리에서 끊겨 보이지 않게 한다.
        const start = Math.max(0, range.from - 1);
        const end = Math.min(candles.length, range.from + range.count + 1);
        if (end - start > 1) {
            const bottomPx = painter.px(priceBottom);
            ctx.beginPath();
            ctx.moveTo(painter.centerX(start, range), bottomPx);
            for (let index = start; index < end; index++) {
                ctx.lineTo(painter.centerX(index, range), priceY(candles[index].close) * painter.dpr);
            }
            ctx.lineTo(painter.centerX(end - 1, range), bottomPx);
            ctx.closePath();
            ctx.globalAlpha = AREA_FILL_ALPHA;
            ctx.fillStyle = color;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
    painter.strokeSeries(closes, range, priceY, color);
};

/** 종가만 그리는 차트 종류인지. 가격축 범위와 최고·최저 표시를 종가 기준으로 잡는다. */
const isCloseOnly = (chartType: ChartType) => chartType === 'line' || chartType === 'area' || chartType === 'baseline';

/**
 * 기준선 차트: 종가를 잇는 선과 기준 가격 사이를 칠한다. 기준 가격보다 위는 상승색, 아래는 하락색.
 * 같은 선을 기준 가격의 위쪽과 아래쪽으로 잘라 두 번 그린다.
 */
const drawBaseline = (frame: Frame) => {
    const {painter, style, candles, range, priceTop, priceBottom, priceY, baseline, line, plotRightPx} = frame;
    const ctx = painter.ctx;
    const closes: Series = candles.map(candle => candle.close);
    const {start, end} = painter.seriesSpan(closes, range);
    const baseY = painter.px(priceY(baseline));
    const sides = [
        {color: style.upColor, top: painter.px(priceTop), bottom: baseY},
        {color: style.downColor, top: baseY, bottom: painter.px(priceBottom)},
    ];
    sides.forEach(({color, top, bottom}) => {
        if (bottom <= top) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, top, plotRightPx, bottom - top);
        ctx.clip();
        if (end - start > 1) {
            ctx.beginPath();
            ctx.moveTo(painter.centerX(start, range), baseY);
            for (let index = start; index < end; index++) {
                ctx.lineTo(painter.centerX(index, range), priceY(candles[index].close) * painter.dpr);
            }
            ctx.lineTo(painter.centerX(end - 1, range), baseY);
            ctx.closePath();
            ctx.globalAlpha = AREA_FILL_ALPHA;
            ctx.fillStyle = color;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        painter.strokeSeries(closes, range, priceY, color);
        ctx.restore();
    });

    // 기준 가격
    ctx.strokeStyle = style.textColor;
    ctx.lineWidth = line;
    ctx.setLineDash(BASELINE_DASH.map(length => painter.px(length)));
    ctx.beginPath();
    ctx.moveTo(0, baseY + line / 2);
    ctx.lineTo(plotRightPx, baseY + line / 2);
    ctx.stroke();
    ctx.setLineDash([]);
};

/**
 * 속 빈 캔들 하나. 색은 전 캔들의 종가와 비교해 정하고(오르면 상승색), 몸통은 종가가 시가보다 높으면 비운다.
 * x: 캔들 가운데, bodyLeft·bodyWidth: 몸통의 자리 (기기 픽셀)
 */
const drawHollowCandle = (frame: Frame, index: number, x: number, bodyLeft: number, bodyWidth: number) => {
    const {painter, style, candles, priceY, line} = frame;
    const ctx = painter.ctx;
    const candle = candles[index];
    const reference = candles[index - 1]?.close ?? candle.open;
    ctx.fillStyle = candle.close >= reference ? style.upColor : style.downColor;

    const highY = painter.px(priceY(candle.high));
    const lowY = painter.px(priceY(candle.low));
    const top = painter.px(priceY(Math.max(candle.open, candle.close)));
    const bottom = Math.max(top + 1, painter.px(priceY(Math.min(candle.open, candle.close))));
    const wickLeft = x - Math.floor(line / 2);
    // 테두리를 그릴 자리가 없을 만큼 작으면 채워 그린다.
    const hollow = candle.close > candle.open && bottom - top > line * 2 && bodyWidth > line * 2;
    if (!hollow) {
        ctx.fillRect(wickLeft, highY, line, Math.max(1, lowY - highY));
        ctx.fillRect(bodyLeft, top, bodyWidth, bottom - top);
        return;
    }
    // 꼬리는 몸통 밖에만 그려, 빈 몸통을 가로지르지 않게 한다.
    if (top > highY) ctx.fillRect(wickLeft, highY, line, top - highY);
    if (lowY > bottom) ctx.fillRect(wickLeft, bottom, line, lowY - bottom);
    ctx.fillRect(bodyLeft, top, bodyWidth, line);
    ctx.fillRect(bodyLeft, bottom - line, bodyWidth, line);
    ctx.fillRect(bodyLeft, top, line, bottom - top);
    ctx.fillRect(bodyLeft + bodyWidth - line, top, line, bottom - top);
};

/**
 * 캔들 + 거래량 + 이동평균선 + 겹쳐 그리는 지표. 드래그로 반쯤 걸친 캔들이 축 영역으로 넘어가지 않게 자른다.
 * 가격 영역 지표(볼린저밴드의 채움 등)는 캔들 뒤에, 선들은 캔들 앞에 놓인다.
 * 가격 영역과 거래량 영역은 따로 자른다. 가격축을 끌어 세로로 늘리거나 옮기면 캔들이 가격 영역을 벗어나는데,
 * 함께 자르면 그 캔들이 거래량 막대 위에 겹쳐 그려진다.
 */
const drawCandles = (
    frame: Frame, averages: Series[], averageColors: number[], averageStrokes: SeriesStroke[],
    priceOverlays: OverlayIndicator[], volumeOverlays: OverlayIndicator[],
) => {
    const {
        painter, style, candles, shapes, chartType, visible, range, flatByPrevClose,
        plotWidth, mainBottom, priceTop, priceBottom, volumeTop, priceY, volumeY, line,
    } = frame;
    const ctx = painter.ctx;
    const mainBottomPx = painter.px(mainBottom);
    const bodyWidth = painter.bodyWidth(range);
    const halfWidth = Math.floor(bodyWidth / 2);
    painter.clipped(priceTop, priceBottom, plotWidth, () => {
        priceOverlays.forEach(overlay => overlay.draw({painter, range, style, toY: priceY}));

        if (chartType === 'line' || chartType === 'area') drawCloseLine(frame);
        else if (chartType === 'baseline') drawBaseline(frame);

        visible.forEach((_, offset) => {
            const index = range.from + offset;
            const x = painter.centerX(index, range);
            const bodyLeft = x - halfWidth;

            if (chartType === 'hollow') {
                drawHollowCandle(frame, index, x, bodyLeft, bodyWidth);
            } else if (chartType === 'candle' || chartType === 'heikinAshi' || chartType === 'bar') {
                // 하이킨아시는 평균값으로 다시 만든 캔들을 그리고, 색도 그 캔들의 시가·종가로 정한다.
                const shape = shapes[index];
                ctx.fillStyle = candleColor(chartType === 'heikinAshi' ? shapes : candles, index, style,
                    chartType !== 'heikinAshi' && flatByPrevClose);

                // 꼬리 (봉에서는 세로선)
                const highY = painter.px(priceY(shape.high));
                const lowY = painter.px(priceY(shape.low));
                ctx.fillRect(x - Math.floor(line / 2), highY, line, Math.max(1, lowY - highY));

                const openY = painter.px(priceY(shape.open));
                const closeY = painter.px(priceY(shape.close));
                if (chartType === 'bar') {
                    // 봉: 왼쪽 눈금이 시가, 오른쪽 눈금이 종가
                    const tick = Math.max(1, halfWidth);
                    ctx.fillRect(x - tick, openY - Math.floor(line / 2), tick, line);
                    ctx.fillRect(x, closeY - Math.floor(line / 2), tick + line, line);
                } else {
                    // 몸통 (시가 = 종가면 1픽셀 선)
                    ctx.fillRect(bodyLeft, Math.min(openY, closeY), bodyWidth, Math.max(1, Math.abs(closeY - openY)));
                }
            }
        });

        averages.forEach((values, order) => {
            painter.strokeSeries(values, range, priceY, lineColor(style, averageColors[order] ?? order), averageStrokes[order]);
        });
        frame.comparisons.forEach(({line: comparison, color}) => {
            painter.strokeSeries(comparison.values, range, priceY, lineColor(style, color));
        });
    });

    // 거래량 영역 지표는 값이 눈금 상한을 넘어도 가격 영역으로 올라가지 않게 거래량 영역으로 자른다.
    painter.clipped(volumeTop, mainBottom, plotWidth, () => {
        // 거래량 막대는 차트 종류와 상관없이 실제 캔들의 색을 따른다.
        visible.forEach((candle, offset) => {
            if (candle.volume <= 0) return;
            const index = range.from + offset;
            ctx.fillStyle = candleColor(candles, index, style, flatByPrevClose);
            const top = clamp(painter.px(volumeY(candle.volume)), painter.px(volumeTop), mainBottomPx - 1);
            ctx.fillRect(painter.centerX(index, range) - halfWidth, top, bodyWidth, mainBottomPx - top);
        });
        volumeOverlays.forEach(overlay => overlay.draw({painter, range, style, toY: volumeY}));
    });
};

/**
 * 보이는 구간의 최고가·최저가를 그 캔들 옆에 적는다. 오른쪽에 자리가 없으면 왼쪽에 적는다.
 * 글자를 그 가격 높이에 맞춰, 화살표가 꼬리 끝(최고가·최저가 지점)을 바로 가리키게 한다.
 * 가격축을 끌어 범위를 좁혀 그 가격이 범위를 벗어나면 적지 않는다.
 */
const drawExtremes = (frame: Frame) => {
    const {
        painter, style, chartType, visible, range, priceMin, priceMax, priceTop, priceBottom, priceY, plotRightPx, valueDecimals,
    } = frame;
    const ctx = painter.ctx;
    const mark = (offset: number, price: number, name: string, color: string) => {
        if (price < priceMin || price > priceMax) return;
        const x = painter.centerX(range.from + offset, range);
        const label = `${name} ${formatPrice(price, valueDecimals)}`;
        const gap = painter.px(EXTREME_LABEL_GAP);
        const toRight = x + gap + ctx.measureText(`← ${label}`).width <= plotRightPx;
        const half = painter.px(FONT_SIZE) / 2;
        const y = clamp(painter.px(priceY(price)), painter.px(priceTop) + half, painter.px(priceBottom) - half);
        ctx.fillStyle = textColorOf(style, color);
        ctx.textAlign = toRight ? 'left' : 'right';
        ctx.fillText(toRight ? `← ${label}` : `${label} →`, toRight ? x + gap : x - gap, y);
    };
    // 선·영역·기준선 차트는 꼬리가 없으므로 종가 기준으로 찾는다. 하이킨아시는 실제 고가·저가를 적는다.
    const closeOnly = isCloseOnly(chartType);
    const highOf = (candle: Candle) => closeOnly ? candle.close : candle.high;
    const lowOf = (candle: Candle) => closeOnly ? candle.close : candle.low;
    const highOffset = visible.reduce((best, candle, offset) => highOf(candle) > highOf(visible[best]) ? offset : best, 0);
    const lowOffset = visible.reduce((best, candle, offset) => lowOf(candle) < lowOf(visible[best]) ? offset : best, 0);
    mark(highOffset, highOf(visible[highOffset]), '최고', style.upColor);
    mark(lowOffset, lowOf(visible[lowOffset]), '최저', style.downColor);
};

/**
 * 내 매매 표시: 매수는 캔들 아래에 위를 보는 화살표(상승색), 매도는 캔들 위에 아래를 보는 화살표(하락색).
 * 캔들과 색이 같아 꽉 채운 세모는 캔들 조각처럼 보이므로, 막대 달린 선 화살표에 바탕색 테두리를 둘러 그린다.
 * 차트를 가리지 않게 이름표는 붙이지 않는다. 내역은 십자선이 그 캔들에 오면 위 장이 적는다.
 * 선·영역 차트는 꼬리가 없으므로 종가 높이에 붙인다. 가격 영역을 벗어나면 가장자리에 붙여 그린다.
 */
const drawTradeMarks = (frame: Frame, tradeMarks: TradeMark[]) => {
    const {painter, style, chartType, shapes, range, priceTop, priceBottom, priceY} = frame;
    const ctx = painter.ctx;
    const half = painter.px(TRADE_MARK_HALF_WIDTH);
    const head = painter.px(TRADE_MARK_HEAD_HEIGHT);
    const length = painter.px(TRADE_MARK_LENGTH);
    const gap = painter.px(TRADE_MARK_GAP);
    const width = painter.px(TRADE_MARK_LINE_WIDTH);
    const halo = painter.px(TRADE_MARK_HALO);
    // 화살표가 놓일 수 있는 위아래 끝. 선 굵기와 테두리가 가장자리에서 잘리지 않게 그만큼 안쪽으로 잡는다
    const edge = width / 2 + halo;
    const top = painter.px(priceTop) + edge;
    const bottom = painter.px(priceBottom) - edge;
    const closeOnly = isCloseOnly(chartType);
    const last = range.from + range.count;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    tradeMarks.forEach(({index, side}) => {
        const candle = shapes[index];
        if (!candle || index < range.from || index >= last) return;
        const buy = side === 'buy';
        const toward = buy ? 1 : -1;    // 캔들에서 멀어지는 방향 (매수는 아래로, 매도는 위로)
        const x = painter.centerX(index, range);
        const price = closeOnly ? candle.close : buy ? candle.low : candle.high;
        // tip: 캔들을 가리키는 화살촉 끝, tail: 막대의 반대쪽 끝.
        // 보이는 구간의 최저·최고 캔들은 가장자리까지 자리가 좁다. 그때 화살표를 캔들 쪽으로 밀면 꼬리를 덮으므로,
        // 화살촉은 제자리에 두고(화살촉 높이만큼만 영역 안으로 당긴다) 막대를 남은 자리만큼 줄인다.
        const tip = clamp(
            painter.px(priceY(price)) + toward * gap,
            top + (buy ? 0 : head),
            bottom - (buy ? head : 0),
        );
        const tail = tip + toward * Math.min(length, buy ? bottom - tip : tip - top);
        const shoulder = tip + toward * head;   // 화살촉의 양 날개 끝이 놓이는 높이
        ctx.beginPath();
        ctx.moveTo(x, tail);
        ctx.lineTo(x, tip);
        ctx.moveTo(x - half, shoulder);
        ctx.lineTo(x, tip);
        ctx.lineTo(x + half, shoulder);
        // 바탕색으로 굵게 한 번 그어 테두리를 만들고 그 위에 색 선을 긋는다. 캔들·지표 선 위에서도 화살표가 묻히지 않는다.
        ctx.strokeStyle = style.backgroundColor;
        ctx.lineWidth = width + halo * 2;
        ctx.stroke();
        ctx.strokeStyle = buy ? style.upColor : style.downColor;
        ctx.lineWidth = width;
        ctx.stroke();
    });
    ctx.restore();
};

/**
 * 축 라벨의 가운데 높이를 가격 영역 안으로 당긴다. 값이 영역 가장자리에 있어도 라벨이 옆 영역을 덮지 않는다.
 * extra: 라벨 아래로 덧붙는 높이(현재가 라벨의 남은 시간 줄).
 */
const tagCenter = ({painter, priceTop, priceBottom}: Frame, y: number, extra = 0) => {
    return tagCenterWithin(y, painter.px(priceTop), painter.px(priceBottom), painter.px(AXIS_TAG_HEIGHT), extra);
};

interface ComparisonTag {
    value: number,
    color: number,
    y: number,     // 마지막 값의 높이 (기기 픽셀)
}

/** 라벨을 붙일 비교 종목: 보이는 구간의 마지막 값이 가격축 범위 안에 있는 것. 가격축을 끌어 범위를 좁히면 빠진다. */
const visibleComparisons = ({painter, priceMin, priceMax, priceY, comparisons}: Frame): ComparisonTag[] =>
    comparisons.flatMap(({line: comparison, color}) => {
        const value = comparison.last;
        return value === null || value < priceMin || value > priceMax ? [] : [{value, color, y: painter.px(priceY(value))}];
    });

/**
 * 비교 종목의 라벨: 보이는 구간의 마지막 값 높이에, 오른쪽 축에 선 색으로 등락률을 적는다.
 * centers: 라벨의 가운데 높이(tags 와 같은 순서). 가격선 라벨과 한데 쌓아 정한다.
 */
const drawComparisonTags = (frame: Frame, tags: ComparisonTag[], centers: number[]) => {
    const {painter, style, plotRightPx, axisLabelX} = frame;
    const ctx = painter.ctx;
    const labelHeight = painter.px(AXIS_TAG_HEIGHT);
    ctx.textAlign = 'left';
    tags.forEach(({value, color}, order) => {
        const y = centers[order];
        ctx.fillStyle = lineColor(style, color);
        ctx.fillRect(plotRightPx, Math.round(y - labelHeight / 2), frame.axisWidthPx, labelHeight);
        ctx.fillStyle = style.backgroundColor;
        ctx.fillText(frame.axisText(value, frame.valueDecimals), axisLabelX, y);
    });
};

/**
 * 현재가 선: 마지막 캔들의 종가 높이에 점선을 긋고, 오른쪽 축에 캔들 색 라벨을 붙인다.
 * 과거로 이동해 현재가가 가격축 범위를 벗어나면 그리지 않는다.
 * 남은 시간이 있으면 라벨을 아래로 한 줄 늘려 가격 밑에 적는다.
 */
const drawCurrentPrice = (frame: Frame): TagSpan | null => {
    const {painter, style, candles, flatByPrevClose, priceMin, priceMax, priceY, line, plotRightPx, axisLabelX} = frame;
    const ctx = painter.ctx;
    const last = candles[candles.length - 1];
    if (last.close < priceMin || last.close > priceMax) return null;

    const color = candleColor(candles, candles.length - 1, style, flatByPrevClose);
    const y = painter.px(priceY(last.close));
    const labelHeight = painter.px(AXIS_TAG_HEIGHT);
    ctx.strokeStyle = color;
    ctx.lineWidth = line;
    ctx.setLineDash(CURRENT_PRICE_DASH.map(length => painter.px(length)));
    ctx.beginPath();
    ctx.moveTo(0, y + line / 2);
    ctx.lineTo(plotRightPx, y + line / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    const countdownHeight = frame.countdown ? painter.px(COUNTDOWN_HEIGHT) : 0;
    // 선은 제자리에 두고 라벨만 가격 영역 안으로 당긴다.
    const labelY = tagCenter(frame, y, countdownHeight);
    const labelTop = Math.round(labelY - labelHeight / 2);
    ctx.fillRect(plotRightPx, labelTop, frame.axisWidthPx, labelHeight + countdownHeight);
    ctx.fillStyle = style.backgroundColor;
    ctx.textAlign = 'left';
    ctx.fillText(frame.axisText(last.close, frame.valueDecimals), axisLabelX, labelY);
    if (frame.countdown) {
        // 가격 줄에 붙여 적는다(줄 높이의 가운데보다 조금 위).
        ctx.fillText(frame.countdown, axisLabelX, labelY + labelHeight / 2 + countdownHeight / 2 - painter.px(2));
    }
    return {top: labelTop, bottom: labelTop + labelHeight + countdownHeight, line: y};
};

/**
 * 축 라벨들이 서로, 그리고 비켜야 할 자리(현재가 라벨)와 겹치지 않게 놓을 가운데 높이를 구한다.
 * centers: 선의 높이(위에서 아래 순), height: 라벨 높이, bounds: 가격 영역. 돌려주는 값은 centers 와 같은 순서다.
 * 현재가 선보다 위에 있는 선의 라벨은 위로, 아래에 있는 선의 라벨은 아래로 밀려 차곡차곡 쌓인다.
 * 한쪽에 자리가 모자라면(현재가가 영역 가장자리 근처) 현재가 선에 가까운 라벨부터 자리가 남는 반대쪽에 쌓는다.
 * 쌓인 라벨이 가격 영역을 넘으면 안쪽으로 되밀고, 그래도 자리가 없으면 비켜야 할 자리를 덮지 않고 영역을 넘긴다.
 */
const spreadLabels = (centers: number[], height: number, avoid: TagSpan | null, bounds: Span): number[] => {
    const half = height / 2;
    const split = avoid ? avoid.line : -Infinity;
    const first = bounds.top + half;
    const placed = centers.map(center => clamp(center, first, Math.max(first, bounds.bottom - half)));
    // 현재가 선의 위·아래에 있는 선들 (둘 다 위에서 아래 순)
    const above = centers.flatMap((center, order) => center < split ? [order] : []);
    const below = centers.flatMap((center, order) => center >= split ? [order] : []);
    // 비켜야 할 자리와 영역 끝 사이에 들어가는 라벨 수
    const roomFor = (space: number) => Math.max(0, Math.floor(space / height));
    const aboveRoom = avoid ? roomFor(avoid.top - bounds.top) : Infinity;
    const belowRoom = avoid ? roomFor(bounds.bottom - avoid.bottom) : Infinity;
    const toAbove = Math.max(0, Math.min(below.length - belowRoom, aboveRoom - above.length));
    const toBelow = Math.max(0, Math.min(above.length - aboveRoom, belowRoom - below.length));
    const lower = [...above.slice(above.length - toBelow), ...below.slice(toAbove)];
    const upper = [...above.slice(0, above.length - toBelow), ...below.slice(0, toAbove)].reverse();
    // 아래로 밀기: 위에서부터 차례로, 바로 위 라벨(또는 limit)의 아래로 민다.
    const pushDown = (orders: number[], limit: number) => orders.forEach(order => {
        placed[order] = Math.max(placed[order], limit + half);
        limit = placed[order] + half;
    });
    // 위로 밀기: 아래에서부터 차례로, 바로 아래 라벨(또는 limit)의 위로 민다.
    const pushUp = (orders: number[], limit: number) => orders.forEach(order => {
        placed[order] = Math.min(placed[order], limit - half);
        limit = placed[order] - half;
    });
    // 아래쪽 묶음: 비켜야 할 자리 아래로 쌓고, 영역 바닥을 넘으면 되민 뒤, 비켜야 할 자리(없으면 영역 천장)를 다시 비킨다.
    const avoidBottom = avoid ? avoid.bottom : -Infinity;
    pushDown(lower, avoidBottom);
    pushUp([...lower].reverse(), bounds.bottom);
    pushDown(lower, Math.max(avoidBottom, bounds.top));
    // 위쪽 묶음: 같은 일을 위아래를 뒤집어 한다. upper 는 아래에서 위 순이다.
    const avoidTop = avoid ? avoid.top : Infinity;
    pushUp(upper, avoidTop);
    pushDown([...upper].reverse(), bounds.top);
    pushUp(upper, Math.min(avoidTop, bounds.bottom));
    return placed;
};

/**
 * 오른쪽 축 라벨들의 가운데 높이를 정한다. ys: 선의 높이(순서는 상관없다). 돌려주는 값은 ys 와 같은 순서다.
 * 서로, 그리고 현재가 라벨(avoid)을 비켜 쌓는다.
 */
const spreadTags = ({painter, priceTop, priceBottom}: Frame, ys: number[], avoid: TagSpan | null): number[] => {
    const order = ys.map((_, index) => index).sort((a, b) => ys[a] - ys[b]);
    const placed = spreadLabels(
        order.map(index => ys[index]), painter.px(AXIS_TAG_HEIGHT), avoid,
        {top: painter.px(priceTop), bottom: painter.px(priceBottom)},
    );
    const centers = new Array<number>(ys.length);
    order.forEach((index, rank) => {
        centers[index] = placed[rank];
    });
    return centers;
};

interface PriceLineTag {
    priceLine: PriceLine,
    y: number,     // 선의 높이 (기기 픽셀)
}

/** 가격축 범위 안의 가격선. 위에서 아래 순이다. */
const visiblePriceLines = ({painter, priceMin, priceMax, priceY}: Frame, priceLines: PriceLine[]): PriceLineTag[] => priceLines
    .filter(priceLine => priceLine.price >= priceMin && priceLine.price <= priceMax)
    .map(priceLine => ({priceLine, y: painter.px(priceY(priceLine.price))}))
    .sort((a, b) => a.y - b.y);

/**
 * 가격선 이름을 적을 선과 그 높이를 정한다. 돌려주는 값은 tags 의 순번 → 이름을 적을 높이.
 * 선을 위에서부터 묶음(바로 위 선과 PRICE_LINE_TITLE_GAP 보다 가까운 선들)으로 나누고, 묶음마다 이름을 하나만 적는다.
 * 보통은 묶음 맨 위 선의 위에 적는다. 맨 위 선이 가격 영역 꼭대기에 붙어 위에 자리가 없으면,
 * 묶음 맨 아래 선의 이름을 그 선 아래에 적어 묶음의 다른 선이 이름 위를 지나가지 않게 한다.
 */
const placeTitles = (frame: Frame, tags: PriceLineTag[]): Map<number, number> => {
    const {painter, priceTop, priceBottom, line} = frame;
    const gap = painter.px(PRICE_LINE_TITLE_GAP);
    const titleOffset = painter.px(PRICE_LINE_TITLE_OFFSET);
    const fontHalf = painter.px(FONT_SIZE) / 2;
    // 이름(글자 가운데)이 놓일 수 있는 가장 높은·낮은 자리
    const titleTop = painter.px(priceTop) + fontHalf;
    const titleBottom = painter.px(priceBottom) - fontHalf;
    const titles = new Map<number, number>();
    let previousY = -Infinity;  // 바로 위에서 이름이 차지한 자리를 고려한 기준 높이
    let order = 0;
    while (order < tags.length) {
        // 묶음의 끝: 바로 앞 선과의 간격이 gap 이상이 되기 전까지
        let end = order;
        while (end + 1 < tags.length && tags[end + 1].y - tags[end].y < gap) end++;
        const first = tags[order].y;
        if (first - previousY < gap) {
            // 위 묶음의 이름과 가까우면 이 묶음에는 이름을 적지 않는다.
            previousY = tags[end].y;
        } else if (first - titleOffset >= titleTop) {
            titles.set(order, first - titleOffset);
            previousY = tags[end].y;
        } else {
            const last = tags[end].y;
            const below = last + titleOffset + line;
            if (below > titleBottom) {
                // 묶음이 가격 영역 바닥까지 이어져 아래에도 자리가 없으면 이름을 적지 않는다.
                previousY = last;
            } else {
                titles.set(end, below);
                // 다음 묶음의 이름(첫 선 위)이 이 이름의 아래 끝보다 아래에 놓일 때만 적히도록 기준을 내린다.
                previousY = below + fontHalf + titleOffset + fontHalf - gap;
            }
        }
        order = end + 1;
    }
    return titles;
};

/**
 * 가격선(목표가 등): 점선 + 선 위 이름 + 오른쪽 축에 테두리 라벨. 현재가 라벨(채움)과 구분된다.
 * centers: 축 라벨의 가운데 높이(tags 와 같은 순서). 비교 종목 라벨과 한데 쌓아 정한다(선은 제자리).
 * 이름은 겹치는 선들 가운데 하나에만 적는다(placeTitles).
 */
const drawPriceLines = (frame: Frame, tags: PriceLineTag[], centers: number[], activeId: string | null) => {
    const {painter, style, line, plotRightPx, axisLabelX} = frame;
    const ctx = painter.ctx;
    const labelHeight = painter.px(AXIS_TAG_HEIGHT);
    const titles = placeTitles(frame, tags);

    tags.forEach(({priceLine, y}, order) => {
        const color = priceLine.tone === 'up' ? style.upColor
            : priceLine.tone === 'down' ? style.downColor
            : style.textColor;
        const labelTop = Math.round(centers[order] - labelHeight / 2);
        // 마우스를 올렸거나 끌고 있는 선은 굵게 긋고 라벨을 채워, 촘촘한 선들 가운데 어느 것이 잡히는지 보이게 한다.
        const active = priceLine.id !== undefined && priceLine.id === activeId;
        const labelColor = textColorOf(style, color);
        ctx.strokeStyle = color;
        ctx.lineWidth = active ? line * ACTIVE_PRICE_LINE_WIDTH : line;
        ctx.setLineDash(PRICE_LINE_DASH.map(length => painter.px(length)));
        ctx.beginPath();
        ctx.moveTo(0, y + line / 2);
        ctx.lineTo(plotRightPx, y + line / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.lineWidth = line;
        ctx.strokeStyle = labelColor;
        ctx.fillStyle = active ? labelColor : style.backgroundColor;
        ctx.fillRect(plotRightPx, labelTop, frame.axisWidthPx, labelHeight);
        ctx.strokeRect(
            plotRightPx + line / 2, labelTop + line / 2,
            frame.axisWidthPx - line, labelHeight - line,
        );
        ctx.fillStyle = active ? style.backgroundColor : labelColor;
        ctx.textAlign = 'left';
        // 목표가는 캔들보다 잘게 정해 둘 수 있으므로 필요한 자릿수만큼 더 적는다.
        ctx.fillText(
            frame.axisText(priceLine.price, Math.max(frame.valueDecimals, decimalsOf(priceLine.price))),
            axisLabelX, labelTop + labelHeight / 2,
        );
        const titleY = titles.get(order);
        if (titleY !== undefined) {
            ctx.fillStyle = labelColor;
            ctx.fillText(priceLine.title, painter.px(LEGEND_LEFT), titleY);
        }
    });
};

/** 아래 장 전체를 그리고, 그린 배치를 돌려준다. 그릴 자리가 없으면 null. 캔버스는 부르는 쪽에서 지운다. */
export const renderMain = (painter: Painter, input: MainInput): Layout | null => {
    const {
        candles, chartType, shapes, percentScale, priceZoom, priceShift, timeUnit, style, width, range,
        mainHeight, volumeRatio, indicatorHeights,
        averages, averageColors, averageStrokes, indicators, priceOverlays, volumeOverlays, priceLines, comparisons, flatByPrevClose,
        grid, axisWidth, valueDecimals, countdown,
    } = input;

    // 위에서부터: 가격 / 거래량 / 보조지표들 / 날짜축. 위에서 아래로 쌓으므로 아래 영역의 높이가 바뀌어도 위 영역은 그대로다.
    const plotWidth = width - axisWidth;
    const mainBottom = mainHeight - TIME_AXIS_HEIGHT;
    const indicatorTops = indicatorHeights.reduce<number[]>(
        (tops, paneHeight) => [...tops, tops[tops.length - 1] + paneHeight], [mainBottom],
    );
    const plotBottom = indicatorTops[indicators.length];
    const innerHeight = mainBottom - PRICE_PANE_TOP;
    if (plotWidth <= 0 || innerHeight <= 0 || range.count === 0) return null;

    const visible = candles.slice(range.from, range.from + range.count);
    const volumeTop = mainBottom - innerHeight * volumeRatio;
    const priceTop = PRICE_PANE_TOP;
    const priceBottom = volumeTop - PANE_GAP;

    // 보이는 구간의 최고·최저가에 맞춰 가격축을 잡고, 위아래로 5% 여백을 둔다.
    // 이동평균선과 가격 영역 지표가 잘리지 않게 보이는 구간의 그 값들도 범위에 넣는다.
    const end = range.from + range.count;
    // 캔들보다 긴 지표(일목균형표의 선행스팬)는 마지막 캔들 뒤로 보이는 부분까지 넣는다.
    const seriesEnd = Math.max(end, Math.ceil(range.rightEdge));
    // 퍼센트 축의 기준(0%)과 기준선 차트의 기준 가격: 보이는 첫 캔들의 종가. 화면을 움직이면 따라 바뀐다.
    const firstClose = visible[0].close;
    // 비교 종목도 같은 자리를 0% 로 놓고, 등락률을 주 종목의 가격으로 바꿔 같은 축에 그린다.
    const comparisonLines = comparisons.map(({closes, color}) => ({
        line: scaleComparison(closes, range, firstClose), color,
    }));
    // 선·영역 차트는 종가만 그리므로 종가 범위에 맞춘다. 하이킨아시는 다시 만든 캔들과 실제 고가·저가를 모두 담는다.
    const closeOnly = isCloseOnly(chartType);
    const visibleShapes = chartType === 'heikinAshi' ? shapes.slice(range.from, end) : [];
    const candleLows = [
        ...visible.map(candle => closeOnly ? candle.close : candle.low),
        ...visibleShapes.map(candle => candle.low),
    ];
    // 로그 축에는 0 이하의 가격이 놓일 자리가 없다. 보이는 캔들에 그런 가격이 있으면(값이 0 으로 온 캔들 등)
    // 범위를 잡을 수 없어 차트가 통째로 사라지거나 그 캔들이 영역 바닥까지 늘어나므로, 그 구간을 보는 동안만 일반 축으로 그린다.
    // 저가만 보지 않는 것은 시가·고가만 0 으로 오는 캔들도 있을 수 있어서다. 종가만 그리는 차트는 종가만 본다.
    const pricesOf = (candle: Candle) => closeOnly ? [candle.close] : [candle.open, candle.high, candle.low, candle.close];
    const logScale = input.logScale
        && [...visible, ...visibleShapes].every(candle => pricesOf(candle).every(price => price > 0));
    const visibleAverages = [
        ...averages, ...priceOverlays.flatMap(overlay => overlay.series), ...comparisonLines.map(({line}) => line.values),
    ]
        .flatMap(values => values.slice(range.from, seriesEnd))
        .filter(isNumber)
        // 로그 축에는 0 이하의 값이 놓일 자리가 없다(볼린저밴드 하단이 음수로 내려간 경우 등).
        .filter(value => !logScale || value > 0);
    const highest = Math.max(
        ...visible.map(candle => closeOnly ? candle.close : candle.high),
        ...visibleShapes.map(candle => candle.high),
        ...visibleAverages,
    );
    const lowest = Math.min(...candleLows, ...visibleAverages);
    // 로그 축이면 로그 값으로 바꿔 놓고 같은 계산을 한다. priceZoom 은 가운데를 기준으로 범위를 늘리거나 줄인다.
    const toAxis = logScale ? Math.log : (value: number) => value;
    const fromAxis = logScale ? Math.exp : (value: number) => value;
    const axisHigh = toAxis(highest);
    const axisLow = toAxis(lowest);
    const padding = (axisHigh - axisLow) * 0.05 || (logScale ? 0.01 : highest * 0.01 || 1);
    const half = ((axisHigh - axisLow) / 2 + padding) * priceZoom;
    // priceShift 는 화면에 보이는 범위(위아래 전체)의 몇 배만큼 범위를 위로 옮길지다.
    const center = (axisHigh + axisLow) / 2 + priceShift * half * 2;
    const priceMin = fromAxis(center - half);
    const priceMax = fromAxis(center + half);

    // 거래량 눈금 상한. 유난히 큰 막대는 영역 꼭대기에서 잘리고, 실제 값은 값 표시에서 확인한다.
    const volumes = visible.map(candle => candle.volume);
    const highestVolume = Math.max(...volumes);
    const typicalHigh = [...volumes].sort((a, b) => a - b)[Math.floor((volumes.length - 1) * VOLUME_PERCENTILE)];
    const volumeMax = Math.min(highestVolume, typicalHigh * VOLUME_OUTLIER_RATIO) || highestVolume || 1;

    const percentBase =percentScale && firstClose > 0 ? firstClose : null;
    const axisText = (price: number, decimals: number) => percentBase
        ? formatPercent((price / percentBase - 1) * 100, PERCENT_DECIMALS)
        : formatPrice(price, decimals);

    const plotRightPx = painter.px(plotWidth);
    const frame: Frame = {
        painter, style, candles, shapes, chartType, logScale, visible, range, timeUnit, flatByPrevClose, grid,
        plotWidth, plotBottom, mainBottom, priceTop, priceBottom, volumeTop,
        priceMin, priceMax, volumeMax,
        priceY: (logScale ? createLogScale : createLinearScale)(priceMin, priceMax, priceTop, priceBottom),
        volumeY: createLinearScale(0, volumeMax, volumeTop, mainBottom),
        line: painter.lineWidth(),
        plotRightPx,
        plotBottomPx: painter.px(plotBottom),
        axisLabelX: plotRightPx + painter.px(AXIS_LABEL_OFFSET),
        axisWidthPx: painter.px(axisWidth),
        valueDecimals,
        percentBase,
        axisText,
        baseline: firstClose,
        countdown,
        comparisons: comparisonLines,
    };

    painter.useFont(style);
    // 눈금은 간격에 맞는 자릿수로 적지만, 그 밖의 값(십자선·이동평균·수평선 라벨)은 캔들 가격의 자릿수보다 거칠면 안 된다.
    const priceDecimals = Math.max(drawPriceAxis(frame), valueDecimals);
    drawVolumeAxis(frame);
    drawTimeAxis(frame);
    drawBorders(frame);
    drawCandles(frame, averages, averageColors, averageStrokes, priceOverlays, volumeOverlays);
    drawExtremes(frame);
    // 오른쪽 끝에 반쯤 걸친 캔들의 세모가 가격축 위로 넘어가지 않게, 캔들처럼 가격 영역 안에서 자른다.
    painter.clipped(frame.priceTop, frame.priceBottom, frame.plotWidth, () => drawTradeMarks(frame, input.tradeMarks));
    const currentPriceTag = drawCurrentPrice(frame);
    // 비교 종목과 가격선의 축 라벨은 한데 모아, 서로와 현재가 라벨을 비켜 쌓는다.
    const comparisonTags = visibleComparisons(frame);
    const priceLineTags = visiblePriceLines(frame, priceLines);
    const tagCenters = spreadTags(frame, [...comparisonTags, ...priceLineTags].map(({y}) => y), currentPriceTag);
    drawComparisonTags(frame, comparisonTags, tagCenters.slice(0, comparisonTags.length));
    drawPriceLines(frame, priceLineTags, tagCenters.slice(comparisonTags.length), input.activePriceLine);
    // 위 장의 수평선 라벨이 비킬 수 있게, 아래 장이 축에 붙인 라벨 자리를 넘긴다.
    const tagHeight = painter.px(AXIS_TAG_HEIGHT);
    const axisTags: Span[] = [
        ...(currentPriceTag ? [{top: currentPriceTag.top, bottom: currentPriceTag.bottom}] : []),
        ...tagCenters.map(center => {
            const top = Math.round(center - tagHeight / 2);
            return {top, bottom: top + tagHeight};
        }),
    ];

    const indicatorPanes = indicators.map((instance, order) => drawIndicatorPane(
        painter, instance, indicatorTops[order], indicatorTops[order + 1], plotWidth, range, style,
    ));

    return {
        range, plotWidth, plotBottom, axisWidth, priceDecimals, valueDecimals,
        panes: [
            {
                top: priceTop, bottom: priceBottom, scaleTop: priceTop, scaleBottom: priceBottom,
                min: priceMin, max: priceMax, log: logScale,
                format: value => formatPrice(value, priceDecimals),
                axisFormat: value => axisText(value, priceDecimals),
            },
            {
                top: volumeTop, bottom: mainBottom, scaleTop: volumeTop, scaleBottom: mainBottom,
                min: 0, max: volumeMax,
                format: value => formatVolume(Math.max(0, value)),
            },
            ...indicatorPanes,
        ],
        indicators: indicators.map((instance, order) => ({instance, top: indicatorTops[order]})),
        priceOverlays,
        volumeOverlays,
        comparisonBases: comparisonLines.map(({line}) => line.base),
        axisTags,
    };
};
