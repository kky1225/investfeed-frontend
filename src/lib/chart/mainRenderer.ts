import {Candle, ChartStyle, PriceLine, TimeUnit} from "./types.ts";
import {Series} from "./indicators.ts";
import {createLinearScale, formatPrice, formatTime, formatVolume, niceTicks} from "./scale.ts";
import {
    AXIS_LABEL_OFFSET, AXIS_TAG_HEIGHT, FONT_SIZE, INDICATOR_PANE_HEIGHT, LEGEND_LEFT,
    PRICE_AXIS_WIDTH, PRICE_PANE_TOP, TIME_AXIS_HEIGHT,
} from "./constants.ts";
import {clamp, isNumber, Layout, VisibleRange} from "./layout.ts";
import {candleColor, lineColor, Painter} from "./painter.ts";
import {drawIndicatorPane, OverlayIndicator, PaneIndicator} from "./indicatorPanes.ts";

// 아래 장: 캔들·거래량·이동평균선·축·현재가 선·가격선·보조지표 영역

const PANE_GAP = 8;             // 가격 영역과 거래량 영역 사이
const VOLUME_RATIO = 0.22;      // 가격+거래량 높이 중 거래량 영역 비율
const PRICE_TICK_GAP = 32;      // 가격 눈금 사이 최소 간격
const TIME_TICK_GAP = 96;       // 날짜 눈금 사이 최소 간격
const CURRENT_PRICE_DASH = [2, 2];
const PRICE_LINE_DASH = [6, 4];
const PRICE_LINE_TITLE_OFFSET = 8;  // 선과 그 위 이름 사이
const EXTREME_LABEL_GAP = 4;        // 최고·최저가 표시와 캔들 사이 (가로)
// 거래량 눈금: 보이는 구간의 상위 2% 를 뺀 값의 2배까지만 잡는다. 튀는 막대 하나가 나머지를 납작하게 누르지 않게 한다
const VOLUME_PERCENTILE = 0.98;
const VOLUME_OUTLIER_RATIO = 2;

export interface MainInput {
    candles: Candle[],          // 한 개 이상
    timeUnit: TimeUnit,
    style: ChartStyle,
    width: number,              // 캔버스 크기 (CSS px)
    height: number,
    range: VisibleRange,
    averages: Series[],         // 이동평균선. 색은 순서대로
    indicators: PaneIndicator[],        // 위에서 아래로 쌓을 별도 영역 지표
    priceOverlays: OverlayIndicator[],  // 가격 영역에 겹칠 지표
    volumeOverlays: OverlayIndicator[], // 거래량 영역에 겹칠 지표
    priceLines: PriceLine[],
    flatByPrevClose: boolean,
}

/** 한 번 그리는 동안 여러 함수가 함께 쓰는 값. 높이·너비는 CSS px, 이름이 Px 로 끝나면 기기 픽셀 */
interface Frame {
    painter: Painter,
    style: ChartStyle,
    candles: Candle[],
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
}

