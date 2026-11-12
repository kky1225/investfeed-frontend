import {Candle, ChartStyle, TimeUnit} from "./types.ts";
import {createInverseScale, createLinearScale, formatPrice, formatTime, formatVolume, niceTicks} from "./scale.ts";

// 배치 상수 (CSS px)
const PRICE_AXIS_WIDTH = 64;
const TIME_AXIS_HEIGHT = 24;
const PADDING_TOP = 8;
const PANE_GAP = 8;             // 가격 영역과 거래량 영역 사이
const VOLUME_RATIO = 0.22;      // 전체 그림 높이 중 거래량 영역 비율
const MIN_BAR_SPACING = 4;      // 캔들 한 칸 최소 너비
const MAX_BAR_SPACING = 16;     // 캔들 한 칸 최대 너비
const BODY_RATIO = 0.7;         // 한 칸 중 캔들 몸통이 차지하는 비율
const PRICE_TICK_GAP = 48;      // 가격 눈금 사이 최소 간격
const TIME_TICK_GAP = 96;       // 날짜 눈금 사이 최소 간격
const FONT_SIZE = 11;
const AXIS_LABEL_OFFSET = 6;
const CROSSHAIR_LABEL_HEIGHT = 18;
const CROSSHAIR_LABEL_PADDING = 6;
const CROSSHAIR_DASH = [4, 3];
const LEGEND_LEFT = 8;
const LEGEND_HEIGHT = 18;
const LEGEND_GAP = 4;           // 이름과 값 사이
const LEGEND_ITEM_GAP = 10;     // 항목 사이

interface VisibleRange {
    from: number,       // 보이는 첫 캔들 순번
    count: number,      // 보이는 캔들 수
    spacing: number,    // 캔들 한 칸 너비 (CSS px)
}

/** 마지막으로 그린 화면의 배치. 십자선이 같은 좌표계를 쓰도록 남겨 둔다. (CSS px) */
interface Layout {
    range: VisibleRange,
    plotWidth: number,
    plotBottom: number,
    priceTop: number,
    priceBottom: number,
    priceMin: number,
    priceMax: number,
    priceDecimals: number,
    volumeTop: number,
    volumeMax: number,
}

interface Point {
    x: number,
    y: number,
}

/**
 * Canvas 2D 캔들 차트 엔진. React 와 무관한 순수 TypeScript.
 * 캔버스 두 장을 겹친다: 아래(main)는 캔들·거래량·축, 위(overlay)는 십자선과 값 표시.
 * 마우스가 움직일 때는 위 장만 다시 그린다.
 * 좌표는 CSS px 로 계산한 뒤 px() 로 기기 픽셀에 맞춰 선이 흐려지지 않게 한다.
 */
export class CandleChartEngine {
    private readonly container: HTMLElement;
    private readonly mainCanvas: HTMLCanvasElement;
    private readonly overlayCanvas: HTMLCanvasElement;
    private readonly mainCtx: CanvasRenderingContext2D;
    private readonly overlayCtx: CanvasRenderingContext2D;

    private candles: Candle[] = [];
    private timeUnit: TimeUnit = 'day';
    private style: ChartStyle | null = null;
    private width = 0;      // CSS px
    private height = 0;     // CSS px
    private dpr = 1;
    private frame = 0;
    private overlayFrame = 0;
    private layout: Layout | null = null;
    private pointer: Point | null = null;   // 컨테이너 기준 마우스 위치 (CSS px)

    constructor(container: HTMLElement) {
        this.container = container;
        this.mainCanvas = this.createCanvas();
        this.overlayCanvas = this.createCanvas();
        const mainCtx = this.mainCanvas.getContext('2d');
        const overlayCtx = this.overlayCanvas.getContext('2d');
        if (!mainCtx || !overlayCtx) throw new Error('Canvas 2D 컨텍스트를 만들 수 없습니다.');
        this.mainCtx = mainCtx;
        this.overlayCtx = overlayCtx;
        container.addEventListener('pointermove', this.handlePointerMove);
        container.addEventListener('pointerleave', this.handlePointerLeave);
    }

    setData(candles: Candle[], timeUnit: TimeUnit) {
        this.candles = candles;
        this.timeUnit = timeUnit;
        this.scheduleDraw();
    }

    setStyle(style: ChartStyle) {
        this.style = style;
        this.scheduleDraw();
    }

