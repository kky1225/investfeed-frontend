import {Candle, ChartStyle} from "./types.ts";
import {Series} from "./indicators.ts";
import {BODY_RATIO, FONT_SIZE, SERIES_LINE_WIDTH} from "./constants.ts";
import {isNumber, VisibleRange} from "./layout.ts";

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

    /** 지표 값을 선으로 잇는다. 화면 가장자리에서 끊겨 보이지 않게 양옆 한 칸씩 더 잇는다. */
    strokeSeries(values: Series, range: VisibleRange, toY: (value: number) => number, color: string) {
        const ctx = this.ctx;
        const start = Math.max(0, range.from - 1);
        const end = Math.min(values.length, range.from + range.count + 1);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, Math.round(SERIES_LINE_WIDTH * this.dpr));
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let started = false;
        for (let index = start; index < end; index++) {
            const value = values[index];
            if (!isNumber(value)) continue;
            const x = this.centerX(index, range);
            const y = toY(value) * this.dpr;
            if (started) {
                ctx.lineTo(x, y);
            } else {
                ctx.moveTo(x, y);
                started = true;
            }
        }
        ctx.stroke();
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

/** style.lineColors 의 order 번째 색. 모자라면 처음부터 돌려 쓴다. */
export const lineColor = (style: ChartStyle, order: number): string =>
    style.lineColors.length > 0 ? style.lineColors[order % style.lineColors.length] : style.textColor;