/** 가격 눈금: 가로 격자 + 오른쪽 라벨. 눈금의 소수 자릿수를 돌려준다. */
const drawPriceAxis = (frame: Frame): number => {
    const {painter, style, candles, priceMin, priceMax, priceTop, priceBottom, priceY, line, plotRightPx, axisLabelX} = frame;
    const ctx = painter.ctx;
    const priceTicks = niceTicks(priceMin, priceMax, Math.floor((priceBottom - priceTop) / PRICE_TICK_GAP));
    ctx.textAlign = 'left';
    // 현재가 라벨에 가려질 눈금 글자는 적지 않는다(격자선은 그린다).
    const currentPriceY = painter.px(priceY(candles[candles.length - 1].close));
    const labelClearance = painter.px(AXIS_TAG_HEIGHT);
    priceTicks.values.forEach(value => {
        const y = painter.px(priceY(value));
        ctx.fillStyle = style.gridColor;
        ctx.fillRect(0, y, plotRightPx, line);
        if (Math.abs(y - currentPriceY) < labelClearance) return;
        ctx.fillStyle = style.textColor;
        ctx.fillText(formatPrice(value, priceTicks.decimals), axisLabelX, y);
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

/** 날짜 눈금: 세로 격자 + 아래 라벨. 전체 순번 기준이라 보이는 구간이 바뀌어도 같은 캔들에 붙는다. */
const drawTimeAxis = ({painter, style, visible, range, timeUnit, plotBottom, line, plotRightPx, plotBottomPx}: Frame) => {
    const ctx = painter.ctx;
    const tickStep = Math.max(1, Math.ceil(TIME_TICK_GAP / range.spacing));
    // 분봉은 여러 날에 걸치므로, 날짜가 바뀐 뒤 첫 눈금에는 날짜를 함께 적는다.
    let labeledDay = '';
    ctx.textAlign = 'center';
    visible.forEach((candle, offset) => {
        const index = range.from + offset;
        if (index % tickStep !== 0) return;
        const x = painter.centerX(index, range);
        const day = timeUnit === 'minute' ? new Date(candle.time).toDateString() : '';
        const label = formatTime(candle.time, timeUnit, day !== labeledDay);
        labeledDay = day;
        const half = ctx.measureText(label).width / 2;
        if (x - half < 0 || x + half > plotRightPx) return;
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

/**
 * 캔들 + 거래량 + 이동평균선 + 겹쳐 그리는 지표. 드래그로 반쯤 걸친 캔들이 축 영역으로 넘어가지 않게 자른다.
 * 가격 영역 지표(볼린저밴드의 채움 등)는 캔들 뒤에, 선들은 캔들 앞에 놓인다.
 */
const drawCandles = (frame: Frame, averages: Series[], priceOverlays: OverlayIndicator[], volumeOverlays: OverlayIndicator[]) => {
    const {painter, style, candles, visible, range, flatByPrevClose, plotWidth, mainBottom, volumeTop, priceY, volumeY, line} = frame;
    const ctx = painter.ctx;
    const mainBottomPx = painter.px(mainBottom);
    painter.clipped(0, mainBottom, plotWidth, () => {
        priceOverlays.forEach(overlay => overlay.draw({painter, range, style, toY: priceY}));

        const bodyWidth = painter.bodyWidth(range);
        visible.forEach((candle, offset) => {
            const x = painter.centerX(range.from + offset, range);
            const bodyLeft = x - Math.floor(bodyWidth / 2);
            ctx.fillStyle = candleColor(candles, range.from + offset, style, flatByPrevClose);

            // 꼬리
            const highY = painter.px(priceY(candle.high));
            const lowY = painter.px(priceY(candle.low));
            ctx.fillRect(x - Math.floor(line / 2), highY, line, Math.max(1, lowY - highY));

            // 몸통 (시가 = 종가면 1픽셀 선)
            const openY = painter.px(priceY(candle.open));
            const closeY = painter.px(priceY(candle.close));
            const bodyTop = Math.min(openY, closeY);
            ctx.fillRect(bodyLeft, bodyTop, bodyWidth, Math.max(1, Math.abs(closeY - openY)));

            // 거래량
            if (candle.volume > 0) {
                const top = clamp(painter.px(volumeY(candle.volume)), painter.px(volumeTop), mainBottomPx - 1);
                ctx.fillRect(bodyLeft, top, bodyWidth, mainBottomPx - top);
            }
        });

        averages.forEach((values, order) => {
            painter.strokeSeries(values, range, priceY, lineColor(style, order));
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
const drawExtremes = ({painter, style, visible, range, priceTop, priceBottom, priceY, plotRightPx}: Frame) => {
    const ctx = painter.ctx;
    const mark = (offset: number, price: number, name: string, color: string) => {
        const x = painter.centerX(range.from + offset, range);
        const label = `${name} ${price.toLocaleString('ko-KR')}`;
        const gap = painter.px(EXTREME_LABEL_GAP);
        const toRight = x + gap + ctx.measureText(`← ${label}`).width <= plotRightPx;
        const half = painter.px(FONT_SIZE) / 2;
        const y = clamp(painter.px(priceY(price)), painter.px(priceTop) + half, painter.px(priceBottom) - half);
        ctx.fillStyle = color;
        ctx.textAlign = toRight ? 'left' : 'right';
        ctx.fillText(toRight ? `← ${label}` : `${label} →`, toRight ? x + gap : x - gap, y);
    };
    const highOffset = visible.reduce((best, candle, offset) => candle.high > visible[best].high ? offset : best, 0);
    const lowOffset = visible.reduce((best, candle, offset) => candle.low < visible[best].low ? offset : best, 0);
    mark(highOffset, visible[highOffset].high, '최고', style.upColor);
    mark(lowOffset, visible[lowOffset].low, '최저', style.downColor);
};

/**
 * 현재가 선: 마지막 캔들의 종가 높이에 점선을 긋고, 오른쪽 축에 캔들 색 라벨을 붙인다.
 * 과거로 이동해 현재가가 가격축 범위를 벗어나면 그리지 않는다.
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
    ctx.fillRect(plotRightPx, Math.round(y - labelHeight / 2), painter.px(PRICE_AXIS_WIDTH), labelHeight);
    ctx.fillStyle = style.backgroundColor;
    ctx.textAlign = 'left';
    ctx.fillText(last.close.toLocaleString('ko-KR'), axisLabelX, y);
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
            ctx.fillRect(plotRightPx, labelTop, painter.px(PRICE_AXIS_WIDTH), labelHeight);
            ctx.strokeRect(
                plotRightPx + line / 2, labelTop + line / 2,
                painter.px(PRICE_AXIS_WIDTH) - line, labelHeight - line,
            );
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            ctx.fillText(priceLine.price.toLocaleString('ko-KR'), axisLabelX, y);
            ctx.fillText(priceLine.title, painter.px(LEGEND_LEFT), y - painter.px(PRICE_LINE_TITLE_OFFSET));
        });
};

/** 아래 장 전체를 그리고, 그린 배치를 돌려준다. 그릴 자리가 없으면 null. 캔버스는 부르는 쪽에서 지운다. */
export const renderMain = (painter: Painter, input: MainInput): Layout | null => {
    const {
        candles, timeUnit, style, width, height, range, averages, indicators, priceOverlays, volumeOverlays,
        priceLines, flatByPrevClose,
    } = input;

    // 위에서부터: 가격 / 거래량 / 보조지표들 / 날짜축
    const plotWidth = width - PRICE_AXIS_WIDTH;
    const plotBottom = height - TIME_AXIS_HEIGHT;
    const mainBottom = plotBottom - indicators.length * INDICATOR_PANE_HEIGHT;
    const mainHeight = mainBottom - PRICE_PANE_TOP;
    if (plotWidth <= 0 || mainHeight <= 0 || range.count === 0) return null;

    const visible = candles.slice(range.from, range.from + range.count);
    const volumeTop = mainBottom - mainHeight * VOLUME_RATIO;
    const priceTop = PRICE_PANE_TOP;
    const priceBottom = volumeTop - PANE_GAP;

    // 보이는 구간의 최고·최저가에 맞춰 가격축을 잡고, 위아래로 5% 여백을 둔다.
    // 이동평균선과 가격 영역 지표가 잘리지 않게 보이는 구간의 그 값들도 범위에 넣는다.
    const visibleAverages = [...averages, ...priceOverlays.flatMap(overlay => overlay.series)]
        .flatMap(values => values.slice(range.from, range.from + range.count))
        .filter(isNumber);
    const highest = Math.max(...visible.map(candle => candle.high), ...visibleAverages);
    const lowest = Math.min(...visible.map(candle => candle.low), ...visibleAverages);
    const padding = (highest - lowest) * 0.05 || highest * 0.01 || 1;
    const priceMin = lowest - padding;
    const priceMax = highest + padding;

    // 거래량 눈금 상한. 유난히 큰 막대는 영역 꼭대기에서 잘리고, 실제 값은 값 표시에서 확인한다.
    const volumes = visible.map(candle => candle.volume);
    const highestVolume = Math.max(...volumes);
    const typicalHigh = [...volumes].sort((a, b) => a - b)[Math.floor((volumes.length - 1) * VOLUME_PERCENTILE)];
    const volumeMax = Math.min(highestVolume, typicalHigh * VOLUME_OUTLIER_RATIO) || highestVolume || 1;

    const plotRightPx = painter.px(plotWidth);
    const frame: Frame = {
        painter, style, candles, visible, range, timeUnit, flatByPrevClose,
        plotWidth, plotBottom, mainBottom, priceTop, priceBottom, volumeTop,
        priceMin, priceMax, volumeMax,
        priceY: createLinearScale(priceMin, priceMax, priceTop, priceBottom),
        volumeY: createLinearScale(0, volumeMax, volumeTop, mainBottom),
        line: painter.lineWidth(),
        plotRightPx,
        plotBottomPx: painter.px(plotBottom),
        axisLabelX: plotRightPx + painter.px(AXIS_LABEL_OFFSET),
    };

    painter.useFont(style);
    const priceDecimals = drawPriceAxis(frame);
    drawVolumeAxis(frame);
    drawTimeAxis(frame);
    drawBorders(frame);
    drawCandles(frame, averages, priceOverlays, volumeOverlays);
    drawExtremes(frame);
    drawCurrentPrice(frame);
    drawPriceLines(frame, priceLines);

    const indicatorTops = indicators.map((_, order) => mainBottom + order * INDICATOR_PANE_HEIGHT);
    const indicatorPanes = indicators.map((instance, order) => drawIndicatorPane(
        painter, instance, indicatorTops[order], indicatorTops[order] + INDICATOR_PANE_HEIGHT, plotWidth, range, style,
    ));

    return {
        range, plotWidth, plotBottom, priceDecimals,
        panes: [
            {
                top: priceTop, bottom: priceBottom, scaleTop: priceTop, scaleBottom: priceBottom,
                min: priceMin, max: priceMax,
                format: value => formatPrice(value, priceDecimals),
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
    };
};
