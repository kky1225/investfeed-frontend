import {Candle, ChartStyle, IndicatorType} from "./types.ts";
import {macd, relativeStrength} from "./indicators.ts";
import {createLinearScale} from "./scale.ts";
import {AXIS_LABEL_OFFSET, LEGEND_HEIGHT} from "./constants.ts";
import {isNumber, Pane, VisibleRange} from "./layout.ts";
import {lineColor, Painter} from "./painter.ts";

// 차트 아래에 쌓는 보조지표. 지표를 추가하려면 IndicatorType 에 이름을 넣고 INDICATORS 에 하나 등록한다.

const INDICATOR_PADDING_BOTTOM = 6;
const HISTOGRAM_ALPHA = 0.5;

const RSI_PERIOD = 14;
const RSI_LEVELS = [70, 30];    // 과매수·과매도 기준선
const MACD_FAST = 12;
const MACD_SLOW = 26;
const MACD_SIGNAL = 9;

// style.lineColors 안에서의 색 순서
const RSI_COLOR = 2;
const MACD_COLOR = 4;
const MACD_SIGNAL_COLOR = 1;

/** 값 표시 한 항목: [글자, 색] */
export type LegendItem = [string, string];

/** 지표가 자기 영역을 그릴 때 받는 것 */
export interface IndicatorDrawContext {
    painter: Painter,
    range: VisibleRange,
    style: ChartStyle,
    plotWidth: number,      // CSS px
    top: number,            // 영역 범위 (CSS px)
    bottom: number,
    scaleTop: number,       // 값을 그릴 수 있는 범위. 위쪽 한 줄은 값 표시가 쓴다
    scaleBottom: number,
    /** 높이 y 에 기준선을 긋고 오른쪽 축에 label 을 적는다. */
    guide: (y: number, label: string) => void,
}

/** 캔들에 맞춰 계산을 마친 지표 하나 */
export interface IndicatorInstance {
    /** 영역을 그리고, 십자선이 값을 읽을 수 있게 세로 범위를 돌려준다. */
    draw: (context: IndicatorDrawContext) => { min: number, max: number },
    /** index 번째 캔들에서의 이름과 값 */
    legend: (index: number, style: ChartStyle) => LegendItem[],
}

export const formatIndicator = (value: number | null | undefined): string =>
    isNumber(value) ? value.toLocaleString('ko-KR', {maximumFractionDigits: 2}) : '-';

const createRsi = (candles: Candle[]): IndicatorInstance => {
    const values = relativeStrength(candles, RSI_PERIOD);
    return {
        draw: ({painter, range, style, plotWidth, top, bottom, scaleTop, scaleBottom, guide}) => {
            const toY = createLinearScale(0, 100, scaleTop, scaleBottom);
            RSI_LEVELS.forEach(level => guide(toY(level), String(level)));
            painter.clipped(top, bottom, plotWidth, () => {
                painter.strokeSeries(values, range, toY, lineColor(style, RSI_COLOR));
            });
            return {min: 0, max: 100};
        },
        legend: (index, style) => [
            [`RSI ${RSI_PERIOD}`, style.textColor],
            [formatIndicator(values[index]), lineColor(style, RSI_COLOR)],
        ],
    };
};

const createMacd = (candles: Candle[]): IndicatorInstance => {
    const {macd: macdLine, signal, histogram} = macd(candles, MACD_FAST, MACD_SLOW, MACD_SIGNAL);
    return {
        draw: ({painter, range, style, plotWidth, top, bottom, scaleTop, scaleBottom, guide}) => {
            // 보이는 구간에서 0 을 가운데에 두고 위아래 같은 폭으로 잡는다.
            const ctx = painter.ctx;
            const end = range.from + range.count;
            const extent = Math.max(
                0,
                ...[macdLine, signal, histogram]
                    .flatMap(values => values.slice(range.from, end))
                    .filter(isNumber)
                    .map(Math.abs),
            ) || 1;
            const toY = createLinearScale(-extent, extent, scaleTop, scaleBottom);
            guide(toY(0), '0');

            painter.clipped(top, bottom, plotWidth, () => {
                // 오실레이터 막대: 0 위는 상승색, 아래는 하락색
                const bodyWidth = painter.bodyWidth(range);
                const zeroY = painter.px(toY(0));
                ctx.globalAlpha = HISTOGRAM_ALPHA;
                for (let index = range.from; index < end; index++) {
                    const value = histogram[index];
                    if (!isNumber(value)) continue;
                    const valueY = painter.px(toY(value));
                    ctx.fillStyle = value >= 0 ? style.upColor : style.downColor;
                    ctx.fillRect(
                        painter.centerX(index, range) - Math.floor(bodyWidth / 2),
                        Math.min(zeroY, valueY),
                        bodyWidth,
                        Math.max(1, Math.abs(valueY - zeroY)),
                    );
                }
                ctx.globalAlpha = 1;

                painter.strokeSeries(macdLine, range, toY, lineColor(style, MACD_COLOR));
                painter.strokeSeries(signal, range, toY, lineColor(style, MACD_SIGNAL_COLOR));
            });
            return {min: -extent, max: extent};
        },
        legend: (index, style) => {
            const bar = histogram[index];
            return [
                [`MACD ${MACD_FAST}·${MACD_SLOW}·${MACD_SIGNAL}`, style.textColor],
                [`MACD ${formatIndicator(macdLine[index])}`, lineColor(style, MACD_COLOR)],
                [`시그널 ${formatIndicator(signal[index])}`, lineColor(style, MACD_SIGNAL_COLOR)],
                [
                    `오실레이터 ${formatIndicator(bar)}`,
                    !isNumber(bar) ? style.textColor : bar >= 0 ? style.upColor : style.downColor,
                ],
            ];
        },
    };
};

/** 지표 종류별로, 캔들을 받아 계산을 마친 지표를 만드는 함수 */
export const INDICATORS: Record<IndicatorType, (candles: Candle[]) => IndicatorInstance> = {
    rsi: createRsi,
    macd: createMacd,
};

/** 보조지표 영역 하나를 그린다. 위쪽 한 줄은 값 표시(위 장)가 쓰도록 비워 둔다. */
export const drawIndicatorPane = (
    painter: Painter, instance: IndicatorInstance, top: number, bottom: number,
    plotWidth: number, range: VisibleRange, style: ChartStyle,
): Pane => {
    const ctx = painter.ctx;
    const line = painter.lineWidth();
    const plotRightPx = painter.px(plotWidth);
    const axisLabelX = plotRightPx + painter.px(AXIS_LABEL_OFFSET);
    const scaleTop = top + LEGEND_HEIGHT;
    const scaleBottom = bottom - INDICATOR_PADDING_BOTTOM;

    // 위 영역과의 경계선
    ctx.fillStyle = style.gridColor;
    ctx.fillRect(0, painter.px(top), plotRightPx, line);

    // 기준선 + 오른쪽 라벨
    ctx.textAlign = 'left';
    const guide = (y: number, label: string) => {
        ctx.fillStyle = style.gridColor;
        ctx.fillRect(0, painter.px(y), plotRightPx, line);
        ctx.fillStyle = style.textColor;
        ctx.fillText(label, axisLabelX, painter.px(y));
    };

    const {min, max} = instance.draw({painter, range, style, plotWidth, top, bottom, scaleTop, scaleBottom, guide});
    return {top, bottom, scaleTop, scaleBottom, min, max, format: formatIndicator};
};
