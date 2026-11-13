import {Candle, ChartStyle, Drawing, DrawingTool, IndicatorConfig, PriceLine, TimeUnit} from "./types.ts";
import {movingAverage, Series} from "./indicators.ts";
import {DRAG_THRESHOLD, PRICE_AXIS_WIDTH} from "./constants.ts";
import {clamp, Layout, Point, View} from "./layout.ts";
import {clampView, defaultView, logicalAt, visibleRange, zoomedView} from "./viewport.ts";
import {candleColor, Painter} from "./painter.ts";
import {createIndicator, OverlayIndicator, PaneIndicator} from "./indicatorPanes.ts";
import {renderMain} from "./mainRenderer.ts";
import {drawCandleLegend, drawCrosshair, drawIndicatorLegends, drawOverlayLegends} from "./overlayRenderer.ts";
import {DrawingLayer} from "./drawingLayer.ts";

export {INDICATOR_PANE_HEIGHT} from "./constants.ts";

const LOAD_OLDER_THRESHOLD = 50;    // 화면 왼쪽 끝에서 받아 둔 첫 캔들까지 이만큼 이하로 남으면 과거 구간을 요청한다
const PINCH_DELTA_LIMIT = 30;   // 휠 한 번의 이동량이 이보다 작으면 트랙패드 두 손가락 벌리기로 본다
const WHEEL_ZOOM_RATE = 0.0015;
const PINCH_WHEEL_ZOOM_RATE = 0.01; // 트랙패드 두 손가락 벌리기 (ctrl + wheel 로 들어옴)
const WHEEL_LINE_HEIGHT = 16;

type Gesture =
    | { type: 'pan', startX: number, startRightEdge: number, moved: boolean }
    | { type: 'pinch', startDistance: number, startSpacing: number, anchor: number };  // anchor: 두 손가락 가운데의 순번

/**
 * Canvas 2D 캔들 차트 엔진. React 와 무관한 순수 TypeScript.
 * 캔버스 두 장을 겹친다: 아래(main)는 캔들·거래량·지표·축, 위(overlay)는 십자선·값 표시·그린 도형.
 * 마우스가 움직일 때는 위 장만 다시 그린다.
 *
 * 이 파일은 상태(캔들, 보기, 설정)와 입력, 그리는 순서만 맡는다. 실제 그리기는 역할별 파일에 있다:
 * mainRenderer(아래 장) · overlayRenderer(십자선·값 표시) · indicatorPanes(보조지표) · drawingLayer(그린 도형)
 * · viewport(이동·확대 계산) · painter(캔버스 공통 도구)
 */
export class CandleChartEngine {
    private readonly container: HTMLElement;
    private readonly mainCanvas: HTMLCanvasElement;
    private readonly overlayCanvas: HTMLCanvasElement;
    private readonly mainPainter: Painter;
    private readonly overlayPainter: Painter;

    private candles: Candle[] = [];
    private timeUnit: TimeUnit = 'day';
    private style: ChartStyle | null = null;
    private width = 0;      // CSS px
    private height = 0;     // CSS px
    private frame = 0;
    private overlayFrame = 0;
    private layout: Layout | null = null;   // 마지막으로 그린 배치
    private pointer: Point | null = null;   // 십자선 위치. 컨테이너 기준 (CSS px)
    private view: View | null = null;       // null 이면 기본 보기(최근 캔들을 오른쪽 끝에 맞춤)
    private gesture: Gesture | null = null;
    private readonly activePointers = new Map<number, Point>();    // 누르고 있는 포인터
    private editPointerId: number | null = null;    // 그리기·옮기기에 쓰이는 포인터. 이 포인터는 차트를 이동시키지 않는다
    private atLatest = true;

    private flatByPrevClose = false;
    private averagePeriods: number[] = [];
    private averages: Series[] = [];        // averagePeriods 와 같은 순서
    private indicatorConfigs: IndicatorConfig[] = [];
    // indicatorConfigs 를 계산해 그려지는 자리별로 나눈 것
    private paneIndicators: PaneIndicator[] = [];
    private priceOverlays: OverlayIndicator[] = [];
    private volumeOverlays: OverlayIndicator[] = [];
    private priceLines: PriceLine[] = [];

    /** 도형이 추가·변경·삭제되면 새 목록을 알린다. */
    onDrawingsChange: ((drawings: Drawing[]) => void) | null = null;
    /** 도형 하나를 다 그렸거나 취소해서 도구가 풀리면 알린다. */
    onToolChange: ((tool: DrawingTool | null) => void) | null = null;
    /** 선택한 도형이 바뀌면 알린다. */
    onSelectionChange: ((id: string | null) => void) | null = null;
    /** 가장 최근 캔들이 화면에 보이는지가 바뀌면 알린다. (최근으로 이동 버튼 표시용) */
    onLatestChange: ((atLatest: boolean) => void) | null = null;
    /**
     * 화면 왼쪽 끝이 받아 둔 캔들의 처음에 가까워지면 부른다. 가까운 동안 계속 부르므로,
     * 받는 쪽에서 이미 요청 중이거나 더 받을 것이 없으면 무시해야 한다.
     */
    onNeedOlder: (() => void) | null = null;

