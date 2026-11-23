import {Candle, ChartStyle, IndicatorConfig, IndicatorType, LineLook, SERIES_WIDTHS, TimeUnit} from "./types.ts";
import {
    averageTrueRange, bollinger, exponentialMovingAverage, ichimoku, macd, onBalanceVolume, relativeStrength, Series,
    simpleAverage, stochastic, volumeAverage, volumeWeightedAverage,
} from "./indicators.ts";
import {createLinearScale, formatVolume, niceTicks} from "./scale.ts";
import {AXIS_LABEL_OFFSET, LEGEND_HEIGHT} from "./constants.ts";
import {isNumber, Pane, VisibleRange} from "./layout.ts";
import {lineColor, Painter, textColorOf} from "./painter.ts";

// 보조지표 등록부. 지표를 추가하려면 IndicatorType 에 이름을 넣고 INDICATORS 에 하나 등록한다.
// 그려지는 자리는 세 가지: 가격 영역에 겹침(price) / 거래량 영역에 겹침(volume) / 차트 아래 별도 영역(pane)

const INDICATOR_PADDING_BOTTOM = 6;
const HISTOGRAM_ALPHA = 0.5;
const BAND_FILL_ALPHA = 0.08;       // 볼린저밴드 안쪽 채움
const RSI_LEVELS = [70, 30];        // 과매수·과매도 기준선
const STOCHASTIC_LEVELS = [80, 20];

const MAX_LINES = 8;                // 선 개수를 바꿀 수 있는 지표(지수이동평균)의 최대 선 수

const CLOUD_FILL_ALPHA = 0.12;      // 일목균형표의 구름 채움
const LINE_PANE_PADDING = 0.1;      // 값의 범위가 정해져 있지 않은 선 지표(OBV, ATR)의 위아래 여백 비율
const LINE_PANE_TICKS = 2;

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
    /** 십자선이 이 영역의 값을 적을 때 쓰는 표기. 없으면 소수 둘째 자리까지 */
    format?: (value: number) => string,
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
    hint?: string,  // 칸 아래에 적을 짧은 안내 (특별한 값의 뜻 등). 칸이 좁아 이름에 다 넣지 못하는 것
}

/** 지표를 계산할 때 캔들 말고 더 받는 것 */
export interface IndicatorContext {
    timeUnit: TimeUnit,                         // 차트의 주기. 분봉에서만 뜻이 있는 지표(VWAP)가 본다
    formatPrice: (value: number) => string,     // 캔들 가격과 같은 자릿수의 표기. 가격 단위의 지표(ATR)가 쓴다
    priceDecimals: () => number,                // 캔들 가격의 소수 자릿수. 캔들이 바뀌면 달라지므로 쓸 때 읽는다
}

/** 사용자가 모양(색·굵기·점선)을 바꿀 수 있는 선 하나. 색은 style.lineColors 안에서의 순번 */
export interface IndicatorColor {
    label: string,
    default: number,
    dashed?: boolean,   // 처음 상태가 점선인지. 비우면 실선
    // 저장된 색이 없을 때 따를 다른 선의 순번. 한 색으로 칠하던 선들을 나눈 지표(볼린저밴드)가
    // 예전에 저장한 색을 그대로 이어 쓰게 한다
    inherit?: number,
}

/** 지표에서 사용자가 바꿀 수 있는 것의 모양. 설정 창과 저장된 값의 해석이 이것을 따른다. */
export interface IndicatorShape {
    params: IndicatorParam[],
    colors: IndicatorColor[],
    /**
     * 있으면 설정값 하나가 선 하나인 지표(이동평균선, 지수이동평균)이고, 이 범위 안에서 선 개수를 바꿀 수 있다.
     * params 와 colors 는 처음 상태의 선들이다(한 개 이상, 같은 순서).
     */
    lines?: { min: number, max: number },
}

export interface IndicatorDefinition extends IndicatorShape {
    label: string,
    placement: IndicatorInstance['placement'],
    defaultOn: boolean,     // 처음 쓰는 사람에게 켜져 있는지
    /** params 와 looks(colors 와 같은 순서의 선 모양)는 resolveIndicator 를 거친 값(개수와 범위가 맞음) */
    create: (candles: Candle[], params: number[], looks: LineLook[], context: IndicatorContext) => IndicatorInstance,
}

