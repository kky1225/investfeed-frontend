import {Candle, ChartStyle, ChartType, PriceLine, TimeUnit} from "./types.ts";
import {Series} from "./indicators.ts";
import {
    createLinearScale, createLogScale, decimalsOf, formatPercent, formatPrice, formatVolume, logTicks, niceTicks,
} from "./scale.ts";
import {timeTicks} from "./timeAxis.ts";
import {ComparisonLine, scaleComparison} from "./comparison.ts";
import {
    AXIS_LABEL_OFFSET, AXIS_TAG_HEIGHT, FONT_SIZE, LEGEND_LEFT, PRICE_PANE_TOP, TIME_AXIS_HEIGHT,
} from "./constants.ts";
import {clamp, isNumber, Layout, VisibleRange} from "./layout.ts";
import {candleColor, lineColor, Painter} from "./painter.ts";
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
    timeUnit: TimeUnit,
    style: ChartStyle,
    width: number,              // 캔버스 너비 (CSS px)
    mainHeight: number,         // 가격+거래량 영역의 높이. 날짜축을 포함한다 (CSS px)
    volumeRatio: number,        // 가격+거래량 높이 중 거래량 영역의 비율
    indicatorHeights: number[], // indicators 와 같은 순서의 영역 높이 (CSS px)
    range: VisibleRange,
    averages: Series[],         // 이동평균선
    averageColors: number[],    // 이동평균선마다의 색 순번. 없는 자리는 순서대로의 색
    indicators: PaneIndicator[],        // 위에서 아래로 쌓을 별도 영역 지표
    priceOverlays: OverlayIndicator[],  // 가격 영역에 겹칠 지표
    volumeOverlays: OverlayIndicator[], // 거래량 영역에 겹칠 지표
    priceLines: PriceLine[],
    // 비교 종목: 주 종목의 캔들 순번에 맞춘 종가와 선 색 순번. 있으면 percentScale 도 켜서 넘길 것
    comparisons: { closes: Series, color: number }[],
    flatByPrevClose: boolean,
    axisWidth: number,         // 오른쪽 가격축 너비 (CSS px)
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
    const currentPriceY = painter.px(priceY(candles[candles.length - 1].close));
    const labelClearance = painter.px(AXIS_TAG_HEIGHT);
    // 남은 시간을 적으면 현재가 라벨이 그만큼 아래로 길어진다.
    const clearanceBelow = labelClearance + (frame.countdown ? painter.px(COUNTDOWN_HEIGHT) : 0);
    // 로그 축의 눈금은 아래쪽으로 갈수록 촘촘해지므로, 위에서부터 보며 바로 위 눈금과 너무 붙은 것은 건너뛴다.
    const minGap = painter.px(MIN_PRICE_TICK_GAP);
    let previousY = -Infinity;
    [...priceTicks.values].reverse().forEach(value => {
        const y = painter.px(priceY(value));
        if (y - previousY < minGap) return;
        previousY = y;
        ctx.fillStyle = style.gridColor;
        ctx.fillRect(0, y, plotRightPx, line);
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
const drawTimeAxis = ({painter, style, candles, range, timeUnit, plotBottom, line, plotRightPx, plotBottomPx}: Frame) => {
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
        ctx.fillStyle = style.gridColor;
        ctx.fillRect(x, 0, line, plotBottomPx);
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
 */
const drawCandles = (
    frame: Frame, averages: Series[], averageColors: number[],
    priceOverlays: OverlayIndicator[], volumeOverlays: OverlayIndicator[],
) => {
    const {
        painter, style, candles, shapes, chartType, visible, range, flatByPrevClose,
        plotWidth, mainBottom, volumeTop, priceY, volumeY, line,
    } = frame;
    const ctx = painter.ctx;
    const mainBottomPx = painter.px(mainBottom);
    painter.clipped(0, mainBottom, plotWidth, () => {
        priceOverlays.forEach(overlay => overlay.draw({painter, range, style, toY: priceY}));

        if (chartType === 'line' || chartType === 'area') drawCloseLine(frame);
        else if (chartType === 'baseline') drawBaseline(frame);

        const bodyWidth = painter.bodyWidth(range);
        const halfWidth = Math.floor(bodyWidth / 2);
        visible.forEach((candle, offset) => {
            const index = range.from + offset;
            const x = painter.centerX(index, range);
            const bodyLeft = x - halfWidth;
            // 거래량 막대는 차트 종류와 상관없이 실제 캔들의 색을 따른다.
            const candleFill = candleColor(candles, index, style, flatByPrevClose);

            if (chartType === 'hollow') {
                drawHollowCandle(frame, index, x, bodyLeft, bodyWidth);
            } else if (chartType === 'candle' || chartType === 'heikinAshi' || chartType === 'bar') {
                // 하이킨아시는 평균값으로 다시 만든 캔들을 그리고, 색도 그 캔들의 시가·종가로 정한다.
                const shape = shapes[index];
                ctx.fillStyle = chartType === 'heikinAshi' ? candleColor(shapes, index, style, false) : candleFill;

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

            // 거래량
            if (candle.volume > 0) {
                ctx.fillStyle = candleFill;
                const top = clamp(painter.px(volumeY(candle.volume)), painter.px(volumeTop), mainBottomPx - 1);
                ctx.fillRect(bodyLeft, top, bodyWidth, mainBottomPx - top);
            }
        });

        averages.forEach((values, order) => {
            painter.strokeSeries(values, range, priceY, lineColor(style, averageColors[order] ?? order));
        });
        frame.comparisons.forEach(({line: comparison, color}) => {
            painter.strokeSeries(comparison.values, range, priceY, lineColor(style, color));
        });
    });

    // 거래량 영역 지표는 값이 눈금 상한을 넘어도 가격 영역으로 올라가지 않게 거래량 영역으로 자른다.
    painter.clipped(volumeTop, mainBottom, plotWidth, () => {
        volumeOverlays.forEach(overlay => overlay.draw({painter, range, style, toY: volumeY}));
    });
};

/**
 * 보이는 구간의 최고가·최저가를 그 캔들 옆에 적는다. 오른쪽에 자리가 없으면 왼쪽에 적는다.
 * 글자를 그 가격 높이에 맞춰, 화살표가 꼬리 끝(최고가·최저가 지점)을 바로 가리키게 한다.
 */
const drawExtremes = (frame: Frame) => {
    const {painter, style, chartType, visible, range, priceTop, priceBottom, priceY, plotRightPx, valueDecimals} = frame;
    const ctx = painter.ctx;
    const mark = (offset: number, price: number, name: string, color: string) => {
        const x = painter.centerX(range.from + offset, range);
        const label = `${name} ${formatPrice(price, valueDecimals)}`;
        const gap = painter.px(EXTREME_LABEL_GAP);
        const toRight = x + gap + ctx.measureText(`← ${label}`).width <= plotRightPx;
        const half = painter.px(FONT_SIZE) / 2;
        const y = clamp(painter.px(priceY(price)), painter.px(priceTop) + half, painter.px(priceBottom) - half);
        ctx.fillStyle = color;
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
 * 비교 종목의 라벨: 보이는 구간의 마지막 값 높이에, 오른쪽 축에 선 색으로 등락률을 적는다.
 * 가격축을 끌어 범위를 좁혀 그 값이 범위를 벗어나면 적지 않는다.
 */
const drawComparisonTags = (frame: Frame) => {
    const {painter, style, priceMin, priceMax, priceY, plotRightPx, axisLabelX} = frame;
    const ctx = painter.ctx;
    const labelHeight = painter.px(AXIS_TAG_HEIGHT);
    ctx.textAlign = 'left';
    frame.comparisons.forEach(({line: comparison, color}) => {
        const value = comparison.last;
        if (value === null || value < priceMin || value > priceMax) return;
        const y = painter.px(priceY(value));
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
const drawCurrentPrice = (frame: Frame) => {
    const {painter, style, candles, flatByPrevClose, priceMin, priceMax, priceY, line, plotRightPx, axisLabelX} = frame;
    const ctx = painter.ctx;
    const last = candles[candles.length - 1];
    if (last.close < priceMin || last.close > priceMax) return;

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
    ctx.fillRect(plotRightPx, Math.round(y - labelHeight / 2), frame.axisWidthPx, labelHeight + countdownHeight);
    ctx.fillStyle = style.backgroundColor;
    ctx.textAlign = 'left';
    ctx.fillText(frame.axisText(last.close, frame.valueDecimals), axisLabelX, y);
    if (frame.countdown) {
        // 가격 줄에 붙여 적는다(줄 높이의 가운데보다 조금 위).
        ctx.fillText(frame.countdown, axisLabelX, y + labelHeight / 2 + countdownHeight / 2 - painter.px(2));
    }
};

/** 가격선(목표가 등): 점선 + 선 위 이름 + 오른쪽 축에 테두리 라벨. 현재가 라벨(채움)과 구분된다. */
const drawPriceLines = (frame: Frame, priceLines: PriceLine[]) => {
    const {painter, style, priceMin, priceMax, priceY, line, plotRightPx, axisLabelX} = frame;
    const ctx = painter.ctx;
    priceLines
        .filter(priceLine => priceLine.price >= priceMin && priceLine.price <= priceMax)
        .forEach(priceLine => {
            const color = priceLine.tone === 'up' ? style.upColor
                : priceLine.tone === 'down' ? style.downColor
                : style.textColor;
            const y = painter.px(priceY(priceLine.price));
            const labelHeight = painter.px(AXIS_TAG_HEIGHT);
            const labelTop = Math.round(y - labelHeight / 2);
            ctx.strokeStyle = color;
            ctx.lineWidth = line;
            ctx.setLineDash(PRICE_LINE_DASH.map(length => painter.px(length)));
            ctx.beginPath();
            ctx.moveTo(0, y + line / 2);
            ctx.lineTo(plotRightPx, y + line / 2);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = style.backgroundColor;
            ctx.fillRect(plotRightPx, labelTop, frame.axisWidthPx, labelHeight);
            ctx.strokeRect(
                plotRightPx + line / 2, labelTop + line / 2,
                frame.axisWidthPx - line, labelHeight - line,
            );
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            // 목표가는 캔들보다 잘게 정해 둘 수 있으므로 필요한 자릿수만큼 더 적는다.
            ctx.fillText(
                frame.axisText(priceLine.price, Math.max(frame.valueDecimals, decimalsOf(priceLine.price))), axisLabelX, y,
            );
            ctx.fillText(priceLine.title, painter.px(LEGEND_LEFT), y - painter.px(PRICE_LINE_TITLE_OFFSET));
        });
};

/** 아래 장 전체를 그리고, 그린 배치를 돌려준다. 그릴 자리가 없으면 null. 캔버스는 부르는 쪽에서 지운다. */
export const renderMain = (painter: Painter, input: MainInput): Layout | null => {
    const {
        candles, chartType, shapes, logScale, percentScale, priceZoom, timeUnit, style, width, range,
        mainHeight, volumeRatio, indicatorHeights,
        averages, averageColors, indicators, priceOverlays, volumeOverlays, priceLines, comparisons, flatByPrevClose,
        axisWidth, valueDecimals, countdown,
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
    const visibleAverages = [
        ...averages, ...priceOverlays.flatMap(overlay => overlay.series), ...comparisonLines.map(({line}) => line.values),
    ]
        .flatMap(values => values.slice(range.from, seriesEnd))
        .filter(isNumber)
        // 로그 축에는 0 이하의 값이 놓일 자리가 없다(볼린저밴드 하단이 음수로 내려간 경우 등).
        .filter(value => !logScale || value > 0);
    // 선·영역 차트는 종가만 그리므로 종가 범위에 맞춘다. 하이킨아시는 다시 만든 캔들과 실제 고가·저가를 모두 담는다.
    const closeOnly = isCloseOnly(chartType);
    const visibleShapes = chartType === 'heikinAshi' ? shapes.slice(range.from, end) : [];
    const highest = Math.max(
        ...visible.map(candle => closeOnly ? candle.close : candle.high),
        ...visibleShapes.map(candle => candle.high),
        ...visibleAverages,
    );
    const lowest = Math.min(
        ...visible.map(candle => closeOnly ? candle.close : candle.low),
        ...visibleShapes.map(candle => candle.low),
        ...visibleAverages,
    );
    // 로그 축이면 로그 값으로 바꿔 놓고 같은 계산을 한다. priceZoom 은 가운데를 기준으로 범위를 늘리거나 줄인다.
    const toAxis = logScale ? Math.log : (value: number) => value;
    const fromAxis = logScale ? Math.exp : (value: number) => value;
    const axisHigh = toAxis(highest);
    const axisLow = toAxis(lowest);
    const padding = (axisHigh - axisLow) * 0.05 || (logScale ? 0.01 : highest * 0.01 || 1);
    const center = (axisHigh + axisLow) / 2;
    const half = ((axisHigh - axisLow) / 2 + padding) * priceZoom;
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
        painter, style, candles, shapes, chartType, logScale, visible, range, timeUnit, flatByPrevClose,
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
    drawCandles(frame, averages, averageColors, priceOverlays, volumeOverlays);
    drawExtremes(frame);
    drawComparisonTags(frame);
    drawCurrentPrice(frame);
    drawPriceLines(frame, priceLines);

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
    };
};
