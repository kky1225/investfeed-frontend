import {Candle, ChartStyle, IndicatorConfig, IndicatorType} from "./types.ts";
import {bollinger, macd, relativeStrength, Series, stochastic, volumeAverage} from "./indicators.ts";
import {createLinearScale} from "./scale.ts";
import {AXIS_LABEL_OFFSET, LEGEND_HEIGHT} from "./constants.ts";
import {isNumber, Pane, VisibleRange} from "./layout.ts";
import {lineColor, Painter} from "./painter.ts";

// 보조지표 등록부. 지표를 추가하려면 IndicatorType 에 이름을 넣고 INDICATORS 에 하나 등록한다.
// 그려지는 자리는 세 가지: 가격 영역에 겹침(price) / 거래량 영역에 겹침(volume) / 차트 아래 별도 영역(pane)

const INDICATOR_PADDING_BOTTOM = 6;
const HISTOGRAM_ALPHA = 0.5;
const BAND_FILL_ALPHA = 0.08;       // 볼린저밴드 안쪽 채움
const RSI_LEVELS = [70, 30];        // 과매수·과매도 기준선
const STOCHASTIC_LEVELS = [80, 20];

// style.lineColors 안에서의 색 순서
const RSI_COLOR = 2;
const MACD_COLOR = 4;
const MACD_SIGNAL_COLOR = 1;
const STOCHASTIC_K_COLOR = 4;
const STOCHASTIC_D_COLOR = 1;
const VOLUME_AVERAGE_COLOR = 1;
const BAND_COLOR = 5;

/** 값 표시 한 항목: [글자, 색] */
export type LegendItem = [string, string];