    resize(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.dpr = window.devicePixelRatio || 1;
        [this.mainCanvas, this.overlayCanvas].forEach(canvas => {
            canvas.width = Math.round(width * this.dpr);
            canvas.height = Math.round(height * this.dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
        });
        this.scheduleDraw();
    }

    destroy() {
        if (this.frame) cancelAnimationFrame(this.frame);
        if (this.overlayFrame) cancelAnimationFrame(this.overlayFrame);
        this.frame = 0;
        this.overlayFrame = 0;
        this.container.removeEventListener('pointermove', this.handlePointerMove);
        this.container.removeEventListener('pointerleave', this.handlePointerLeave);
        this.mainCanvas.remove();
        this.overlayCanvas.remove();
    }

    private readonly handlePointerMove = (event: PointerEvent) => {
        const rect = this.container.getBoundingClientRect();
        this.pointer = {x: event.clientX - rect.left, y: event.clientY - rect.top};
        this.scheduleOverlay();
    };

    private readonly handlePointerLeave = () => {
        this.pointer = null;
        this.scheduleOverlay();
    };

    private createCanvas(): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.display = 'block';
        this.container.appendChild(canvas);
        return canvas;
    }

    /** 같은 프레임 안의 여러 변경을 한 번만 그린다. 전체를 그리면 십자선도 새 배치에 맞춰 다시 그린다. */
    private scheduleDraw() {
        if (this.frame) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = 0;
            this.layout = this.drawMain();
            this.drawOverlay();
        });
    }

    /** 마우스 이동은 위 장만 다시 그린다. */
    private scheduleOverlay() {
        if (this.overlayFrame || this.frame) return;
        this.overlayFrame = requestAnimationFrame(() => {
            this.overlayFrame = 0;
            this.drawOverlay();
        });
    }

    /** CSS px → 기기 픽셀(정수) */
    private px(value: number): number {
        return Math.round(value * this.dpr);
    }

    /** 선 굵기 (기기 픽셀) */
    private lineWidth(): number {
        return Math.max(1, Math.floor(this.dpr));
    }

    /** 캔들 가운데의 가로 위치 (기기 픽셀). index 는 보이는 구간 안의 순번 */
    private centerX(index: number, spacing: number): number {
        return this.px((index + 0.5) * spacing);
    }

    private candleColor(candle: Candle, style: ChartStyle): string {
        return candle.close > candle.open ? style.upColor
            : candle.close < candle.open ? style.downColor
            : style.textColor;
    }

    /** 최근 캔들을 오른쪽 끝에 맞춰, 그림 너비에 들어가는 만큼만 보여 준다. */
    private visibleRange(plotWidth: number): VisibleRange {
        const total = this.candles.length;
        const spacing = Math.min(MAX_BAR_SPACING, Math.max(MIN_BAR_SPACING, plotWidth / total));
        const count = Math.min(total, Math.floor(plotWidth / spacing));
        return {from: total - count, count, spacing};
    }

    /** 캔들·거래량·축을 그리고, 그린 배치를 돌려준다. 그릴 것이 없으면 null */
    private drawMain(): Layout | null {
        const ctx = this.mainCtx;
        const style = this.style;
        ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

        const plotWidth = this.width - PRICE_AXIS_WIDTH;
        const plotBottom = this.height - TIME_AXIS_HEIGHT;
        const plotHeight = plotBottom - PADDING_TOP;
        if (!style || this.candles.length === 0 || plotWidth <= 0 || plotHeight <= 0) return null;

        const range = this.visibleRange(plotWidth);
        if (range.count === 0) return null;
        const visible = this.candles.slice(range.from, range.from + range.count);

        const volumeTop = plotBottom - plotHeight * VOLUME_RATIO;
        const priceTop = PADDING_TOP;
        const priceBottom = volumeTop - PANE_GAP;

        // 보이는 구간의 최고·최저가에 맞춰 가격축을 잡고, 위아래로 5% 여백을 둔다.
        const highest = Math.max(...visible.map(candle => candle.high));
        const lowest = Math.min(...visible.map(candle => candle.low));
        const padding = (highest - lowest) * 0.05 || highest * 0.01 || 1;
        const priceMin = lowest - padding;
        const priceMax = highest + padding;
        const priceY = createLinearScale(priceMin, priceMax, priceTop, priceBottom);

        const volumeMax = Math.max(...visible.map(candle => candle.volume)) || 1;
        const volumeY = createLinearScale(0, volumeMax, volumeTop, plotBottom);

        const line = this.lineWidth();
        const plotRightPx = this.px(plotWidth);
        const plotBottomPx = this.px(plotBottom);

        ctx.font = `${this.px(FONT_SIZE)}px ${style.fontFamily}`;
        ctx.textBaseline = 'middle';

        // 가격 눈금: 가로 격자 + 오른쪽 라벨
        const priceTicks = niceTicks(priceMin, priceMax, Math.floor((priceBottom - priceTop) / PRICE_TICK_GAP));
        ctx.textAlign = 'left';
        priceTicks.values.forEach(value => {
            const y = this.px(priceY(value));
            ctx.fillStyle = style.gridColor;
            ctx.fillRect(0, y, plotRightPx, line);
            ctx.fillStyle = style.textColor;
            ctx.fillText(formatPrice(value, priceTicks.decimals), plotRightPx + this.px(AXIS_LABEL_OFFSET), y);
        });

        // 거래량 눈금: 오른쪽 라벨만
        ctx.fillStyle = style.textColor;
        niceTicks(0, volumeMax, 2).values
            .filter(value => value > 0)
            .forEach(value => {
                ctx.fillText(formatVolume(value), plotRightPx + this.px(AXIS_LABEL_OFFSET), this.px(volumeY(value)));
            });

        // 날짜 눈금: 세로 격자 + 아래 라벨. 전체 순번 기준이라 보이는 구간이 바뀌어도 같은 캔들에 붙는다.
        const tickStep = Math.max(1, Math.ceil(TIME_TICK_GAP / range.spacing));
        ctx.textAlign = 'center';
        visible.forEach((candle, index) => {
            if ((range.from + index) % tickStep !== 0) return;
            const x = this.centerX(index, range.spacing);
            const label = formatTime(candle.time, this.timeUnit);
            const half = ctx.measureText(label).width / 2;
            if (x - half < 0 || x + half > plotRightPx) return;
            ctx.fillStyle = style.gridColor;
            ctx.fillRect(x, 0, line, plotBottomPx);
            ctx.fillStyle = style.textColor;
            ctx.fillText(label, x, this.px(plotBottom + TIME_AXIS_HEIGHT / 2));
        });

        // 축 경계선
        ctx.fillStyle = style.gridColor;
        ctx.fillRect(plotRightPx, 0, line, plotBottomPx);
        ctx.fillRect(0, plotBottomPx, plotRightPx + line, line);
        ctx.fillRect(0, this.px(volumeTop - PANE_GAP / 2), plotRightPx, line);

        // 캔들 + 거래량
        const bodyWidth = Math.max(1, this.px(range.spacing * BODY_RATIO));
        visible.forEach((candle, index) => {
            const x = this.centerX(index, range.spacing);
            const bodyLeft = x - Math.floor(bodyWidth / 2);
            ctx.fillStyle = this.candleColor(candle, style);

            // 꼬리
            const highY = this.px(priceY(candle.high));
            const lowY = this.px(priceY(candle.low));
            ctx.fillRect(x - Math.floor(line / 2), highY, line, Math.max(1, lowY - highY));

            // 몸통 (시가 = 종가면 1픽셀 선)
            const openY = this.px(priceY(candle.open));
            const closeY = this.px(priceY(candle.close));
            const bodyTop = Math.min(openY, closeY);
            ctx.fillRect(bodyLeft, bodyTop, bodyWidth, Math.max(1, Math.abs(closeY - openY)));

            // 거래량
            if (candle.volume > 0) {
                const top = Math.min(this.px(volumeY(candle.volume)), plotBottomPx - 1);
                ctx.fillRect(bodyLeft, top, bodyWidth, plotBottomPx - top);
            }
        });

        return {
            range, plotWidth, plotBottom,
            priceTop, priceBottom, priceMin, priceMax, priceDecimals: priceTicks.decimals,
            volumeTop, volumeMax,
        };
    }

    /** 십자선, 축 위의 가격·날짜 라벨, 마우스가 가리키는 캔들의 값 표시 */
    private drawOverlay() {
        const ctx = this.overlayCtx;
        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        const {layout, style, pointer} = this;
        if (!layout || !style || !pointer) return;

        const {range, plotBottom} = layout;
        const insidePlot = pointer.x >= 0 && pointer.x < range.count * range.spacing
            && pointer.y >= 0 && pointer.y <= plotBottom;
        if (!insidePlot) return;

        // 세로선은 마우스가 올라간 캔들의 가운데에 붙인다.
        const index = Math.floor(pointer.x / range.spacing);
        const candle = this.candles[range.from + index];
        if (!candle) return;

        const line = this.lineWidth();
        const plotRightPx = this.px(layout.plotWidth);
        const plotBottomPx = this.px(plotBottom);
        const x = this.centerX(index, range.spacing) - Math.floor(line / 2) + line / 2;
        const y = this.px(pointer.y) + line / 2;

        ctx.strokeStyle = style.textColor;
        ctx.lineWidth = line;
        ctx.setLineDash(CROSSHAIR_DASH.map(length => this.px(length)));
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, plotBottomPx);
        ctx.moveTo(0, y);
        ctx.lineTo(plotRightPx, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = `${this.px(FONT_SIZE)}px ${style.fontFamily}`;
        ctx.textBaseline = 'middle';

        const labelHeight = this.px(CROSSHAIR_LABEL_HEIGHT);
        const labelPadding = this.px(CROSSHAIR_LABEL_PADDING);

        // 오른쪽 축 라벨: 가격 영역이면 가격, 거래량 영역이면 거래량
        const axisLabel = pointer.y >= layout.priceTop && pointer.y <= layout.priceBottom
            ? formatPrice(
                createInverseScale(layout.priceMin, layout.priceMax, layout.priceTop, layout.priceBottom)(pointer.y),
                layout.priceDecimals,
            )
            : pointer.y >= layout.volumeTop
                ? formatVolume(Math.max(0, createInverseScale(0, layout.volumeMax, layout.volumeTop, plotBottom)(pointer.y)))
                : null;
        if (axisLabel !== null) {
            ctx.fillStyle = style.textColor;
            ctx.fillRect(plotRightPx, Math.round(y - labelHeight / 2), this.px(PRICE_AXIS_WIDTH), labelHeight);
            ctx.fillStyle = style.backgroundColor;
            ctx.textAlign = 'left';
            ctx.fillText(axisLabel, plotRightPx + this.px(AXIS_LABEL_OFFSET), y);
        }

        // 아래 축 라벨: 캔들 날짜. 그림 영역 밖으로 나가지 않게 밀어 넣는다.
        const timeLabel = formatTime(candle.time, this.timeUnit);
        const timeWidth = ctx.measureText(timeLabel).width + labelPadding * 2;
        const timeLeft = Math.round(Math.min(Math.max(x - timeWidth / 2, 0), plotRightPx - timeWidth));
        const timeTop = plotBottomPx + line;
        ctx.fillStyle = style.textColor;
        ctx.fillRect(timeLeft, timeTop, timeWidth, labelHeight);
        ctx.fillStyle = style.backgroundColor;
        ctx.textAlign = 'center';
        ctx.fillText(timeLabel, timeLeft + timeWidth / 2, timeTop + labelHeight / 2);

        this.drawLegend(candle, style);
    }

    /** 왼쪽 위에 시가·고가·저가·종가·거래량을 한 줄로 표시한다. 값은 캔들 색을 따른다. */
    private drawLegend(candle: Candle, style: ChartStyle) {
        const ctx = this.overlayCtx;
        const items: [string, string][] = [
            ['시', candle.open.toLocaleString('ko-KR')],
            ['고', candle.high.toLocaleString('ko-KR')],
            ['저', candle.low.toLocaleString('ko-KR')],
            ['종', candle.close.toLocaleString('ko-KR')],
            ['거래량', candle.volume.toLocaleString('ko-KR')],
        ];
        const gap = this.px(LEGEND_GAP);
        const itemGap = this.px(LEGEND_ITEM_GAP);
        const widths = items.map(([name, value]) => [ctx.measureText(name).width, ctx.measureText(value).width]);
        const totalWidth = widths.reduce((sum, [nameWidth, valueWidth]) => sum + nameWidth + gap + valueWidth, 0)
            + itemGap * (items.length - 1);

        const left = this.px(LEGEND_LEFT);
        const top = this.px(PADDING_TOP);
        const height = this.px(LEGEND_HEIGHT);
        const padding = this.px(CROSSHAIR_LABEL_PADDING);

        // 캔들 위에 겹쳐도 읽히도록 바탕을 깐다.
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = style.backgroundColor;
        ctx.fillRect(left - padding, top, totalWidth + padding * 2, height);
        ctx.globalAlpha = 1;

        const valueColor = this.candleColor(candle, style);
        const middle = top + height / 2;
        ctx.textAlign = 'left';
        let cursor = left;
        items.forEach(([name, value], index) => {
            const [nameWidth, valueWidth] = widths[index];
            ctx.fillStyle = style.textColor;
            ctx.fillText(name, cursor, middle);
            ctx.fillStyle = valueColor;
            ctx.fillText(value, cursor + nameWidth + gap, middle);
            cursor += nameWidth + gap + valueWidth + itemGap;
        });
    }
}
