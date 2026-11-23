import {Candle, ChartStyle, SeriesStroke} from "./types.ts";
import {Series} from "./indicators.ts";
import {BODY_RATIO, FONT_SIZE, SERIES_DASH, SERIES_LINE_WIDTH} from "./constants.ts";
import {isNumber, VisibleRange} from "./layout.ts";

const PIXEL_RATIO_SLACK = 0.005;    // 화면 배율 감시 쿼리의 여유. 실제 배율 단계(0.1 이상)보다 훨씬 작게

/**
 * 화면 배율(devicePixelRatio)이 바뀌면 onChange 를 부른다. 그만 볼 때 부를 함수를 돌려준다.
 * 배율이 다른 모니터로 창을 옮기면 차트 크기(CSS px)는 그대로라 크기 감시가 알려 주지 않으므로,
 * 지금 배율 앞뒤의 아주 좁은 범위에만 맞는 미디어 쿼리를 걸어 두고 벗어나는 순간 알린다. 바뀔 때마다 새 배율로 다시 건다.
 * 정확히 같은 배율을 묻지 않는 것은, 소수 배율(확대 110% 등)에서 브라우저에 따라 쿼리 안의 해상도와 소수점 아래가 달라
 * 처음부터 맞지 않으면 알림이 한 번도 오지 않기 때문이다.
 */
export const watchPixelRatio = (onChange: () => void): () => void => {
    let query: MediaQueryList | null = null;
    const handleChange = () => {
        watch();
        onChange();
    };
    const watch = () => {
        query?.removeEventListener('change', handleChange);
        const dpr = window.devicePixelRatio || 1;
        query = window.matchMedia(
            `(min-resolution: ${dpr - PIXEL_RATIO_SLACK}dppx) and (max-resolution: ${dpr + PIXEL_RATIO_SLACK}dppx)`,
        );
        query.addEventListener('change', handleChange);
    };
    watch();
    return () => {
        query?.removeEventListener('change', handleChange);
        query = null;
    };
};

/**
 * 캔버스 한 장에 그릴 때 쓰는 공통 도구.
 * 좌표는 CSS px 로 계산한 뒤 px() 로 기기 픽셀에 맞춰 선이 흐려지지 않게 한다.
 */
export class Painter {
    readonly ctx: CanvasRenderingContext2D;
    dpr = 1;    // 엔진이 크기를 바꿀 때 갱신한다

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    /** CSS px → 기기 픽셀(정수) */
    px(value: number): number {
        return Math.round(value * this.dpr);
    }

    /** 선 굵기 (기기 픽셀) */
    lineWidth(): number {
        return Math.max(1, Math.floor(this.dpr));
    }

    /** 캔들 가운데의 가로 위치 (기기 픽셀). index 는 전체 캔들 기준 순번 */
    centerX(index: number, range: VisibleRange): number {
        return this.px((index + 0.5 - range.leftEdge) * range.spacing);
    }

    /** 캔들 몸통·막대 너비 (기기 픽셀) */
    bodyWidth(range: VisibleRange): number {
        return Math.max(1, this.px(range.spacing * BODY_RATIO));
    }

    /** 글자를 적기 전에 한 번 부른다. */
    useFont(style: ChartStyle) {
        this.ctx.font = `${this.px(FONT_SIZE)}px ${style.fontFamily}`;
        this.ctx.textBaseline = 'middle';
    }

    /** 그림 영역(가로 0~plotWidth)의 top~bottom 밖으로 나가지 않게 잘라 그린다. (CSS px) */
    clipped(top: number, bottom: number, plotWidth: number, draw: () => void) {
        const ctx = this.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, this.px(top), this.px(plotWidth), this.px(bottom) - this.px(top));
        ctx.clip();
        draw();
        ctx.restore();
    }

    /**
     * 지표 값을 선으로 잇는다. 화면 가장자리에서 끊겨 보이지 않게 양옆 한 칸씩 더 잇는다.
     * 값이 캔들보다 길면(앞으로 밀어 그리는 지표) 마지막 캔들 뒤의 빈 구간까지 잇는다. stroke 로 굵기와 점선을 정하고,
     * startsAt 을 주면 그 순번들에서 선을 끊고 새로 시작한다(날마다 새로 계산하는 지표).
     */
    strokeSeries(
        values: Series, range: VisibleRange, toY: (value: number) => number, color: string,
        stroke?: SeriesStroke, startsAt?: Set<number>,
    ) {
        const ctx = this.ctx;
        const {start, end} = this.seriesSpan(values, range);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, Math.round(SERIES_LINE_WIDTH * (stroke?.width ?? 1) * this.dpr));
        ctx.lineJoin = 'round';
        ctx.setLineDash(stroke?.dashed ? SERIES_DASH.map(length => this.px(length)) : []);
        ctx.beginPath();
        let started = false;
        for (let index = start; index < end; index++) {
            const value = values[index];
            if (!isNumber(value)) continue;
            const x = this.centerX(index, range);
            const y = toY(value) * this.dpr;
            if (started && !startsAt?.has(index)) {
                ctx.lineTo(x, y);
            } else {
                ctx.moveTo(x, y);
                started = true;
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /** 지표 값 중 화면에 걸치는 순번의 범위 [start, end). 양옆 한 칸씩 더 잡는다. */
    seriesSpan(values: Series, range: VisibleRange): { start: number, end: number } {
        return {
            start: Math.max(0, range.from - 1),
            end: Math.min(values.length, Math.max(range.from + range.count, Math.ceil(range.rightEdge)) + 1),
        };
    }
}

/**
 * index 번째 캔들의 색. 종가가 시가보다 낮을 때만 하락색이고, 시가와 같으면 상승색이다.
 * flatByPrevClose 를 켜면 시가와 종가가 같은 캔들만 전일 종가와 비교한다
 * (점하한가는 하락색, 전일 종가와도 같으면 보합색).
 */
export const candleColor = (candles: Candle[], index: number, style: ChartStyle, flatByPrevClose: boolean): string => {
    const candle = candles[index];
    if (candle.close !== candle.open) return candle.close > candle.open ? style.upColor : style.downColor;
    const prev = flatByPrevClose ? candles[index - 1] : undefined;
    if (!prev) return style.upColor;
    return candle.close > prev.close ? style.upColor
        : candle.close < prev.close ? style.downColor
        : style.textColor;
};

/**
 * 색을 글자에 쓸 때의 색. 상승색·하락색이면 글자용 색으로 바꾸고, 그 밖의 색은 그대로 돌려준다.
 * 선·막대·캔들을 그릴 때는 쓰지 않는다.
 */
export const textColorOf = (style: ChartStyle, color: string): string =>
    color === style.upColor ? style.upTextColor ?? color
        : color === style.downColor ? style.downTextColor ?? color
        : color;

/** style.lineColors 의 order 번째 색. 모자라면 처음부터 돌려 쓴다. */
export const lineColor = (style: ChartStyle, order: number): string =>
    style.lineColors.length > 0 ? style.lineColors[order % style.lineColors.length] : style.textColor;