/** 별도 영역 지표가 자기 영역을 그릴 때 받는 것 */
export interface PaneDrawContext {
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

/** 겹쳐 그리는 지표가 받는 것. 그 영역 밖으로 나가지 않게 잘린 상태에서 불린다. */
export interface OverlayDrawContext {
    painter: Painter,
    range: VisibleRange,
    style: ChartStyle,
    toY: (value: number) => number,     // 그 영역의 값 → 높이 (CSS px)
}

/** 차트 아래 별도 영역에 그리는 지표 (계산을 마친 상태) */
export interface PaneIndicator {
    placement: 'pane',
    /** 영역을 그리고, 십자선이 값을 읽을 수 있게 세로 범위를 돌려준다. */
    draw: (context: PaneDrawContext) => { min: number, max: number },
    /** index 번째 캔들에서의 이름과 값 */
    legend: (index: number, style: ChartStyle) => LegendItem[],
}

/** 가격·거래량 영역에 겹쳐 그리는 지표 (계산을 마친 상태) */
export interface OverlayIndicator {
    placement: 'price' | 'volume',
    series: Series[],   // 가격 영역 지표는 이 값들도 보이도록 가격축 범위를 잡는다
    draw: (context: OverlayDrawContext) => void,
    /** index 번째 캔들에서의 이름과 값. format 은 그 영역의 값 표기 */
    legend: (index: number, style: ChartStyle, format: (value: number) => string) => LegendItem[],
}

export type IndicatorInstance = PaneIndicator | OverlayIndicator;

/** 사용자가 바꿀 수 있는 설정값 하나 */
export interface IndicatorParam {
    label: string,
    default: number,
    min: number,
    max: number,
    step: number,   // 1 이면 정수만 받는다
}

export interface IndicatorDefinition {
    label: string,
    placement: IndicatorInstance['placement'],
    defaultOn: boolean,     // 처음 쓰는 사람에게 켜져 있는지
    params: IndicatorParam[],
    /** params 는 normalizeParams 를 거친 값(개수와 범위가 맞음) */
    create: (candles: Candle[], params: number[]) => IndicatorInstance,
}

const period = (label: string, value: number): IndicatorParam => ({label, default: value, min: 1, max: 500, step: 1});

export const formatIndicator = (value: number | null | undefined): string =>
    isNumber(value) ? value.toLocaleString('ko-KR', {maximumFractionDigits: 2}) : '-';

const formatWith = (format: (value: number) => string, value: number | null | undefined): string =>
    isNumber(value) ? format(value) : '-';

/** 0~100 범위의 선 지표(RSI, 스토캐스틱)가 함께 쓰는 그리기 */
const drawPercentPane = (
    {painter, range, style, plotWidth, top, bottom, scaleTop, scaleBottom, guide}: PaneDrawContext,
    levels: number[], lines: [Series, number][],
) => {
    const toY = createLinearScale(0, 100, scaleTop, scaleBottom);
    levels.forEach(level => guide(toY(level), String(level)));
    painter.clipped(top, bottom, plotWidth, () => {
        lines.forEach(([values, color]) => painter.strokeSeries(values, range, toY, lineColor(style, color)));
    });
    return {min: 0, max: 100};
};

const rsiDefinition: IndicatorDefinition = {
    label: 'RSI',
    placement: 'pane',
    defaultOn: true,
    params: [period('기간', 14)],
    create: (candles, [length]) => {
        const values = relativeStrength(candles, length);
        return {
            placement: 'pane',
            draw: context => drawPercentPane(context, RSI_LEVELS, [[values, RSI_COLOR]]),
            legend: (index, style) => [
                [`RSI ${length}`, style.textColor],
                [formatIndicator(values[index]), lineColor(style, RSI_COLOR)],
            ],
        };
    },
};

const macdDefinition: IndicatorDefinition = {
    label: 'MACD',
    placement: 'pane',
    defaultOn: true,
    params: [period('단기', 12), period('장기', 26), period('시그널', 9)],
    create: (candles, [fast, slow, signalLength]) => {
        const {macd: macdLine, signal, histogram} = macd(candles, fast, slow, signalLength);
        return {
            placement: 'pane',
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
                    [`MACD ${fast}·${slow}·${signalLength}`, style.textColor],
                    [`MACD ${formatIndicator(macdLine[index])}`, lineColor(style, MACD_COLOR)],
                    [`시그널 ${formatIndicator(signal[index])}`, lineColor(style, MACD_SIGNAL_COLOR)],
                    [
                        `오실레이터 ${formatIndicator(bar)}`,
                        !isNumber(bar) ? style.textColor : bar >= 0 ? style.upColor : style.downColor,
                    ],
                ];
            },
        };
    },
};

const stochasticDefinition: IndicatorDefinition = {
    label: '스토캐스틱',
    placement: 'pane',
    defaultOn: false,
    params: [period('기간', 14), period('%K', 3), period('%D', 3)],
    create: (candles, [length, smoothK, smoothD]) => {
        const {k, d} = stochastic(candles, length, smoothK, smoothD);
        return {
            placement: 'pane',
            draw: context => drawPercentPane(context, STOCHASTIC_LEVELS, [[k, STOCHASTIC_K_COLOR], [d, STOCHASTIC_D_COLOR]]),
            legend: (index, style) => [
                [`스토캐스틱 ${length}·${smoothK}·${smoothD}`, style.textColor],
                [`%K ${formatIndicator(k[index])}`, lineColor(style, STOCHASTIC_K_COLOR)],
                [`%D ${formatIndicator(d[index])}`, lineColor(style, STOCHASTIC_D_COLOR)],
            ],
        };
    },
};