const period = (label: string, value: number): IndicatorParam => ({label, default: value, min: 1, max: 500, step: 1});
const swatch = (label: string, order: number, more?: Pick<IndicatorColor, 'dashed' | 'inherit'>): IndicatorColor => (
    {label, default: order, ...more}
);

/** 선 하나를 정해 둔 모양(색·굵기·점선)대로 긋는다. */
const strokeLook = (
    painter: Painter, style: ChartStyle, values: Series, range: VisibleRange, toY: (value: number) => number,
    look: LineLook, startsAt?: Set<number>,
) => painter.strokeSeries(values, range, toY, lineColor(style, look.color), look, startsAt);

/** 선의 색. 값 표시의 글자색으로도 쓴다 */
const colorOf = (style: ChartStyle, look: LineLook): string => lineColor(style, look.color);

export const formatIndicator = (value: number | null | undefined): string =>
    isNumber(value) ? value.toLocaleString('ko-KR', {maximumFractionDigits: 2}) : '-';

// 가격을 이보다 잘게 적는 종목(1원 미만 코인 등)은 가격 차이 단위의 지표 값을 더 잘게 적는다
const SMALL_PRICE_DECIMALS = 2;
const DELTA_EXTRA_DECIMALS = 2;

/**
 * 가격 차이 단위의 지표 값(MACD·ATR) 표기. 가격이 아주 작은 종목은 이 값이 가격의 마지막 자리보다도 작아
 * 0 으로만 보이므로, 가격보다 두 자리 더 적는다. 그 밖의 종목은 fallback 그대로 적는다.
 */
const deltaFormat = (priceDecimals: () => number, fallback: (value: number) => string) => (value: number) => {
    const decimals = priceDecimals();
    return decimals > SMALL_PRICE_DECIMALS
        ? value.toLocaleString('ko-KR', {maximumFractionDigits: decimals + DELTA_EXTRA_DECIMALS})
        : fallback(value);
};

const formatWith = (format: (value: number) => string, value: number | null | undefined): string =>
    isNumber(value) ? format(value) : '-';

/** 0~100 범위의 선 지표(RSI, 스토캐스틱)가 함께 쓰는 그리기 */
const drawPercentPane = (
    {painter, range, style, plotWidth, top, bottom, scaleTop, scaleBottom, guide}: PaneDrawContext,
    levels: number[], lines: [Series, LineLook][],
) => {
    const toY = createLinearScale(0, 100, scaleTop, scaleBottom);
    levels.forEach(level => guide(toY(level), String(level)));
    painter.clipped(top, bottom, plotWidth, () => {
        lines.forEach(([values, look]) => strokeLook(painter, style, values, range, toY, look));
    });
    return {min: 0, max: 100};
};

/**
 * 값의 범위가 정해져 있지 않은 선 지표(OBV, ATR)가 함께 쓰는 그리기.
 * 보이는 구간의 값에 맞춰 세로 범위를 잡고, 오른쪽 축에 눈금을 한두 개 적는다.
 */
const drawLinePane = (
    {painter, range, style, plotWidth, top, bottom, scaleTop, scaleBottom, guide}: PaneDrawContext,
    values: Series, look: LineLook, format: (value: number) => string,
) => {
    const visible = values.slice(range.from, range.from + range.count).filter(isNumber);
    const lowest = visible.length > 0 ? Math.min(...visible) : 0;
    const highest = visible.length > 0 ? Math.max(...visible) : 1;
    const padding = (highest - lowest) * LINE_PANE_PADDING || Math.abs(highest) * LINE_PANE_PADDING || 1;
    const min = lowest - padding;
    const max = highest + padding;
    const toY = createLinearScale(min, max, scaleTop, scaleBottom);
    niceTicks(min, max, LINE_PANE_TICKS).values.forEach(value => guide(toY(value), format(value)));
    painter.clipped(top, bottom, plotWidth, () => {
        strokeLook(painter, style, values, range, toY, look);
    });
    return {min, max};
};

