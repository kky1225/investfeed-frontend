import {Anchor, Candle, ChartStyle, Drawing, DrawingTool, IndicatorType, PriceLine, TimeUnit} from "./types.ts";
import {createInverseScale, createLinearScale, formatPrice, formatTime, formatVolume, niceTicks} from "./scale.ts";
import {macd, MacdSeries, movingAverage, relativeStrength, Series} from "./indicators.ts";

/** 보조지표 영역 하나의 높이 (CSS px). 래퍼가 전체 높이를 정할 때 쓴다. */
export const INDICATOR_PANE_HEIGHT = 90;

// 배치 상수 (CSS px)
const PRICE_AXIS_WIDTH = 64;
const TIME_AXIS_HEIGHT = 24;
const PADDING_TOP = 8;
const PANE_GAP = 8;             // 가격 영역과 거래량 영역 사이
const VOLUME_RATIO = 0.22;      // 가격+거래량 높이 중 거래량 영역 비율
const DEFAULT_MIN_BAR_SPACING = 4;  // 처음 보여 줄 때 캔들 한 칸 최소 너비
const DEFAULT_MAX_BAR_SPACING = 16; // 처음 보여 줄 때 캔들 한 칸 최대 너비
const MIN_BAR_SPACING = 1;      // 축소 한계
const MAX_BAR_SPACING = 48;     // 확대 한계
const MIN_VISIBLE_BARS = 5;     // 끝까지 밀어도 화면에 남기는 캔들 수
const BODY_RATIO = 0.7;         // 한 칸 중 캔들 몸통이 차지하는 비율
const PRICE_TICK_GAP = 48;      // 가격 눈금 사이 최소 간격
const TIME_TICK_GAP = 96;       // 날짜 눈금 사이 최소 간격
const FONT_SIZE = 11;
const AXIS_LABEL_OFFSET = 6;
const CROSSHAIR_LABEL_HEIGHT = 18;
const CROSSHAIR_LABEL_PADDING = 6;
const CROSSHAIR_DASH = [4, 3];
const CURRENT_PRICE_DASH = [2, 2];
const PRICE_LINE_DASH = [6, 4];
const PRICE_LINE_TITLE_OFFSET = 8;  // 선과 그 위 이름 사이
const EXTREME_LABEL_GAP = 4;        // 최고·최저가 표시와 캔들 사이 (가로)
const EXTREME_LABEL_OFFSET = 8;     // 최고·최저가 표시와 캔들 끝 사이 (세로)
const SERIES_LINE_WIDTH = 1.5;  // 이동평균선·지표선 굵기
const LEGEND_LEFT = 8;
const LEGEND_HEIGHT = 18;
const LEGEND_GAP = 4;           // 이름과 값 사이
const LEGEND_ITEM_GAP = 10;     // 항목 사이
const INDICATOR_PADDING_BOTTOM = 6;
const HISTOGRAM_ALPHA = 0.5;
const DRAG_THRESHOLD = 3;       // 이만큼 움직여야 드래그로 본다
const WHEEL_ZOOM_RATE = 0.0015;
const PINCH_WHEEL_ZOOM_RATE = 0.01; // 트랙패드 두 손가락 벌리기 (ctrl + wheel 로 들어옴)
const WHEEL_LINE_HEIGHT = 16;

// 지표 설정
const RSI_PERIOD = 14;
const RSI_LEVELS = [70, 30];    // 과매수·과매도 기준선
const MACD_FAST = 12;
const MACD_SLOW = 26;
const MACD_SIGNAL = 9;

// 그리기 도구
const HIT_TOLERANCE = 6;        // 선에서 이만큼 안쪽을 누르면 그 선을 잡은 것으로 본다
const HANDLE_SIZE = 7;          // 선택한 추세선 양 끝의 손잡이 크기
const DRAFT_ID = 'draft';       // 그리는 중인 도형

// style.lineColors 안에서의 색 순서
const DRAWING_COLOR = 3;
const RSI_COLOR = 2;
const MACD_COLOR = 3;
const MACD_SIGNAL_COLOR = 1;

/**
 * 보기 상태. 가로축은 캔들 순번이고, rightEdge 는 그림 오른쪽 끝에 놓인 순번(소수 가능)이다.
 * rightEdge = 캔들 수 이면 마지막 캔들이 오른쪽 끝에 딱 붙는다.
 */
interface View {
    spacing: number,    // 캔들 한 칸 너비 (CSS px)
    rightEdge: number,
}

interface VisibleRange {
    from: number,       // 보이는 첫 캔들 순번
    count: number,      // 보이는 캔들 수
    spacing: number,
    leftEdge: number,   // 그림 왼쪽 끝에 놓인 순번(소수 가능)
}

/** 세로로 쌓인 영역 하나(가격·거래량·보조지표). 십자선이 마우스 높이를 값으로 바꿀 때 쓴다. (CSS px) */
interface Pane {
    top: number,            // 영역 범위
    bottom: number,
    scaleTop: number,       // max 가 놓이는 높이
    scaleBottom: number,    // min 이 놓이는 높이
    min: number,
    max: number,
    format: (value: number) => string,
}

/** 마지막으로 그린 화면의 배치. 십자선이 같은 좌표계를 쓰도록 남겨 둔다. (CSS px) */
interface Layout {
    range: VisibleRange,
    plotWidth: number,
    plotBottom: number,
    priceDecimals: number,
    panes: Pane[],
    indicators: { type: IndicatorType, top: number }[],
}

interface Point {
    x: number,
    y: number,
}

type Gesture =
    | { type: 'pan', startX: number, startRightEdge: number, moved: boolean }
    | { type: 'pinch', startDistance: number, startSpacing: number, anchor: number };  // anchor: 두 손가락 가운데의 순번

/** 그리는 중인 추세선. origin 은 첫 점을 누른 화면 위치 */
interface Draft {
    from: Anchor,
    to: Anchor,
    origin: Point,
}

/** 이미 그린 도형을 끌어 옮기는 중. part 는 잡은 부분(전체·시작점·끝점) */
interface Move {
    part: 'body' | 'from' | 'to',
    start: Point,
    original: Drawing,
    changed: boolean,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 점 p 에서 선분 a-b 까지의 거리 */
const distanceToSegment = (p: Point, a: Point, b: Point): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared, 0, 1);
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

const isNumber = (value: number | null | undefined): value is number => value !== null && value !== undefined;

const formatIndicator = (value: number | null | undefined): string =>
    isNumber(value) ? value.toLocaleString('ko-KR', {maximumFractionDigits: 2}) : '-';

