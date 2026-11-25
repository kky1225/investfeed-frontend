import {Candle, ChartStyle, TimeUnit} from "./types.ts";
import {AXIS_LABEL_OFFSET, PADDING_TOP} from "./constants.ts";
import {clamp, Point} from "./layout.ts";
import {Painter, watchPixelRatio} from "./painter.ts";
import {createLinearScale, decimalsOf, formatPrice, formatTime, niceTicks} from "./scale.ts";

/** 작은 차트가 가격을 그리는 방식 */
export type MiniChartMode = 'line' | 'candle';

/** 전체 흐름의 방향. 선의 색을 정한다 */
export type MiniChartTrend = 'up' | 'down' | 'neutral';

const BOTTOM_PADDING = 8;       // 그림 아래 여백 (CSS px)
const AXIS_GAP = 12;            // 가격축 글자 좌우 여백의 합
const TICK_GAP = 34;            // 가격 눈금 사이의 최소 간격 (CSS px)
const RANGE_PADDING = 0.06;     // 위아래로 더 잡는 범위 (전체 범위 대비)
const LINE_WIDTH = 1.5;         // 선 차트의 선 굵기 (CSS px)
const AREA_ALPHA = 0.18;        // 선 아래 채움의 진하기
const BODY_RATIO = 0.7;         // 한 칸 중 캔들 몸통이 차지하는 비율
const BASELINE_DASH = [4, 4];   // 기준선 점선 (CSS px)
const TOOLTIP_PADDING = 6;
const TOOLTIP_LINE_HEIGHT = 16;
const TOOLTIP_OFFSET = 12;      // 십자선과 값 상자 사이

/**
 * 목록 카드용 작은 차트. 받은 캔들을 전부 한 화면에 맞춰 그리고, 이동·확대·지표·그리기는 없다.
 * 선(아래를 옅게 채움) 또는 캔들로 그리고, 기준 가격에 점선을 긋고, 마우스를 올리면 그 칸의 값을 보여 준다.
 * 상세 화면의 CandleChartEngine 과 같은 색(ChartStyle)·같은 도구(Painter, scale)를 쓴다.
 */
export class MiniChartEngine {
    private readonly container: HTMLElement;
    private readonly canvas: HTMLCanvasElement;
    private readonly painter: Painter;

    private candles: Candle[] = [];
    private timeUnit: TimeUnit = 'minute';
    private mode: MiniChartMode = 'line';
    private trend: MiniChartTrend = 'neutral';
    private baseline: number | null = null;
    private style: ChartStyle | null = null;
    private width = 0;      // CSS px
    private height = 0;     // CSS px
    private frame = 0;
    private pointer: Point | null = null;
    private pixelShift = {x: 0, y: 0};  // 화면 픽셀에 맞추려고 캔버스를 왼쪽·위로 당긴 거리 (CSS px, 1픽셀 미만)
    private readonly stopWatchingPixelRatio: () => void;    // 화면 배율 감시를 끝낸다 (watchPixelRatio)