const ichimokuDefinition: IndicatorDefinition = {
    label: '일목균형표',
    placement: 'price',
    defaultOn: false,
    params: [period('전환선', 9), period('기준선', 26), period('선행스팬2', 52)],
    // 선행스팬 두 개와 구름은 상승색·하락색으로 뜻을 나타내므로 바꿀 수 없다.
    colors: [swatch('전환선', 2), swatch('기준선', 5), swatch('후행스팬', 3)],
    create: (candles, [conversionPeriod, basePeriod, spanPeriod], [conversionLook, baseLook, laggingLook]) => {
        const {conversion, base, spanA, spanB, lagging} = ichimoku(candles, conversionPeriod, basePeriod, spanPeriod);
        return {
            placement: 'price',
            series: [conversion, base, spanA, spanB],
            draw: ({painter, range, style, toY}) => {
                const ctx = painter.ctx;
                // 구름: 두 선행스팬 사이. 선행스팬1 이 위면 상승색, 아래면 하락색. 한 칸 안에서 두 선이 엇갈리면 그 자리에서 색을 나눈다.
                const {start, end} = painter.seriesSpan(spanA, range);
                ctx.globalAlpha = CLOUD_FILL_ALPHA;
                for (let index = start; index < end - 1; index++) {
                    const [a0, a1, b0, b1] = [spanA[index], spanA[index + 1], spanB[index], spanB[index + 1]];
                    if (!isNumber(a0) || !isNumber(a1) || !isNumber(b0) || !isNumber(b1)) continue;
                    const x0 = painter.centerX(index, range);
                    const x1 = painter.centerX(index + 1, range);
                    const [ya0, ya1, yb0, yb1] = [a0, a1, b0, b1].map(value => toY(value) * painter.dpr);
                    const fill = (above: boolean, points: [number, number][]) => {
                        ctx.fillStyle = above ? style.upColor : style.downColor;
                        ctx.beginPath();
                        points.forEach(([x, y], order) => order === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
                        ctx.closePath();
                        ctx.fill();
                    };
                    const gap0 = a0 - b0;
                    const gap1 = a1 - b1;
                    if (gap0 * gap1 >= 0) {
                        fill(gap0 + gap1 >= 0, [[x0, ya0], [x1, ya1], [x1, yb1], [x0, yb0]]);
                    } else {
                        // 엇갈리는 자리: 두 선의 차이가 0 이 되는 지점
                        const ratio = gap0 / (gap0 - gap1);
                        const crossX = x0 + (x1 - x0) * ratio;
                        const crossY = ya0 + (ya1 - ya0) * ratio;
                        fill(gap0 > 0, [[x0, ya0], [crossX, crossY], [x0, yb0]]);
                        fill(gap1 > 0, [[crossX, crossY], [x1, ya1], [x1, yb1]]);
                    }
                }
                ctx.globalAlpha = 1;

                painter.strokeSeries(spanA, range, toY, style.upColor);
                painter.strokeSeries(spanB, range, toY, style.downColor);
                strokeLook(painter, style, lagging, range, toY, laggingLook);
                strokeLook(painter, style, base, range, toY, baseLook);
                strokeLook(painter, style, conversion, range, toY, conversionLook);
            },
            legend: (index, style, format) => [
                [`일목 ${conversionPeriod}·${basePeriod}·${spanPeriod}`, style.textColor],
                [`전환 ${formatWith(format, conversion[index])}`, colorOf(style, conversionLook)],
                [`기준 ${formatWith(format, base[index])}`, colorOf(style, baseLook)],
                [`선행1 ${formatWith(format, spanA[index])}`, textColorOf(style, style.upColor)],
                [`선행2 ${formatWith(format, spanB[index])}`, textColorOf(style, style.downColor)],
            ],
        };
    },
};

const emaDefinition: IndicatorDefinition = {
    label: '지수이동평균',
    placement: 'price',
    defaultOn: false,
    params: [period('선 1', 12), period('선 2', 26)],
    // 단순 이동평균선과 구분되게 처음에는 점선으로 그린다.
    colors: [swatch('선 1', 0, {dashed: true}), swatch('선 2', 1, {dashed: true})],
    lines: {min: 1, max: MAX_LINES},
    create: (candles, periods, looks) => {
        const lines = periods.map(length => exponentialMovingAverage(candles, length));
        return {
            placement: 'price',
            series: lines,
            draw: ({painter, range, style, toY}) => {
                lines.forEach((values, order) => strokeLook(painter, style, values, range, toY, looks[order]));
            },
            legend: (index, style, format) => [
                ['지수이평', style.textColor],
                ...lines.map((values, order): LegendItem => (
                    [`${periods[order]} ${formatWith(format, values[index])}`, colorOf(style, looks[order])]
                )),
            ],
        };
    },
};

const vwapDefinition: IndicatorDefinition = {
    label: 'VWAP (분봉에서만)',
    placement: 'price',
    defaultOn: false,
    params: [],
    colors: [swatch('선', 2)],
    create: (candles, _params, [vwapLook], {timeUnit}) => {
        // 일봉 이상에서는 하루가 캔들 한 개라 계산할 것이 없으므로 그리지 않는다.
        const values = timeUnit === 'minute' ? volumeWeightedAverage(candles) : [];
        // 날이 바뀌어 새로 계산을 시작하는 순번. 앞날의 선과 잇지 않는다.
        const dayStarts = new Set(candles.flatMap((candle, index) => (
            index > 0 && new Date(candle.time).toDateString() !== new Date(candles[index - 1].time).toDateString()
                ? [index] : []
        )));
        return {
            placement: 'price',
            series: [values],
            draw: ({painter, range, style, toY}) => {
                strokeLook(painter, style, values, range, toY, vwapLook, dayStarts);
            },
            legend: (index, style, format) => values.length === 0 ? [] : [
                ['VWAP', style.textColor],
                [formatWith(format, values[index]), colorOf(style, vwapLook)],
            ],
        };
    },
};

const obvDefinition: IndicatorDefinition = {
    label: 'OBV',
    placement: 'pane',
    defaultOn: false,
    params: [],
    colors: [swatch('선', 5)],
    create: (candles, _params, [obvLook]) => {
        const values = onBalanceVolume(candles);
        return {
            placement: 'pane',
            format: formatVolume,
            draw: context => drawLinePane(context, values, obvLook, formatVolume),
            legend: (index, style) => [
                ['OBV', style.textColor],
                [formatWith(formatVolume, values[index]), colorOf(style, obvLook)],
            ],
        };
    },
};

const atrDefinition: IndicatorDefinition = {
    label: 'ATR',
    placement: 'pane',
    defaultOn: false,
    params: [period('기간', 14)],
    colors: [swatch('선', 1)],
    create: (candles, [length], [atrLook], {formatPrice, priceDecimals}) => {
        const values = averageTrueRange(candles, length);
        const format = deltaFormat(priceDecimals, formatPrice);
        return {
            placement: 'pane',
            format,
            draw: context => drawLinePane(context, values, atrLook, format),
            legend: (index, style) => [
                [`ATR ${length}`, style.textColor],
                [formatWith(format, values[index]), colorOf(style, atrLook)],
            ],
        };
    },
};

const rsiDefinition: IndicatorDefinition = {
    label: 'RSI',
    placement: 'pane',
    defaultOn: true,
    // 시그널: RSI 값의 단순 이동평균(토스·트레이딩뷰 기본과 같은 14). 0 이면 긋지 않는다.
    // 예전에 저장한 RSI 설정에는 시그널 값이 없어 기본값으로 켜진다
    params: [period('기간', 14), {...period('시그널', 14), min: 0, hint: '0이면 끔'}],
    colors: [swatch('선', 2), swatch('시그널', 1)],
    create: (candles, [length, signalLength], [rsiLook, signalLook]) => {
        const values = relativeStrength(candles, length);
        const signal = signalLength > 0 ? simpleAverage(values, signalLength) : null;
        return {
            placement: 'pane',
            draw: context => drawPercentPane(
                context, RSI_LEVELS, signal ? [[values, rsiLook], [signal, signalLook]] : [[values, rsiLook]],
            ),
            legend: (index, style) => signal
                ? [
                    [`RSI ${length}·${signalLength}`, style.textColor],
                    [`RSI ${formatIndicator(values[index])}`, colorOf(style, rsiLook)],
                    [`시그널 ${formatIndicator(signal[index])}`, colorOf(style, signalLook)],
                ]
                : [
                    [`RSI ${length}`, style.textColor],
                    [formatIndicator(values[index]), colorOf(style, rsiLook)],
                ],
        };
    },
};

const macdDefinition: IndicatorDefinition = {
    label: 'MACD',
    placement: 'pane',
    defaultOn: true,
    params: [period('단기', 12), period('장기', 26), period('시그널', 9)],
    // 오실레이터 막대는 상승색·하락색으로 뜻을 나타내므로 바꿀 수 없다.
    colors: [swatch('MACD', 4), swatch('시그널', 1)],
    create: (candles, [fast, slow, signalLength], [macdLook, signalLook], {priceDecimals}) => {
        const {macd: macdLine, signal, histogram} = macd(candles, fast, slow, signalLength);
        const format = deltaFormat(priceDecimals, formatIndicator);
        return {
            placement: 'pane',
            format,
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

                    strokeLook(painter, style, macdLine, range, toY, macdLook);
                    strokeLook(painter, style, signal, range, toY, signalLook);
                });
                return {min: -extent, max: extent};
            },
            legend: (index, style) => {
                const bar = histogram[index];
                return [
                    [`MACD ${fast}·${slow}·${signalLength}`, style.textColor],
                    [`MACD ${formatWith(format, macdLine[index])}`, colorOf(style, macdLook)],
                    [`시그널 ${formatWith(format, signal[index])}`, colorOf(style, signalLook)],
                    [
                        `오실레이터 ${formatWith(format, bar)}`,
                        !isNumber(bar) ? style.textColor : textColorOf(style, bar >= 0 ? style.upColor : style.downColor),
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
    colors: [swatch('%K', 4), swatch('%D', 1)],
    create: (candles, [length, smoothK, smoothD], [kLook, dLook]) => {
        const {k, d} = stochastic(candles, length, smoothK, smoothD);
        return {
            placement: 'pane',
            draw: context => drawPercentPane(context, STOCHASTIC_LEVELS, [[k, kLook], [d, dLook]]),
            legend: (index, style) => [
                [`스토캐스틱 ${length}·${smoothK}·${smoothD}`, style.textColor],
                [`%K ${formatIndicator(k[index])}`, colorOf(style, kLook)],
                [`%D ${formatIndicator(d[index])}`, colorOf(style, dLook)],
            ],
        };
    },
};

const bollingerDefinition: IndicatorDefinition = {
    label: '볼린저밴드',
    placement: 'price',
    defaultOn: false,
    params: [period('기간', 20), {label: '배수', default: 2, min: 0.1, max: 10, step: 0.1}],
    // 예전에는 세 선을 한 색으로 칠했다. 그때 저장한 색(첫 칸)을 가운데·아래 선도 이어 쓴다.
    colors: [swatch('위', 5), swatch('가운데', 5, {inherit: 0}), swatch('아래', 5, {inherit: 0})],
    create: (candles, [length, multiplier], [upperLook, middleLook, lowerLook]) => {
        const {upper, middle, lower} = bollinger(candles, length, multiplier);
        const lines: [Series, LineLook][] = [[upper, upperLook], [middle, middleLook], [lower, lowerLook]];
        return {
            placement: 'price',
            series: [upper, lower],
            draw: ({painter, range, style, toY}) => {
                const ctx = painter.ctx;

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
                    ctx.fillStyle = colorOf(style, upperLook);     // 채움은 위 선의 색을 따른다
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }

                lines.forEach(([values, look]) => strokeLook(painter, style, values, range, toY, look));
            },
            legend: (index, style, format) => [
                [`볼린저 ${length}·${multiplier}`, style.textColor],
                ...lines.map(([values, look]): LegendItem => [formatWith(format, values[index]), colorOf(style, look)]),
            ],
        };
    },
};

const volumeAverageDefinition: IndicatorDefinition = {
    label: '거래량 이동평균',
    placement: 'volume',
    defaultOn: false,
    params: [period('기간', 20)],
    colors: [swatch('선', 1)],
    create: (candles, [length], [averageLook]) => {
        const values = volumeAverage(candles, length);
        return {
            placement: 'volume',
            series: [values],
            draw: ({painter, range, style, toY}) => {
                strokeLook(painter, style, values, range, toY, averageLook);
            },
            legend: (index, style, format) => [
                [`거래량 이평 ${length}`, style.textColor],
                [formatWith(format, values[index]), colorOf(style, averageLook)],
            ],
        };
    },
};

/** 지표 등록부. 적힌 순서가 설정 창에 보이는 순서다. */
export const INDICATORS: Record<IndicatorType, IndicatorDefinition> = {
    bollinger: bollingerDefinition,
    ichimoku: ichimokuDefinition,
    ema: emaDefinition,
    vwap: vwapDefinition,
    volumeAverage: volumeAverageDefinition,
    rsi: rsiDefinition,
    macd: macdDefinition,
    stochastic: stochasticDefinition,
    obv: obvDefinition,
    atr: atrDefinition,
};

/** 저장된 설정값을 쓸 수 있는 값으로 맞춘다: 빠졌거나 숫자가 아니면 기본값, 범위를 벗어나면 끝값, 정수 항목은 반올림 */
export const normalizeParams = (specs: IndicatorParam[], values: number[] | undefined): number[] =>
    specs.map((spec, order) => {
        const value = values?.[order];
        if (typeof value !== 'number' || !Number.isFinite(value)) return spec.default;
        const bounded = Math.min(spec.max, Math.max(spec.min, value));
        return spec.step === 1 ? Math.round(bounded) : bounded;
    });

/** 저장된 값을 지표의 모양에 맞춘 결과 */
export interface ResolvedIndicator {
    paramSpecs: IndicatorParam[],   // 설정값 칸들. 선 개수를 바꿀 수 있는 지표는 지금의 선 수만큼
    colorSpecs: IndicatorColor[],   // 색을 바꿀 수 있는 선들
    params: number[],               // paramSpecs 와 같은 순서의 값
    colors: number[],               // colorSpecs 와 같은 순서의 색 순번
    widths: number[],               // colorSpecs 와 같은 순서의 굵기
    dashes: boolean[],              // colorSpecs 와 같은 순서의 점선 여부
}

/** 지표 하나에 대해 저장해 둔 값. 비운 항목은 기본값을 쓴다 */
export interface IndicatorOverride {
    params?: number[] | null,
    colors?: number[] | null,
    widths?: number[] | null,
    dashes?: boolean[] | null,
}

/** 맞춘 결과에서 선마다의 모양을 꺼낸다. */
export const looksOf = ({colors, widths, dashes}: ResolvedIndicator): LineLook[] =>
    colors.map((color, order) => ({color, width: widths[order], dashed: dashes[order]}));

/**
 * 저장된 설정값과 선 모양을 지표의 모양에 맞춘다. 빠졌거나 쓸 수 없는 값은 기본값으로 채운다.
 * 선 개수를 바꿀 수 있는 지표는 저장된 설정값의 개수가 선의 수가 된다(범위 안으로 맞춘다).
 * 처음 상태에 없던 선은 마지막 선의 정의를 따르고, 색은 순번대로 돌려 쓴다.
 */
export const resolveIndicator = (shape: IndicatorShape, saved?: IndicatorOverride | null): ResolvedIndicator => {
    const {params, colors, widths, dashes} = saved ?? {};
    const {lines} = shape;
    const count = lines
        ? Math.min(lines.max, Math.max(lines.min, params?.length ?? shape.params.length))
        : shape.params.length;
    const paramSpecs = lines
        ? Array.from({length: count}, (_unused, order): IndicatorParam => (
            shape.params[order] ?? {...shape.params[shape.params.length - 1], label: `선 ${order + 1}`}
        ))
        : shape.params;
    const colorSpecs = lines
        ? Array.from({length: count}, (_unused, order): IndicatorColor => (
            shape.colors[order]
            ?? {label: `선 ${order + 1}`, default: order, dashed: shape.colors[shape.colors.length - 1]?.dashed}
        ))
        : shape.colors;
    const savedColor = (order: number): number | undefined => {
        const value = colors?.[order];
        return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
    };
    return {
        paramSpecs,
        colorSpecs,
        params: normalizeParams(paramSpecs, params ?? undefined),
        colors: colorSpecs.map((spec, order) => (
            savedColor(order) ?? (spec.inherit === undefined ? undefined : savedColor(spec.inherit)) ?? spec.default
        )),
        widths: colorSpecs.map((_spec, order) => {
            const value = widths?.[order];
            return typeof value === 'number' && SERIES_WIDTHS.includes(value) ? value : SERIES_WIDTHS[0];
        }),
        dashes: colorSpecs.map((spec, order) => {
            const value = dashes?.[order];
            return typeof value === 'boolean' ? value : spec.dashed ?? false;
        }),
    };
};

/** 설정값과 선 모양을 맞춘 뒤 캔들로 지표를 계산한다. */
export const createIndicator = (
    config: IndicatorConfig, candles: Candle[], context: IndicatorContext,
): IndicatorInstance => {
    const definition = INDICATORS[config.type];
    const resolved = resolveIndicator(definition, config);
    return definition.create(candles, resolved.params, looksOf(resolved), context);
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
    return {top, bottom, scaleTop, scaleBottom, min, max, format: instance.format ?? formatIndicator};
};