/**
 * Canvas 2D 캔들 차트 엔진. React 와 무관한 순수 TypeScript.
 * 캔버스 두 장을 겹친다: 아래(main)는 캔들·거래량·지표·축, 위(overlay)는 십자선과 값 표시.
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
    private pointer: Point | null = null;   // 십자선 위치. 컨테이너 기준 (CSS px)
    private view: View | null = null;       // null 이면 기본 보기(최근 캔들을 오른쪽 끝에 맞춤)
    private gesture: Gesture | null = null;
    private readonly activePointers = new Map<number, Point>();    // 누르고 있는 포인터

    private averagePeriods: number[] = [];
    private averages: Series[] = [];        // averagePeriods 와 같은 순서
    private indicators: IndicatorType[] = [];
    private priceLines: PriceLine[] = [];
    private rsi: Series = [];

    // 그리기 도구
    private drawings: Drawing[] = [];
    private tool: DrawingTool | null = null;        // 고른 도구. null 이면 선택·이동 상태
    private selectedId: string | null = null;
    private draft: Draft | null = null;
    private move: Move | null = null;
    private editPointerId: number | null = null;    // 그리기·옮기기에 쓰이는 포인터. 이 포인터는 차트를 이동시키지 않는다

    /** 도형이 추가·변경·삭제되면 새 목록을 알린다. */
    onDrawingsChange: ((drawings: Drawing[]) => void) | null = null;
    /** 도형 하나를 다 그렸거나 취소해서 도구가 풀리면 알린다. */
    onToolChange: ((tool: DrawingTool | null) => void) | null = null;
    /** 선택한 도형이 바뀌면 알린다. */
    onSelectionChange: ((id: string | null) => void) | null = null;
    /** 가장 최근 캔들이 화면에 보이는지가 바뀌면 알린다. (최근으로 이동 버튼 표시용) */
    onLatestChange: ((atLatest: boolean) => void) | null = null;
    private atLatest = true;
    private macd: MacdSeries = {macd: [], signal: [], histogram: []};

    constructor(container: HTMLElement) {
        this.container = container;
        this.mainCanvas = this.createCanvas();
        this.overlayCanvas = this.createCanvas();
        const mainCtx = this.mainCanvas.getContext('2d');
        const overlayCtx = this.overlayCanvas.getContext('2d');
        if (!mainCtx || !overlayCtx) throw new Error('Canvas 2D 컨텍스트를 만들 수 없습니다.');
        this.mainCtx = mainCtx;
        this.overlayCtx = overlayCtx;

        // 세로 스크롤은 브라우저에 맡기고, 가로 드래그와 두 손가락 확대는 직접 처리한다.
        container.style.touchAction = 'pan-y';
        container.style.userSelect = 'none';
        // 선택한 도형을 Delete 키로 지울 수 있게 포커스를 받을 수 있도록 한다.
        container.tabIndex = -1;
        container.style.outline = 'none';
        container.addEventListener('keydown', this.handleKeyDown);
        container.addEventListener('pointerdown', this.handlePointerDown);
        container.addEventListener('pointermove', this.handlePointerMove);
        container.addEventListener('pointerup', this.handlePointerUp);
        container.addEventListener('pointercancel', this.handlePointerUp);
        container.addEventListener('pointerleave', this.handlePointerLeave);
        container.addEventListener('wheel', this.handleWheel, {passive: false});
    }

    setData(candles: Candle[], timeUnit: TimeUnit) {
        // 최근 캔들을 보고 있었다면 새 캔들이 붙어도 계속 최근을 보게 따라간다.
        const previousTotal = this.candles.length;
        if (this.view && previousTotal > 0 && this.view.rightEdge >= previousTotal - 0.5) {
            this.view = {...this.view, rightEdge: this.view.rightEdge + candles.length - previousTotal};
        }
        this.candles = candles;
        this.timeUnit = timeUnit;
        this.computeSeries();
        this.scheduleDraw();
    }

    setStyle(style: ChartStyle) {
        this.style = style;
        this.scheduleDraw();
    }

    /** 그릴 이동평균선의 기간들 (예: [5, 20, 60, 120]) */
    setMovingAverages(periods: number[]) {
        this.averagePeriods = periods;
        this.computeSeries();
        this.scheduleDraw();
    }

    /** 차트 아래에 쌓을 보조지표. 적은 순서대로 위에서 아래로 놓인다. */
    setIndicators(indicators: IndicatorType[]) {
        this.indicators = indicators;
        this.computeSeries();
        this.scheduleDraw();
    }

    /** 사용자가 그린 도형 목록을 통째로 바꾼다. */
    setDrawings(drawings: Drawing[]) {
        this.drawings = drawings;
        if (this.selectedId && !drawings.some(drawing => drawing.id === this.selectedId)) this.select(null);
        this.scheduleOverlay();
    }

    /** 그리기 도구를 고른다. null 이면 선택·이동 상태로 돌아간다. */
    setTool(tool: DrawingTool | null) {
        this.tool = tool;
        this.draft = null;
        if (tool) this.select(null);
        this.updateCursor();
        this.scheduleOverlay();
    }

    /** 특정 가격에 긋는 가로선들 (목표가 등). 가격축 범위 밖의 선은 그리지 않는다. */
    setPriceLines(priceLines: PriceLine[]) {
        this.priceLines = priceLines;
        this.scheduleDraw();
    }

    /** 확대 정도는 그대로 두고 가장 최근 캔들이 오른쪽 끝에 오도록 이동한다. */
    scrollToLatest() {
        const view = this.resolveView();
        this.setView({...view, rightEdge: Math.max(this.candles.length, this.plotWidth() / view.spacing)});
    }

    /** 드래그·확대한 상태를 버리고 기본 보기로 돌아간다. 다른 종목·주기로 바뀔 때 부른다. */
    resetView() {
        this.view = null;
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
        this.container.removeEventListener('keydown', this.handleKeyDown);
        this.container.removeEventListener('pointerdown', this.handlePointerDown);
        this.container.removeEventListener('pointermove', this.handlePointerMove);
        this.container.removeEventListener('pointerup', this.handlePointerUp);
        this.container.removeEventListener('pointercancel', this.handlePointerUp);
        this.container.removeEventListener('pointerleave', this.handlePointerLeave);
        this.container.removeEventListener('wheel', this.handleWheel);
        this.mainCanvas.remove();
        this.overlayCanvas.remove();
    }

    /** 캔들이나 지표 설정이 바뀌면 이동평균·보조지표 값을 다시 계산한다. */
    private computeSeries() {
        this.averages = this.averagePeriods.map(period => movingAverage(this.candles, period));
        if (this.indicators.includes('rsi')) {
            this.rsi = relativeStrength(this.candles, RSI_PERIOD);
        }
        if (this.indicators.includes('macd')) {
            this.macd = macd(this.candles, MACD_FAST, MACD_SLOW, MACD_SIGNAL);
        }
    }

    // ---------- 입력 ----------

    private localPoint(event: MouseEvent): Point {
        const rect = this.container.getBoundingClientRect();
        return {x: event.clientX - rect.left, y: event.clientY - rect.top};
    }

    private readonly handlePointerDown = (event: PointerEvent) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        const point = this.localPoint(event);
        this.container.focus({preventScroll: true});

        // 도구를 골랐거나 도형 위를 눌렀으면 그리기·옮기기로 처리하고, 차트는 이동시키지 않는다.
        if (this.activePointers.size === 0 && this.editPointerId === null && this.beginEdit(point)) {
            this.editPointerId = event.pointerId;
            this.container.setPointerCapture(event.pointerId);
            this.pointer = point;
            this.scheduleOverlay();
            return;
        }

        this.activePointers.set(event.pointerId, point);
        this.container.setPointerCapture(event.pointerId);
        this.beginGesture();
        // 터치는 누른 자리에 십자선을 띄운다. 움직이기 시작하면 지운다.
        this.pointer = this.activePointers.size === 1 ? point : null;
        this.scheduleOverlay();
    };

    private readonly handlePointerMove = (event: PointerEvent) => {
        const point = this.localPoint(event);
        if (event.pointerId === this.editPointerId) {
            this.pointer = point;
            this.updateEdit(point);
            this.scheduleOverlay();
            return;
        }
        if (!this.activePointers.has(event.pointerId)) {
            // 누르지 않은 채 움직임: 십자선만 옮긴다. 추세선의 첫 점을 찍은 뒤라면 끝점이 따라온다.
            if (event.pointerType === 'touch') return;
            this.pointer = point;
            if (this.draft) this.draft.to = this.anchorAt(point, true) ?? this.draft.to;
            this.updateCursor(point);
            this.scheduleOverlay();
            return;
        }

        this.activePointers.set(event.pointerId, point);
        const changed = this.applyGesture();
        if (event.pointerType !== 'touch') {
            this.pointer = point;
        } else if (changed) {
            this.pointer = null;
        }
        if (changed) this.scheduleDraw();
        else this.scheduleOverlay();
    };

    private readonly handlePointerUp = (event: PointerEvent) => {
        if (event.pointerId === this.editPointerId) {
            this.editPointerId = null;
            if (this.container.hasPointerCapture(event.pointerId)) {
                this.container.releasePointerCapture(event.pointerId);
            }
            this.finishEdit(this.localPoint(event));
            this.scheduleOverlay();
            return;
        }
        if (!this.activePointers.delete(event.pointerId)) return;
        if (this.container.hasPointerCapture(event.pointerId)) {
            this.container.releasePointerCapture(event.pointerId);
        }
        // 손가락 하나가 남았으면 그 자리에서 드래그를 이어 간다.
        this.beginGesture();
    };

    private readonly handlePointerLeave = (event: PointerEvent) => {
        // 터치는 손을 떼도 십자선을 남겨 값을 읽을 수 있게 한다.
        if (event.pointerType === 'touch') return;
        this.pointer = null;
        this.scheduleOverlay();
    };

    private readonly handleWheel = (event: WheelEvent) => {
        if (this.candles.length === 0) return;
        event.preventDefault();

        const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_HEIGHT
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? this.height
            : 1;
        const deltaX = event.deltaX * unit;
        const deltaY = event.deltaY * unit;
        const view = this.resolveView();

        if (!event.ctrlKey && Math.abs(deltaX) > Math.abs(deltaY)) {
            // 트랙패드 가로 밀기: 이동
            this.setView({...view, rightEdge: view.rightEdge + deltaX / view.spacing});
        } else {
            // 휠: 마우스 위치를 기준으로 확대·축소
            const rate = event.ctrlKey ? PINCH_WHEEL_ZOOM_RATE : WHEEL_ZOOM_RATE;
            const x = clamp(this.localPoint(event).x, 0, this.plotWidth());
            this.zoomAt(view, x, this.logicalAt(view, x), view.spacing * Math.exp(-deltaY * rate));
        }
    };

    /** 지금 누르고 있는 포인터 수에 맞춰 드래그(1개)·두 손가락 확대(2개)의 기준점을 다시 잡는다. */
    private beginGesture() {
        const points = [...this.activePointers.values()];
        const view = this.resolveView();
        if (points.length === 1) {
            this.gesture = {type: 'pan', startX: points[0].x, startRightEdge: view.rightEdge, moved: false};
        } else if (points.length === 2) {
            const middle = (points[0].x + points[1].x) / 2;
            this.gesture = {
                type: 'pinch',
                startDistance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
                startSpacing: view.spacing,
                anchor: this.logicalAt(view, middle),
            };
        } else {
            this.gesture = null;
        }
        this.updateCursor();
    }

    /** 상황에 맞는 마우스 커서: 끄는 중 / 도구 고름 / 도형 위 / 기본 */
    private updateCursor(hover?: Point) {
        this.container.style.cursor = this.gesture ? 'grabbing'
            : this.tool ? 'crosshair'
            : hover && this.hitTest(hover) ? 'pointer'
            : '';
    }

    private readonly handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            // 그리던 것을 취소하고, 그리는 중이 아니면 선택을 푼다.
            if (this.tool || this.draft) this.releaseTool();
            else this.select(null);
            this.scheduleOverlay();
        } else if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedId) {
            event.preventDefault();
            const selectedId = this.selectedId;
            this.select(null);
            this.changeDrawings(this.drawings.filter(drawing => drawing.id !== selectedId));
        }
    };

    // ---------- 그리기 도구 ----------

    private select(id: string | null) {
        if (this.selectedId === id) return;
        this.selectedId = id;
        this.onSelectionChange?.(id);
        this.scheduleOverlay();
    }

    private changeDrawings(drawings: Drawing[]) {
        this.drawings = drawings;
        this.onDrawingsChange?.(drawings);
        this.scheduleOverlay();
    }

    /** 도형 하나를 다 그렸거나 취소했을 때 도구를 푼다. */
    private releaseTool() {
        this.tool = null;
        this.draft = null;
        this.updateCursor();
        this.onToolChange?.(null);
    }

    private createId(): string {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    /** 시각이 time 인 캔들의 순번. 꼭 맞는 캔들이 없으면(주기가 바뀐 경우) 그 직전 캔들 */
    private timeToIndex(time: number): number {
        let low = 0;
        let high = this.candles.length - 1;
        while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            if (this.candles[middle].time <= time) low = middle;
            else high = middle - 1;
        }
        return low;
    }

    /**
     * 화면 위치를 캔들 시각·가격으로 바꾼다. 가로는 그 자리의 캔들에 붙인다.
     * 가격 영역 밖이면 null. clampToPane 이면 영역 안으로 끌어와 계산한다(끄는 중에 영역을 벗어났을 때).
     */
    private anchorAt(point: Point, clampToPane: boolean): Anchor | null {
        const layout = this.layout;
        const pane = layout?.panes[0];
        if (!layout || !pane || this.candles.length === 0) return null;
        const inside = point.x >= 0 && point.x < layout.plotWidth && point.y >= pane.top && point.y <= pane.bottom;
        if (!inside && !clampToPane) return null;
        const index = clamp(
            Math.floor(layout.range.leftEdge + point.x / layout.range.spacing),
            0, this.candles.length - 1,
        );
        const y = clamp(point.y, pane.top, pane.bottom);
        return {
            time: this.candles[index].time,
            price: createInverseScale(pane.min, pane.max, pane.scaleTop, pane.scaleBottom)(y),
        };
    }

    /** 캔들 시각·가격을 화면 위치(CSS px)로 바꾼다. */
    private anchorPoint(anchor: Anchor, layout: Layout): Point {
        const pane = layout.panes[0];
        return {
            x: (this.timeToIndex(anchor.time) + 0.5 - layout.range.leftEdge) * layout.range.spacing,
            y: createLinearScale(pane.min, pane.max, pane.scaleTop, pane.scaleBottom)(anchor.price),
        };
    }

    /** 화면 위치에 있는 도형과 잡힌 부분. 나중에 그린 도형이 먼저 잡힌다. */
    private hitTest(point: Point): { drawing: Drawing, part: Move['part'] } | null {
        const layout = this.layout;
        const pane = layout?.panes[0];
        if (!layout || !pane) return null;
        if (point.x < 0 || point.x >= layout.plotWidth || point.y < pane.top || point.y > pane.bottom) return null;

        for (let order = this.drawings.length - 1; order >= 0; order--) {
            const drawing = this.drawings[order];
            if (drawing.type === 'horizontal') {
                const y = createLinearScale(pane.min, pane.max, pane.scaleTop, pane.scaleBottom)(drawing.price);
                if (Math.abs(point.y - y) <= HIT_TOLERANCE) return {drawing, part: 'body'};
                continue;
            }
            const from = this.anchorPoint(drawing.from, layout);
            const to = this.anchorPoint(drawing.to, layout);
            if (Math.hypot(point.x - from.x, point.y - from.y) <= HIT_TOLERANCE + 2) return {drawing, part: 'from'};
            if (Math.hypot(point.x - to.x, point.y - to.y) <= HIT_TOLERANCE + 2) return {drawing, part: 'to'};
            if (distanceToSegment(point, from, to) <= HIT_TOLERANCE) return {drawing, part: 'body'};
        }
        return null;
    }

    /** 누른 자리에서 그리기나 옮기기를 시작한다. 시작했으면 true, 아니면(빈 곳) false 로 차트 이동에 넘긴다. */
    private beginEdit(point: Point): boolean {
        if (this.tool) {
            const anchor = this.anchorAt(point, false);
            if (!anchor) return false;
            if (this.tool === 'horizontal') {
                // 수평선은 누른 자리의 가격에 바로 긋는다.
                this.changeDrawings([...this.drawings, {id: this.createId(), type: 'horizontal', price: anchor.price}]);
                this.releaseTool();
            } else if (this.draft) {
                // 첫 점을 찍어 둔 상태: 이번에 누른 자리가 끝점
                this.draft.to = anchor;
            } else {
                this.draft = {from: anchor, to: anchor, origin: point};
            }
            return true;
        }

        const hit = this.hitTest(point);
        if (!hit) {
            this.select(null);
            return false;
        }
        this.select(hit.drawing.id);
        this.move = {part: hit.part, start: point, original: hit.drawing, changed: false};
        return true;
    }

    /** 누른 채 움직이는 동안: 그리는 추세선의 끝점을 옮기거나, 잡은 도형을 옮긴다. */
    private updateEdit(point: Point) {
        const target = this.anchorAt(point, true);
        if (!target) return;
        if (this.draft) {
            this.draft.to = target;
            return;
        }
        const move = this.move;
        if (!move) return;
        if (!move.changed && Math.hypot(point.x - move.start.x, point.y - move.start.y) < DRAG_THRESHOLD) return;

        const original = move.original;
        let next: Drawing;
        if (original.type === 'horizontal') {
            next = {...original, price: target.price};
        } else if (move.part === 'from') {
            next = {...original, from: target};
        } else if (move.part === 'to') {
            next = {...original, to: target};
        } else {
            // 선 전체: 잡은 자리에서 움직인 캔들 수·가격만큼 두 점을 같이 옮긴다.
            const start = this.anchorAt(move.start, true);
            if (!start) return;
            const indexDelta = this.timeToIndex(target.time) - this.timeToIndex(start.time);
            const priceDelta = target.price - start.price;
            const shift = (anchor: Anchor): Anchor => ({
                time: this.candles[clamp(this.timeToIndex(anchor.time) + indexDelta, 0, this.candles.length - 1)].time,
                price: anchor.price + priceDelta,
            });
            next = {...original, from: shift(original.from), to: shift(original.to)};
        }
        move.changed = true;
        this.drawings = this.drawings.map(drawing => drawing.id === next.id ? next : drawing);
    }

    /** 손을 뗐을 때: 추세선을 확정하거나, 옮긴 결과를 알린다. */
    private finishEdit(point: Point) {
        if (this.draft) {
            // 끌어서 그렸으면 바로 확정. 제자리에서 뗐으면 첫 점만 찍힌 상태로 두고 다음 누름을 끝점으로 받는다.
            const {from, to, origin} = this.draft;
            if (Math.hypot(point.x - origin.x, point.y - origin.y) >= DRAG_THRESHOLD) {
                this.changeDrawings([...this.drawings, {id: this.createId(), type: 'trend', from, to}]);
                this.releaseTool();
            }
            return;
        }
        if (this.move?.changed) this.onDrawingsChange?.(this.drawings);
        this.move = null;
    }

    /** 그린 도형들을 위 장에 그린다. 가격 영역 밖으로는 나가지 않는다. */
    private drawDrawings(layout: Layout, style: ChartStyle) {
        const drawings: Drawing[] = this.draft
            ? [...this.drawings, {id: DRAFT_ID, type: 'trend', from: this.draft.from, to: this.draft.to}]
            : this.drawings;
        if (drawings.length === 0) return;

        const ctx = this.overlayCtx;
        const pane = layout.panes[0];
        const toY = createLinearScale(pane.min, pane.max, pane.scaleTop, pane.scaleBottom);
        const color = this.lineColor(style, DRAWING_COLOR);
        const line = this.lineWidth();
        const plotRightPx = this.px(layout.plotWidth);
        const baseWidth = Math.max(1, Math.round(SERIES_LINE_WIDTH * this.dpr));
        const handle = this.px(HANDLE_SIZE);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, this.px(pane.top), plotRightPx, this.px(pane.bottom) - this.px(pane.top));
        ctx.clip();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        drawings.forEach(drawing => {
            const active = drawing.id === this.selectedId || drawing.id === DRAFT_ID;
            ctx.lineWidth = active ? baseWidth + line : baseWidth;
            ctx.beginPath();
            if (drawing.type === 'horizontal') {
                const y = this.px(toY(drawing.price)) + line / 2;
                ctx.moveTo(0, y);
                ctx.lineTo(plotRightPx, y);
                ctx.stroke();
                return;
            }
            const points = [this.anchorPoint(drawing.from, layout), this.anchorPoint(drawing.to, layout)]
                .map(point => ({x: point.x * this.dpr, y: point.y * this.dpr}));
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            ctx.stroke();
            // 선택했거나 그리는 중이면 양 끝에 손잡이
            if (active) {
                points.forEach(point => {
                    ctx.fillRect(Math.round(point.x - handle / 2), Math.round(point.y - handle / 2), handle, handle);
                });
            }
        });
        ctx.restore();

        // 수평선은 오른쪽 축에 가격 라벨을 붙인다.
        const labelHeight = this.px(CROSSHAIR_LABEL_HEIGHT);
        ctx.textAlign = 'left';
        ctx.lineWidth = line;
        drawings.forEach(drawing => {
            if (drawing.type !== 'horizontal' || drawing.price < pane.min || drawing.price > pane.max) return;
            const y = this.px(toY(drawing.price));
            const labelTop = Math.round(y - labelHeight / 2);
            ctx.fillStyle = style.backgroundColor;
            ctx.fillRect(plotRightPx, labelTop, this.px(PRICE_AXIS_WIDTH), labelHeight);
            ctx.strokeStyle = color;
            ctx.strokeRect(plotRightPx + line / 2, labelTop + line / 2, this.px(PRICE_AXIS_WIDTH) - line, labelHeight - line);
            ctx.fillStyle = color;
            ctx.fillText(pane.format(drawing.price), plotRightPx + this.px(AXIS_LABEL_OFFSET), y);
        });
    }

    /** 진행 중인 드래그·확대를 보기 상태에 반영한다. 보기가 바뀌었으면 true */
    private applyGesture(): boolean {
        const gesture = this.gesture;
        const points = [...this.activePointers.values()];
        if (!gesture) return false;

        if (gesture.type === 'pan' && points.length === 1) {
            const delta = points[0].x - gesture.startX;
            if (!gesture.moved && Math.abs(delta) < DRAG_THRESHOLD) return false;
            gesture.moved = true;
            const view = this.resolveView();
            this.setView({...view, rightEdge: gesture.startRightEdge - delta / view.spacing});
            return true;
        }
        if (gesture.type === 'pinch' && points.length === 2) {
            const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            const middle = (points[0].x + points[1].x) / 2;
            this.zoomAt(this.resolveView(), middle, gesture.anchor, gesture.startSpacing * distance / gesture.startDistance);
            return true;
        }
        return false;
    }

    // ---------- 보기 상태 ----------

    private plotWidth(): number {
        return Math.max(1, this.width - PRICE_AXIS_WIDTH);
    }

    /** 가로 위치 x 에 놓인 순번(소수) */
    private logicalAt(view: View, x: number): number {
        return view.rightEdge - (this.plotWidth() - x) / view.spacing;
    }

    /** 순번 anchor 가 가로 위치 x 에 그대로 있도록 캔들 너비를 바꾼다. */
    private zoomAt(view: View, x: number, anchor: number, spacing: number) {
        const next = clamp(spacing, MIN_BAR_SPACING, MAX_BAR_SPACING);
        this.setView({...view, spacing: next, rightEdge: anchor + (this.plotWidth() - x) / next});
    }

    private setView(view: View) {
        this.view = this.clampView(view);
        this.scheduleDraw();
    }

    /** 확대 한계를 지키고, 어느 쪽으로 밀어도 캔들이 몇 개는 화면에 남게 한다. */
    private clampView(view: View): View {
        const total = this.candles.length;
        const spacing = clamp(view.spacing, MIN_BAR_SPACING, MAX_BAR_SPACING);
        const bars = this.plotWidth() / spacing;
        const keep = Math.min(total, MIN_VISIBLE_BARS);
        return {spacing, rightEdge: clamp(view.rightEdge, keep, Math.max(keep, total + bars - keep))};
    }

    /** 지금 적용할 보기. 사용자가 움직인 적이 없으면 기본 보기를 계산한다. */
    private resolveView(): View {
        if (this.view) return this.clampView(this.view);
        // 기본: 최근 캔들을 오른쪽 끝에 맞춘다. 캔들이 적어 다 들어가면 왼쪽부터 채운다.
        const total = this.candles.length;
        const plotWidth = this.plotWidth();
        const spacing = clamp(plotWidth / Math.max(1, total), DEFAULT_MIN_BAR_SPACING, DEFAULT_MAX_BAR_SPACING);
        return {spacing, rightEdge: Math.max(total, plotWidth / spacing)};
    }

    private visibleRange(): VisibleRange {
        const view = this.resolveView();
        const leftEdge = view.rightEdge - this.plotWidth() / view.spacing;
        const from = Math.max(0, Math.floor(leftEdge));
        const to = Math.min(this.candles.length, Math.ceil(view.rightEdge));
        return {from, count: Math.max(0, to - from), spacing: view.spacing, leftEdge};
    }

    // ---------- 그리기 공통 ----------

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

            const atLatest = this.resolveView().rightEdge >= this.candles.length - 0.5;
            if (atLatest !== this.atLatest) {
                this.atLatest = atLatest;
                this.onLatestChange?.(atLatest);
            }
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

    /** 캔들 가운데의 가로 위치 (기기 픽셀). index 는 전체 캔들 기준 순번 */
    private centerX(index: number, range: VisibleRange): number {
        return this.px((index + 0.5 - range.leftEdge) * range.spacing);
    }

    /** 캔들 몸통·막대 너비 (기기 픽셀) */
    private bodyWidth(range: VisibleRange): number {
        return Math.max(1, this.px(range.spacing * BODY_RATIO));
    }

    private candleColor(candle: Candle, style: ChartStyle): string {
        return candle.close > candle.open ? style.upColor
            : candle.close < candle.open ? style.downColor
            : style.textColor;
    }

    private lineColor(style: ChartStyle, order: number): string {
        return style.lineColors.length > 0 ? style.lineColors[order % style.lineColors.length] : style.textColor;
    }

    /** 아래 장에서 그림 영역의 top~bottom 밖으로 나가지 않게 잘라 그린다. */
    private clipped(top: number, bottom: number, draw: () => void) {
        const ctx = this.mainCtx;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, this.px(top), this.px(this.width - PRICE_AXIS_WIDTH), this.px(bottom) - this.px(top));
        ctx.clip();
        draw();
        ctx.restore();
    }

    /** 지표 값을 선으로 잇는다. 화면 가장자리에서 끊겨 보이지 않게 양옆 한 칸씩 더 잇는다. */
    private strokeSeries(values: Series, range: VisibleRange, toY: (value: number) => number, color: string) {
        const ctx = this.mainCtx;
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

    // ---------- 아래 장: 캔들·거래량·지표·축 ----------

    /** 아래 장 전체를 그리고, 그린 배치를 돌려준다. 그릴 것이 없으면 null */
    private drawMain(): Layout | null {
        const ctx = this.mainCtx;
        const style = this.style;
        ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

        // 위에서부터: 가격 / 거래량 / 보조지표들 / 날짜축
        const plotWidth = this.width - PRICE_AXIS_WIDTH;
        const plotBottom = this.height - TIME_AXIS_HEIGHT;
        const mainBottom = plotBottom - this.indicators.length * INDICATOR_PANE_HEIGHT;
        const mainHeight = mainBottom - PADDING_TOP;
        if (!style || this.candles.length === 0 || plotWidth <= 0 || mainHeight <= 0) return null;

        const range = this.visibleRange();
        if (range.count === 0) return null;
        const visible = this.candles.slice(range.from, range.from + range.count);

        const volumeTop = mainBottom - mainHeight * VOLUME_RATIO;
        const priceTop = PADDING_TOP;
        const priceBottom = volumeTop - PANE_GAP;

        // 보이는 구간의 최고·최저가에 맞춰 가격축을 잡고, 위아래로 5% 여백을 둔다.
        // 이동평균선이 잘리지 않게 보이는 구간의 평균값도 범위에 넣는다.
        const visibleAverages = this.averages
            .flatMap(values => values.slice(range.from, range.from + range.count))
            .filter(isNumber);
        const highest = Math.max(...visible.map(candle => candle.high), ...visibleAverages);
        const lowest = Math.min(...visible.map(candle => candle.low), ...visibleAverages);
        const padding = (highest - lowest) * 0.05 || highest * 0.01 || 1;
        const priceMin = lowest - padding;
        const priceMax = highest + padding;
        const priceY = createLinearScale(priceMin, priceMax, priceTop, priceBottom);

        const volumeMax = Math.max(...visible.map(candle => candle.volume)) || 1;
        const volumeY = createLinearScale(0, volumeMax, volumeTop, mainBottom);

        const line = this.lineWidth();
        const plotRightPx = this.px(plotWidth);
        const plotBottomPx = this.px(plotBottom);
        const mainBottomPx = this.px(mainBottom);
        const axisLabelX = plotRightPx + this.px(AXIS_LABEL_OFFSET);

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
            ctx.fillText(formatPrice(value, priceTicks.decimals), axisLabelX, y);
        });

        // 거래량 눈금: 오른쪽 라벨만
        ctx.fillStyle = style.textColor;
        niceTicks(0, volumeMax, 2).values
            .filter(value => value > 0)
            .forEach(value => {
                ctx.fillText(formatVolume(value), axisLabelX, this.px(volumeY(value)));
            });

        // 날짜 눈금: 세로 격자 + 아래 라벨. 전체 순번 기준이라 보이는 구간이 바뀌어도 같은 캔들에 붙는다.
        const tickStep = Math.max(1, Math.ceil(TIME_TICK_GAP / range.spacing));
        ctx.textAlign = 'center';
        visible.forEach((candle, offset) => {
            const index = range.from + offset;
            if (index % tickStep !== 0) return;
            const x = this.centerX(index, range);
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

        // 캔들 + 거래량 + 이동평균선. 드래그로 반쯤 걸친 캔들이 축 영역으로 넘어가지 않게 자른다.
        this.clipped(0, mainBottom, () => {
            const bodyWidth = this.bodyWidth(range);
            visible.forEach((candle, offset) => {
                const x = this.centerX(range.from + offset, range);
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
                    const top = Math.min(this.px(volumeY(candle.volume)), mainBottomPx - 1);
                    ctx.fillRect(bodyLeft, top, bodyWidth, mainBottomPx - top);
                }
            });

            this.averages.forEach((values, order) => {
                this.strokeSeries(values, range, priceY, this.lineColor(style, order));
            });
        });

        // 보이는 구간의 최고가·최저가를 그 캔들 옆에 적는다. 오른쪽에 자리가 없으면 왼쪽에 적는다.
        const markExtreme = (offset: number, price: number, name: string, color: string, above: boolean) => {
            const x = this.centerX(range.from + offset, range);
            const label = `${name} ${price.toLocaleString('ko-KR')}`;
            const gap = this.px(EXTREME_LABEL_GAP);
            const toRight = x + gap + ctx.measureText(`← ${label}`).width <= plotRightPx;
            const half = this.px(FONT_SIZE) / 2;
            const y = clamp(
                this.px(priceY(price)) + (above ? -1 : 1) * this.px(EXTREME_LABEL_OFFSET),
                this.px(priceTop) + half,
                this.px(priceBottom) - half,
            );
            ctx.fillStyle = color;
            ctx.textAlign = toRight ? 'left' : 'right';
            ctx.fillText(toRight ? `← ${label}` : `${label} →`, toRight ? x + gap : x - gap, y);
        };
        const highOffset = visible.reduce((best, candle, offset) => candle.high > visible[best].high ? offset : best, 0);
        const lowOffset = visible.reduce((best, candle, offset) => candle.low < visible[best].low ? offset : best, 0);
        markExtreme(highOffset, visible[highOffset].high, '최고', style.upColor, true);
        markExtreme(lowOffset, visible[lowOffset].low, '최저', style.downColor, false);

        // 현재가 선: 마지막 캔들의 종가 높이에 점선을 긋고, 오른쪽 축에 캔들 색 라벨을 붙인다.
        // 과거로 이동해 현재가가 가격축 범위를 벗어나면 그리지 않는다.
        const last = this.candles[this.candles.length - 1];
        if (last.close >= priceMin && last.close <= priceMax) {
            const color = this.candleColor(last, style);
            const y = this.px(priceY(last.close));
            const labelHeight = this.px(CROSSHAIR_LABEL_HEIGHT);
            ctx.strokeStyle = color;
            ctx.lineWidth = line;
            ctx.setLineDash(CURRENT_PRICE_DASH.map(length => this.px(length)));
            ctx.beginPath();
            ctx.moveTo(0, y + line / 2);
            ctx.lineTo(plotRightPx, y + line / 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = color;
            ctx.fillRect(plotRightPx, Math.round(y - labelHeight / 2), this.px(PRICE_AXIS_WIDTH), labelHeight);
            ctx.fillStyle = style.backgroundColor;
            ctx.textAlign = 'left';
            ctx.fillText(last.close.toLocaleString('ko-KR'), axisLabelX, y);
        }

        // 가격선(목표가 등): 점선 + 선 위 이름 + 오른쪽 축에 테두리 라벨. 현재가 라벨(채움)과 구분된다.
        this.priceLines
            .filter(priceLine => priceLine.price >= priceMin && priceLine.price <= priceMax)
            .forEach(priceLine => {
                const color = priceLine.tone === 'up' ? style.upColor
                    : priceLine.tone === 'down' ? style.downColor
                    : style.textColor;
                const y = this.px(priceY(priceLine.price));
                const labelHeight = this.px(CROSSHAIR_LABEL_HEIGHT);
                const labelTop = Math.round(y - labelHeight / 2);
                ctx.strokeStyle = color;
                ctx.lineWidth = line;
                ctx.setLineDash(PRICE_LINE_DASH.map(length => this.px(length)));
                ctx.beginPath();
                ctx.moveTo(0, y + line / 2);
                ctx.lineTo(plotRightPx, y + line / 2);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = style.backgroundColor;
                ctx.fillRect(plotRightPx, labelTop, this.px(PRICE_AXIS_WIDTH), labelHeight);
                ctx.strokeRect(
                    plotRightPx + line / 2, labelTop + line / 2,
                    this.px(PRICE_AXIS_WIDTH) - line, labelHeight - line,
                );
                ctx.fillStyle = color;
                ctx.textAlign = 'left';
                ctx.fillText(priceLine.price.toLocaleString('ko-KR'), axisLabelX, y);
                ctx.fillText(priceLine.title, this.px(LEGEND_LEFT), y - this.px(PRICE_LINE_TITLE_OFFSET));
            });

        // 보조지표 영역
        const indicatorPanes = this.indicators.map((type, order) => {
            const top = mainBottom + order * INDICATOR_PANE_HEIGHT;
            return this.drawIndicator(type, top, top + INDICATOR_PANE_HEIGHT, range, style);
        });

        return {
            range, plotWidth, plotBottom,
            priceDecimals: priceTicks.decimals,
            panes: [
                {
                    top: priceTop, bottom: priceBottom, scaleTop: priceTop, scaleBottom: priceBottom,
                    min: priceMin, max: priceMax,
                    format: value => formatPrice(value, priceTicks.decimals),
                },
                {
                    top: volumeTop, bottom: mainBottom, scaleTop: volumeTop, scaleBottom: mainBottom,
                    min: 0, max: volumeMax,
                    format: value => formatVolume(Math.max(0, value)),
                },
                ...indicatorPanes,
            ],
            indicators: this.indicators.map((type, order) => ({type, top: mainBottom + order * INDICATOR_PANE_HEIGHT})),
        };
    }

    /** 보조지표 영역 하나를 그린다. 위쪽 한 줄은 값 표시(위 장)가 쓰도록 비워 둔다. */
    private drawIndicator(type: IndicatorType, top: number, bottom: number, range: VisibleRange, style: ChartStyle): Pane {
        const ctx = this.mainCtx;
        const line = this.lineWidth();
        const plotRightPx = this.px(this.width - PRICE_AXIS_WIDTH);
        const axisLabelX = plotRightPx + this.px(AXIS_LABEL_OFFSET);
        const scaleTop = top + LEGEND_HEIGHT;
        const scaleBottom = bottom - INDICATOR_PADDING_BOTTOM;

        // 위 영역과의 경계선
        ctx.fillStyle = style.gridColor;
        ctx.fillRect(0, this.px(top), plotRightPx, line);

        // 기준선 + 오른쪽 라벨
        ctx.textAlign = 'left';
        const guide = (y: number, label: string) => {
            ctx.fillStyle = style.gridColor;
            ctx.fillRect(0, this.px(y), plotRightPx, line);
            ctx.fillStyle = style.textColor;
            ctx.fillText(label, axisLabelX, this.px(y));
        };

        if (type === 'rsi') {
            const toY = createLinearScale(0, 100, scaleTop, scaleBottom);
            RSI_LEVELS.forEach(level => guide(toY(level), String(level)));
            this.clipped(top, bottom, () => {
                this.strokeSeries(this.rsi, range, toY, this.lineColor(style, RSI_COLOR));
            });
            return {top, bottom, scaleTop, scaleBottom, min: 0, max: 100, format: formatIndicator};
        }

        // MACD: 보이는 구간에서 0 을 가운데에 두고 위아래 같은 폭으로 잡는다.
        const {macd: macdLine, signal, histogram} = this.macd;
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

        this.clipped(top, bottom, () => {
            // 오실레이터 막대: 0 위는 상승색, 아래는 하락색
            const bodyWidth = this.bodyWidth(range);
            const zeroY = this.px(toY(0));
            ctx.globalAlpha = HISTOGRAM_ALPHA;
            for (let index = range.from; index < end; index++) {
                const value = histogram[index];
                if (!isNumber(value)) continue;
                const valueY = this.px(toY(value));
                ctx.fillStyle = value >= 0 ? style.upColor : style.downColor;
                ctx.fillRect(
                    this.centerX(index, range) - Math.floor(bodyWidth / 2),
                    Math.min(zeroY, valueY),
                    bodyWidth,
                    Math.max(1, Math.abs(valueY - zeroY)),
                );
            }
            ctx.globalAlpha = 1;

            this.strokeSeries(macdLine, range, toY, this.lineColor(style, MACD_COLOR));
            this.strokeSeries(signal, range, toY, this.lineColor(style, MACD_SIGNAL_COLOR));
        });
        return {top, bottom, scaleTop, scaleBottom, min: -extent, max: extent, format: formatIndicator};
    }

    // ---------- 위 장: 십자선·값 표시 ----------

    private drawOverlay() {
        const ctx = this.overlayCtx;
        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        const {layout, style} = this;
        if (!layout || !style) return;

        ctx.font = `${this.px(FONT_SIZE)}px ${style.fontFamily}`;
        ctx.textBaseline = 'middle';

        this.drawDrawings(layout, style);

        // 마우스가 가리키는 캔들이 없으면 가장 최근 캔들의 값을 보여 준다.
        const index = this.drawCrosshair(layout, style) ?? this.candles.length - 1;
        const candle = this.candles[index];
        if (candle) this.drawLegend(candle, style);
        this.drawAverageLegend(layout, style, index);
        this.drawIndicatorLegends(layout, style, index);
    }

    /** 한 줄에 여러 항목을 왼쪽부터 이어 적는다. */
    private writeLegendLine(middle: number, items: [string, string][]) {
        const ctx = this.overlayCtx;
        const itemGap = this.px(LEGEND_ITEM_GAP);
        let cursor = this.px(LEGEND_LEFT);
        ctx.textAlign = 'left';
        items.forEach(([text, color]) => {
            ctx.fillStyle = color;
            ctx.fillText(text, cursor, middle);
            cursor += ctx.measureText(text).width + itemGap;
        });
    }

    /** 이동평균 값을 값 표시 아랫줄에 선 색으로 적는다. */
    private drawAverageLegend(layout: Layout, style: ChartStyle, index: number) {
        if (this.averagePeriods.length === 0) return;
        const middle = this.px(PADDING_TOP + LEGEND_HEIGHT) + this.px(LEGEND_HEIGHT) / 2;
        this.writeLegendLine(middle, [
            ['이평', style.textColor],
            ...this.averagePeriods.map((period, order): [string, string] => {
                const value = this.averages[order]?.[index];
                return [
                    `${period} ${isNumber(value) ? formatPrice(value, layout.priceDecimals) : '-'}`,
                    this.lineColor(style, order),
                ];
            }),
        ]);
    }

    /** 보조지표 영역마다 왼쪽 위에 이름과 값을 적는다. */
    private drawIndicatorLegends(layout: Layout, style: ChartStyle, index: number) {
        layout.indicators.forEach(({type, top}) => {
            const middle = this.px(top) + this.px(LEGEND_HEIGHT) / 2 + this.lineWidth();
            if (type === 'rsi') {
                this.writeLegendLine(middle, [
                    [`RSI ${RSI_PERIOD}`, style.textColor],
                    [formatIndicator(this.rsi[index]), this.lineColor(style, RSI_COLOR)],
                ]);
                return;
            }
            const histogram = this.macd.histogram[index];
            this.writeLegendLine(middle, [
                [`MACD ${MACD_FAST}·${MACD_SLOW}·${MACD_SIGNAL}`, style.textColor],
                [`MACD ${formatIndicator(this.macd.macd[index])}`, this.lineColor(style, MACD_COLOR)],
                [`시그널 ${formatIndicator(this.macd.signal[index])}`, this.lineColor(style, MACD_SIGNAL_COLOR)],
                [
                    `오실레이터 ${formatIndicator(histogram)}`,
                    !isNumber(histogram) ? style.textColor : histogram >= 0 ? style.upColor : style.downColor,
                ],
            ]);
        });
    }

    /**
     * 십자선, 축 위의 값·날짜 라벨, 마우스가 가리키는 캔들의 값 표시.
     * 가리키는 캔들의 순번을 돌려주고, 없으면 null
     */
    private drawCrosshair(layout: Layout, style: ChartStyle): number | null {
        const ctx = this.overlayCtx;
        const pointer = this.pointer;
        if (!pointer) return null;

        const {range, plotBottom} = layout;
        const insidePlot = pointer.x >= 0 && pointer.x < layout.plotWidth
            && pointer.y >= 0 && pointer.y <= plotBottom;
        if (!insidePlot) return null;

        // 세로선은 마우스가 올라간 캔들의 가운데에 붙인다. 캔들이 없는 빈 자리면 그리지 않는다.
        const index = Math.floor(range.leftEdge + pointer.x / range.spacing);
        const candle = this.candles[index];
        if (!candle) return null;

        const line = this.lineWidth();
        const plotRightPx = this.px(layout.plotWidth);
        const plotBottomPx = this.px(plotBottom);
        const x = this.centerX(index, range) - Math.floor(line / 2) + line / 2;
        const y = this.px(pointer.y) + line / 2;

        ctx.strokeStyle = style.textColor;
        ctx.lineWidth = line;
        ctx.setLineDash(CROSSHAIR_DASH.map(length => this.px(length)));
        ctx.beginPath();
        if (x >= 0 && x <= plotRightPx) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, plotBottomPx);
        }
        ctx.moveTo(0, y);
        ctx.lineTo(plotRightPx, y);
        ctx.stroke();
        ctx.setLineDash([]);

        const labelHeight = this.px(CROSSHAIR_LABEL_HEIGHT);
        const labelPadding = this.px(CROSSHAIR_LABEL_PADDING);

        // 오른쪽 축 라벨: 마우스가 올라간 영역(가격·거래량·보조지표)의 값
        const pane = layout.panes.find(candidate => pointer.y >= candidate.top && pointer.y <= candidate.bottom);
        if (pane) {
            const value = createInverseScale(pane.min, pane.max, pane.scaleTop, pane.scaleBottom)(pointer.y);
            ctx.fillStyle = style.textColor;
            ctx.fillRect(plotRightPx, Math.round(y - labelHeight / 2), this.px(PRICE_AXIS_WIDTH), labelHeight);
            ctx.fillStyle = style.backgroundColor;
            ctx.textAlign = 'left';
            ctx.fillText(pane.format(value), plotRightPx + this.px(AXIS_LABEL_OFFSET), y);
        }

        // 아래 축 라벨: 캔들 날짜. 그림 영역 밖으로 나가지 않게 밀어 넣는다.
        const timeLabel = formatTime(candle.time, this.timeUnit);
        const timeWidth = ctx.measureText(timeLabel).width + labelPadding * 2;
        const timeLeft = Math.round(clamp(x - timeWidth / 2, 0, Math.max(0, plotRightPx - timeWidth)));
        const timeTop = plotBottomPx + line;
        ctx.fillStyle = style.textColor;
        ctx.fillRect(timeLeft, timeTop, timeWidth, labelHeight);
        ctx.fillStyle = style.backgroundColor;
        ctx.textAlign = 'center';
        ctx.fillText(timeLabel, timeLeft + timeWidth / 2, timeTop + labelHeight / 2);

        return index;
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