const bollingerDefinition: IndicatorDefinition = {
    label: '볼린저밴드',
    placement: 'price',
    defaultOn: false,
    params: [period('기간', 20), {label: '배수', default: 2, min: 0.1, max: 10, step: 0.1}],
    create: (candles, [length, multiplier]) => {
        const {upper, middle, lower} = bollinger(candles, length, multiplier);
        return {
            placement: 'price',
            series: [upper, lower],
            draw: ({painter, range, style, toY}) => {
                const ctx = painter.ctx;
                const color = lineColor(style, BAND_COLOR);

                // 위·아래 선 사이를 옅게 채운다. 선과 같이 양옆 한 칸씩 더 잡아 가장자리에서 끊겨 보이지 않게 한다.
                const start = Math.max(0, range.from - 1);
                const end = Math.min(upper.length, range.from + range.count + 1);
                const edges: { x: number, top: number, bottom: number }[] = [];
                for (let index = start; index < end; index++) {
                    const high = upper[index];
                    const low = lower[index];
                    if (!isNumber(high) || !isNumber(low)) continue;
                    edges.push({x: painter.centerX(index, range), top: toY(high) * painter.dpr, bottom: toY(low) * painter.dpr});
                }
                if (edges.length > 1) {
                    ctx.beginPath();
                    edges.forEach((edge, order) => {
                        if (order === 0) ctx.moveTo(edge.x, edge.top);
                        else ctx.lineTo(edge.x, edge.top);
                    });
                    [...edges].reverse().forEach(edge => ctx.lineTo(edge.x, edge.bottom));
                    ctx.closePath();
                    ctx.globalAlpha = BAND_FILL_ALPHA;
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }

                [upper, middle, lower].forEach(values => painter.strokeSeries(values, range, toY, color));
            },
            legend: (index, style, format) => [
                [`볼린저 ${length}·${multiplier}`, style.textColor],
                [
                    [upper, middle, lower].map(values => formatWith(format, values[index])).join(' · '),
                    lineColor(style, BAND_COLOR),
                ],
            ],
        };
    },
};

const volumeAverageDefinition: IndicatorDefinition = {
    label: '거래량 이동평균',
    placement: 'volume',
    defaultOn: false,
    params: [period('기간', 20)],
    create: (candles, [length]) => {
        const values = volumeAverage(candles, length);
        return {
            placement: 'volume',
            series: [values],
            draw: ({painter, range, style, toY}) => {
                painter.strokeSeries(values, range, toY, lineColor(style, VOLUME_AVERAGE_COLOR));
            },
            legend: (index, style, format) => [
                [`거래량 이평 ${length}`, style.textColor],
                [formatWith(format, values[index]), lineColor(style, VOLUME_AVERAGE_COLOR)],
            ],
        };
    },
};

/** 지표 등록부. 적힌 순서가 설정 창에 보이는 순서다. */
export const INDICATORS: Record<IndicatorType, IndicatorDefinition> = {
    bollinger: bollingerDefinition,
    volumeAverage: volumeAverageDefinition,
    rsi: rsiDefinition,
    macd: macdDefinition,
    stochastic: stochasticDefinition,
};

/** 저장된 설정값을 쓸 수 있는 값으로 맞춘다: 빠졌거나 숫자가 아니면 기본값, 범위를 벗어나면 끝값, 정수 항목은 반올림 */
export const normalizeParams = (specs: IndicatorParam[], values: number[] | undefined): number[] =>
    specs.map((spec, order) => {
        const value = values?.[order];
        if (typeof value !== 'number' || !Number.isFinite(value)) return spec.default;
        const bounded = Math.min(spec.max, Math.max(spec.min, value));
        return spec.step === 1 ? Math.round(bounded) : bounded;
    });

/** 설정값을 맞춘 뒤 캔들로 지표를 계산한다. */
export const createIndicator = (config: IndicatorConfig, candles: Candle[]): IndicatorInstance => {
    const definition = INDICATORS[config.type];
    return definition.create(candles, normalizeParams(definition.params, config.params));
};

/** 별도 영역 지표 하나를 그린다. 위쪽 한 줄은 값 표시(위 장)가 쓰도록 비워 둔다. */
export const drawIndicatorPane = (
    painter: Painter, instance: PaneIndicator, top: number, bottom: number,
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