    private readonly drawingLayer = new DrawingLayer({
        layout: () => this.layout,
        candles: () => this.candles,
        redraw: () => this.scheduleOverlay(),
        refreshCursor: () => this.updateCursor(),
        drawingsChanged: drawings => this.onDrawingsChange?.(drawings),
        toolReleased: () => this.onToolChange?.(null),
        selectionChanged: id => this.onSelectionChange?.(id),
    });

    constructor(container: HTMLElement) {
        this.container = container;
        this.mainCanvas = this.createCanvas();
        this.overlayCanvas = this.createCanvas();
        const mainCtx = this.mainCanvas.getContext('2d');
        const overlayCtx = this.overlayCanvas.getContext('2d');
        if (!mainCtx || !overlayCtx) throw new Error('Canvas 2D 컨텍스트를 만들 수 없습니다.');
        this.mainPainter = new Painter(mainCtx);
        this.overlayPainter = new Painter(overlayCtx);

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

    // ---------- 바깥에서 부르는 것 ----------

    setData(candles: Candle[], timeUnit: TimeUnit) {
        // 과거 캔들이 앞에 붙으면 순번이 그만큼 밀린다. 사용자가 보던 자리가 그대로 있도록 보기도 같이 민다.
        // (사용자가 아직 움직이지 않았다면 기본 보기라서 최근 캔들 기준으로 다시 잡힌다.)
        const previous = this.candles;
        let prepended = 0;
        if (previous.length > 0 && candles.length > 0 && candles[0].time < previous[0].time) {
            const oldFirst = previous[0].time;
            while (prepended < candles.length && candles[prepended].time < oldFirst) prepended++;
        }
        if (this.view && prepended > 0) {
            this.view = {...this.view, rightEdge: this.view.rightEdge + prepended};
        }
        // 끌거나 벌리는 도중에 붙었다면, 그 동작이 기억해 둔 시작 위치도 같이 밀어야 한다.
        // 밀지 않으면 다음 움직임에서 옛 순번으로 되돌아가 화면이 맨 왼쪽으로 튄다.
        if (this.gesture && prepended > 0) {
            if (this.gesture.type === 'pan') this.gesture.startRightEdge += prepended;
            else this.gesture.anchor += prepended;
        }

        // 최근 캔들을 보고 있었다면 새 캔들이 붙어도 계속 최근을 보게 따라간다.
        const previousTotal = previous.length + prepended;
        if (this.view && previous.length > 0 && this.view.rightEdge >= previousTotal - 0.5) {
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

    /** 시가와 종가가 같은 캔들의 색을 전일 종가와 비교해 정할지 (국내 HTS 방식). 기본은 상승색 */
    setFlatByPrevClose(enabled: boolean) {
        this.flatByPrevClose = enabled;
        this.scheduleDraw();
    }

    /** 그릴 이동평균선의 기간들 (예: [5, 20, 60, 120]) */
    setMovingAverages(periods: number[]) {
        this.averagePeriods = periods;
        this.computeSeries();
        this.scheduleDraw();
    }

    /** 켤 보조지표와 설정값. 별도 영역 지표는 적은 순서대로 위에서 아래로 놓인다. */
    setIndicators(indicators: IndicatorConfig[]) {
        this.indicatorConfigs = indicators;
        this.computeSeries();
        this.scheduleDraw();
    }

    /** 사용자가 그린 도형 목록을 통째로 바꾼다. */
    setDrawings(drawings: Drawing[]) {
        this.drawingLayer.setDrawings(drawings);
    }

    /** 그리기 도구를 고른다. null 이면 선택·이동 상태로 돌아간다. */
    setTool(tool: DrawingTool | null) {
        this.drawingLayer.setTool(tool);
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
        const dpr = window.devicePixelRatio || 1;
        this.mainPainter.dpr = dpr;
        this.overlayPainter.dpr = dpr;
        [this.mainCanvas, this.overlayCanvas].forEach(canvas => {
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
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
        const instances = this.indicatorConfigs.map(config => createIndicator(config, this.candles));
        this.paneIndicators = instances.filter(instance => instance.placement === 'pane');
        const overlays = instances.filter((instance): instance is OverlayIndicator => instance.placement !== 'pane');
        this.priceOverlays = overlays.filter(overlay => overlay.placement === 'price');
        this.volumeOverlays = overlays.filter(overlay => overlay.placement === 'volume');
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
        if (this.activePointers.size === 0 && this.editPointerId === null && this.drawingLayer.beginEdit(point)) {
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
            this.drawingLayer.updateEdit(point);
            this.scheduleOverlay();
            return;
        }
        if (!this.activePointers.has(event.pointerId)) {
            // 누르지 않은 채 움직임: 십자선만 옮긴다. 추세선의 첫 점을 찍은 뒤라면 끝점이 따라온다.
            if (event.pointerType === 'touch') return;
            this.pointer = point;
            this.drawingLayer.hover(point);
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
            this.drawingLayer.finishEdit(this.localPoint(event));
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
        // 그냥 세로 휠은 페이지 스크롤에 맡긴다. 페이지를 내리다 차트가 의도치 않게 축소되는 것을 막는다.
        // 확대·축소는 Ctrl(Mac 은 ⌘)+휠 또는 트랙패드 두 손가락 벌리기, 이동은 트랙패드 가로 밀기.
        const zooming = event.ctrlKey || event.metaKey;
        const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
        if (!zooming && !horizontal) return;
        event.preventDefault();

        const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_HEIGHT
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? this.height
            : 1;
        const deltaX = event.deltaX * unit;
        const deltaY = event.deltaY * unit;
        const view = this.resolveView();

        if (!zooming) {
            // 트랙패드 가로 밀기: 이동
            this.setView({...view, rightEdge: view.rightEdge + deltaX / view.spacing});
        } else {
            // 마우스 위치를 기준으로 확대·축소. 두 손가락 벌리기는 이동량이 작게 들어와 더 민감하게 받는다.
            const rate = Math.abs(deltaY) < PINCH_DELTA_LIMIT ? PINCH_WHEEL_ZOOM_RATE : WHEEL_ZOOM_RATE;
            const x = clamp(this.localPoint(event).x, 0, this.plotWidth());
            this.zoomAt(view, x, logicalAt(view, this.plotWidth(), x), view.spacing * Math.exp(-deltaY * rate));
        }
    };

    private readonly handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            this.drawingLayer.cancel();
        } else if ((event.key === 'Delete' || event.key === 'Backspace') && this.drawingLayer.hasSelection) {
            event.preventDefault();
            this.drawingLayer.deleteSelected();
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
                anchor: logicalAt(view, this.plotWidth(), middle),
            };
        } else {
            this.gesture = null;
        }
        this.updateCursor();
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

    /** 상황에 맞는 마우스 커서: 끄는 중 / 도구 고름 / 도형 위 / 기본 */
    private updateCursor(hover?: Point) {
        this.container.style.cursor = this.gesture ? 'grabbing'
            : this.drawingLayer.activeTool ? 'crosshair'
            : hover && this.drawingLayer.isOver(hover) ? 'pointer'
            : '';
    }

    // ---------- 보기 상태 ----------

    private plotWidth(): number {
        return Math.max(1, this.width - PRICE_AXIS_WIDTH);
    }

    /** 지금 적용할 보기. 사용자가 움직인 적이 없으면 기본 보기를 계산한다. */
    private resolveView(): View {
        return this.view
            ? clampView(this.view, this.candles.length, this.plotWidth())
            : defaultView(this.candles.length, this.plotWidth());
    }

    private setView(view: View) {
        this.view = clampView(view, this.candles.length, this.plotWidth());
        this.scheduleDraw();
    }

    /** 순번 anchor 가 가로 위치 x 에 그대로 있도록 캔들 너비를 바꾼다. */
    private zoomAt(view: View, x: number, anchor: number, spacing: number) {
        this.setView(zoomedView(view, this.plotWidth(), x, anchor, spacing));
    }

    // ---------- 그리기 ----------

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

            // 받아 둔 캔들의 왼쪽 끝이 가까우면 과거 구간을 더 달라고 알린다.
            if (this.layout && this.layout.range.leftEdge < LOAD_OLDER_THRESHOLD) this.onNeedOlder?.();
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

    /** 아래 장 전체를 그리고, 그린 배치를 돌려준다. 그릴 것이 없으면 null */
    private drawMain(): Layout | null {
        this.mainPainter.ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        const style = this.style;
        if (!style || this.candles.length === 0) return null;

        return renderMain(this.mainPainter, {
            candles: this.candles,
            timeUnit: this.timeUnit,
            style,
            width: this.width,
            height: this.height,
            range: visibleRange(this.resolveView(), this.candles.length, this.plotWidth()),
            averages: this.averages,
            indicators: this.paneIndicators,
            priceOverlays: this.priceOverlays,
            volumeOverlays: this.volumeOverlays,
            priceLines: this.priceLines,
            flatByPrevClose: this.flatByPrevClose,
        });
    }

    /** 위 장: 그린 도형 → 십자선 → 값 표시 */
    private drawOverlay() {
        const painter = this.overlayPainter;
        painter.ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        const {layout, style} = this;
        if (!layout || !style) return;

        painter.useFont(style);
        this.drawingLayer.render(painter, layout, style);

        // 마우스가 가리키는 캔들이 없으면 가장 최근 캔들의 값을 보여 준다.
        const index = drawCrosshair(painter, layout, style, this.pointer, this.candles, this.timeUnit)
            ?? this.candles.length - 1;
        const candle = this.candles[index];
        if (candle) {
            drawCandleLegend(painter, layout, style, candle, candleColor(this.candles, index, style, this.flatByPrevClose));
        }
        drawOverlayLegends(painter, layout, style, this.averagePeriods, this.averages, index);
        drawIndicatorLegends(painter, layout, style, index);
    }
}