    constructor(container: HTMLElement) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.canvas.style.display = 'block';
        // 화면 픽셀에 맞추려고 1픽셀 미만 당길 때(alignToPixels) 둘레 배치는 그대로 두도록 제자리 기준으로 옮긴다.
        this.canvas.style.position = 'relative';
        container.appendChild(this.canvas);
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D 컨텍스트를 만들 수 없습니다.');
        this.painter = new Painter(ctx);
        container.addEventListener('pointermove', this.handlePointerMove);
        container.addEventListener('pointerleave', this.handlePointerLeave);
        window.addEventListener('scroll', this.handleScroll, {capture: true, passive: true});
        this.stopWatchingPixelRatio = watchPixelRatio(this.handlePixelRatioChange);
    }

    setData(candles: Candle[], timeUnit: TimeUnit) {
        this.candles = candles;
        this.timeUnit = timeUnit;
        this.scheduleDraw();
    }

    setMode(mode: MiniChartMode) {
        this.mode = mode;
        this.scheduleDraw();
    }

    /** 선 차트의 색을 정하는 흐름 방향 (오르면 상승색, 내리면 하락색) */
    setTrend(trend: MiniChartTrend) {
        this.trend = trend;
        this.scheduleDraw();
    }

    /** 점선으로 긋는 기준 가격 (시가 등). null 이면 긋지 않는다 */
    setBaseline(price: number | null) {
        this.baseline = price;
        this.scheduleDraw();
    }

    setStyle(style: ChartStyle) {
        this.style = style;
        this.scheduleDraw();
    }

    resize(width: number, height: number) {
        const dpr = window.devicePixelRatio || 1;
        this.alignToPixels(dpr);
        if (width === this.width && height === this.height && dpr === this.painter.dpr) return;
        this.width = width;
        this.height = height;
        this.painter.dpr = dpr;
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        // 표시 크기를 캔버스 픽셀 수에 딱 맞춘다. 너비가 소수면 그대로 두었을 때 살짝 늘어나 흐려진다.
        this.canvas.style.width = `${this.canvas.width / dpr}px`;
        this.canvas.style.height = `${this.canvas.height / dpr}px`;
        // 캔버스는 크기를 바꾸면 지워진다. 빈 화면이 보이지 않게 바로 그린다.
        this.draw();
    }

    /**
     * 캔버스를 화면 픽셀 경계에 맞춰 놓는다. 차트가 반 픽셀 같은 자리에서 시작하면 선과 글자가 흐려지므로
     * 시작 위치의 소수 부분만큼 왼쪽·위로 당긴다(1픽셀 미만). 상세 차트(CandleChartEngine.alignToPixels)와 같은 방식이다.
     */
    private alignToPixels(dpr: number) {
        const rect = this.container.getBoundingClientRect();
        const fraction = (value: number) => {
            const scaled = value * dpr;
            return (scaled - Math.floor(scaled)) / dpr;
        };
        const x = fraction(rect.left);
        const y = fraction(rect.top);
        if (x === this.pixelShift.x && y === this.pixelShift.y) return;
        this.pixelShift = {x, y};
        this.canvas.style.left = `${-x}px`;
        this.canvas.style.top = `${-y}px`;
    }

    /** 크기는 그대로인데 위치만 바뀌는 경우(배율이 정수가 아닌 화면에서의 스크롤 등)에도 정렬을 다시 맞춘다. */
    private readonly handleScroll = () => {
        if (this.width > 0) this.alignToPixels(this.painter.dpr);
    };

    /** 화면 배율이 바뀌면 캔버스를 그 배율에 맞춘다. 아직 크기를 받지 못했으면(처음 그리기 전) 크기를 받을 때 맞춘다. */
    private readonly handlePixelRatioChange = () => {
        if (this.width > 0 && this.height > 0) this.resize(this.width, this.height);
    };

    destroy() {
        this.stopWatchingPixelRatio();
        if (this.frame) cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.container.removeEventListener('pointermove', this.handlePointerMove);
        this.container.removeEventListener('pointerleave', this.handlePointerLeave);
        window.removeEventListener('scroll', this.handleScroll, {capture: true});
        this.canvas.remove();
    }

    private readonly handlePointerMove = (event: PointerEvent) => {
        // 그림의 원점은 캔버스를 당긴 만큼(pixelShift) 컨테이너보다 왼쪽·위에 있다.
        const rect = this.container.getBoundingClientRect();
        this.pointer = {x: event.clientX - rect.left + this.pixelShift.x, y: event.clientY - rect.top + this.pixelShift.y};
        this.scheduleDraw();
    };

    private readonly handlePointerLeave = () => {
        this.pointer = null;
        this.scheduleDraw();
    };

    private scheduleDraw() {
        if (this.frame) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = 0;
            this.draw();
        });
    }

    /**
     * 실제로 그릴 모양. 캔들을 골랐어도 받은 값에 고가·저가가 없으면(모든 칸이 한 점) 선으로 그린다.
     * 점만 찍힌 차트보다 선이 읽기 쉽다.
     */
    private effectiveMode(): MiniChartMode {
        if (this.mode === 'candle' && this.candles.every(candle => candle.high === candle.low)) return 'line';
        return this.mode;
    }

    private draw() {
        const {painter, style, candles, width, height} = this;
        const ctx = painter.ctx;
        // 위쪽 내용의 높이가 바뀌어 크기 변화 없이 밀린 경우도 그릴 때 다시 맞춘다.
        if (width > 0) this.alignToPixels(painter.dpr);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!style || width <= 0 || height <= 0 || candles.length === 0) return;
        const mode = this.effectiveMode();

        // 가격 범위: 선이면 종가, 캔들이면 고가·저가. 기준선도 범위에 넣어 늘 보이게 한다.
        const highs = candles.map(candle => (mode === 'candle' ? candle.high : candle.close));
        const lows = candles.map(candle => (mode === 'candle' ? candle.low : candle.close));
        const included = this.baseline === null ? [] : [this.baseline];
        const dataMax = Math.max(...highs, ...included);
        const dataMin = Math.min(...lows, ...included);
        const padding = (dataMax - dataMin || Math.abs(dataMax) * 0.01 || 1) * RANGE_PADDING;
        const max = dataMax + padding;
        const min = dataMin - padding;

        const top = PADDING_TOP;
        const bottom = height - BOTTOM_PADDING;
        const ticks = niceTicks(min, max, Math.max(2, Math.floor((bottom - top) / TICK_GAP)));
        const decimals = Math.max(ticks.decimals, ...candles.slice(-20).map(candle => decimalsOf(candle.close)));
        const labelDecimals = ticks.decimals;

        // 가격축 너비는 가장 긴 눈금 글자에 맞춘다.
        painter.useFont(style);
        const labels = ticks.values.map(value => formatPrice(value, labelDecimals));
        const widest = Math.max(0, ...labels.map(label => ctx.measureText(label).width / painter.dpr));
        const axisWidth = Math.ceil(widest) + AXIS_GAP;
        const plotWidth = Math.max(1, width - axisWidth);
        const toY = createLinearScale(min, max, top, bottom);
        const spacing = plotWidth / candles.length;
        const centerX = (index: number) => (index + 0.5) * spacing;

        // 격자와 가격 눈금
        ctx.lineWidth = painter.lineWidth();
        ctx.strokeStyle = style.gridColor;
        ctx.fillStyle = style.textColor;
        ctx.textAlign = 'left';
        ticks.values.forEach((value, order) => {
            const y = painter.px(toY(value)) + 0.5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(painter.px(plotWidth), y);
            ctx.stroke();
            ctx.fillText(labels[order], painter.px(plotWidth + AXIS_LABEL_OFFSET), y);
        });

        if (mode === 'candle') this.drawCandles(centerX, toY, spacing);
        else this.drawLine(centerX, toY, bottom);

        if (this.baseline !== null) {
            const y = painter.px(toY(this.baseline)) + 0.5;
            ctx.save();
            ctx.strokeStyle = style.textColor;
            ctx.setLineDash(BASELINE_DASH.map(length => painter.px(length)));
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(painter.px(plotWidth), y);
            ctx.stroke();
            ctx.restore();
        }

        this.drawHover(mode, centerX, toY, spacing, plotWidth, top, bottom, decimals);
    }

    private drawLine(centerX: (index: number) => number, toY: (value: number) => number, bottom: number) {
        const {painter, style, candles} = this;
        if (!style) return;
        const ctx = painter.ctx;
        const color = this.trend === 'up' ? style.upColor : this.trend === 'down' ? style.downColor : style.textColor;

        ctx.beginPath();
        candles.forEach((candle, index) => {
            const x = painter.px(centerX(index));
            const y = painter.px(toY(candle.close));
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = painter.px(LINE_WIDTH);
        ctx.lineJoin = 'round';
        ctx.stroke();

        // 선 아래를 옅게 채운다.
        ctx.lineTo(painter.px(centerX(candles.length - 1)), painter.px(bottom));
        ctx.lineTo(painter.px(centerX(0)), painter.px(bottom));
        ctx.closePath();
        ctx.save();
        ctx.globalAlpha = AREA_ALPHA;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }

    private drawCandles(centerX: (index: number) => number, toY: (value: number) => number, spacing: number) {
        const {painter, style, candles} = this;
        if (!style) return;
        const ctx = painter.ctx;
        const bodyWidth = Math.max(1, painter.px(spacing * BODY_RATIO));
        const wickWidth = painter.lineWidth();

        candles.forEach((candle, index) => {
            const color = candle.close > candle.open ? style.upColor
                : candle.close < candle.open ? style.downColor : style.textColor;
            const x = painter.px(centerX(index));
            const high = painter.px(toY(candle.high));
            const low = painter.px(toY(candle.low));
            const open = painter.px(toY(candle.open));
            const close = painter.px(toY(candle.close));
            ctx.fillStyle = color;
            ctx.fillRect(x - Math.floor(wickWidth / 2), high, wickWidth, Math.max(1, low - high));
            const bodyTop = Math.min(open, close);
            ctx.fillRect(x - Math.floor(bodyWidth / 2), bodyTop, bodyWidth, Math.max(1, Math.abs(close - open)));
        });
    }

    /** 마우스가 올라간 칸에 세로선을 긋고 그 칸의 시각과 값을 상자에 적는다. */
    private drawHover(
        mode: MiniChartMode, centerX: (index: number) => number, toY: (value: number) => number, spacing: number,
        plotWidth: number, top: number, bottom: number, decimals: number,
    ) {
        const {painter, style, candles, pointer} = this;
        if (!style || !pointer || pointer.x < 0 || pointer.x > plotWidth) return;
        const ctx = painter.ctx;
        const index = clamp(Math.floor(pointer.x / spacing), 0, candles.length - 1);
        const candle = candles[index];
        const x = painter.px(centerX(index)) + 0.5;

        ctx.strokeStyle = style.textColor;
        ctx.lineWidth = painter.lineWidth();
        ctx.beginPath();
        ctx.moveTo(x, painter.px(top));
        ctx.lineTo(x, painter.px(bottom));
        ctx.stroke();

        // 선 차트면 그 칸의 값 자리에 점을 찍는다.
        if (mode === 'line') {
            ctx.fillStyle = style.textColor;
            ctx.beginPath();
            ctx.arc(x, painter.px(toY(candle.close)), painter.px(3), 0, Math.PI * 2);
            ctx.fill();
        }

        const price = (value: number) => formatPrice(value, decimals);
        const lines = mode === 'candle'
            ? [
                formatTime(candle.time, this.timeUnit, true),
                `시 ${price(candle.open)}  고 ${price(candle.high)}`,
                `저 ${price(candle.low)}  종 ${price(candle.close)}`,
            ]
            : [formatTime(candle.time, this.timeUnit, true), price(candle.close)];

        painter.useFont(style);
        const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width / painter.dpr));
        const boxWidth = textWidth + TOOLTIP_PADDING * 2;
        const boxHeight = lines.length * TOOLTIP_LINE_HEIGHT + TOOLTIP_PADDING;
        // 상자는 십자선 오른쪽에 두고, 자리가 없으면 왼쪽으로 넘긴다.
        const anchor = centerX(index);
        const left = anchor + TOOLTIP_OFFSET + boxWidth <= plotWidth
            ? anchor + TOOLTIP_OFFSET
            : Math.max(0, anchor - TOOLTIP_OFFSET - boxWidth);
        const boxTop = top;

        ctx.fillStyle = style.backgroundColor;
        ctx.strokeStyle = style.gridColor;
        ctx.beginPath();
        ctx.rect(painter.px(left) + 0.5, painter.px(boxTop) + 0.5, painter.px(boxWidth), painter.px(boxHeight));
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = style.textColor;
        ctx.textAlign = 'left';
        lines.forEach((line, order) => {
            ctx.fillText(
                line,
                painter.px(left + TOOLTIP_PADDING),
                painter.px(boxTop + TOOLTIP_PADDING / 2 + TOOLTIP_LINE_HEIGHT * (order + 0.5)),
            );
        });
    }
}
