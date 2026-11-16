import {
    Anchor, Candle, ChartStyle, ChartType, Comparison, ContextMenuRequest, Drawing, DrawingStyle, DrawingTool, IndicatorConfig, IndicatorType, MagnetMode,
    CandleInterval, PaneResize, PaneSizes, PriceLine, TextRequest, TimeUnit,
} from "./types.ts";
import {bucketEnd} from "./realtime.ts";
import {heikinAshi, movingAverage, Series} from "./indicators.ts";
import {
    AXIS_LABEL_OFFSET, DRAG_THRESHOLD, INDICATOR_HEIGHT_LIMIT, INDICATOR_PANE_HEIGHT, MAIN_HEIGHT_LIMIT, PRICE_AXIS_WIDTH,
    PRICE_PANE_TOP, TIME_AXIS_HEIGHT, VOLUME_RATIO, VOLUME_RATIO_LIMIT,
} from "./constants.ts";
import {decimalsOf, formatCountdown, formatPercent, formatPrice} from "./scale.ts";
import {alignCloses, ComparisonAlign, comparisonPercent} from "./comparison.ts";
import {clamp, isNumber, Layout, paneToValue, Point, View} from "./layout.ts";
import {clampView, defaultView, logicalAt, visibleRange, zoomedView} from "./viewport.ts";
import {candleColor, lineColor, Painter} from "./painter.ts";
import {createIndicator, LegendItem, OverlayIndicator, PaneIndicator} from "./indicatorPanes.ts";
import {PANE_GAP, renderMain} from "./mainRenderer.ts";
import {drawCandleLegend, drawCrosshair, drawIndicatorLegends, drawOverlayLegends} from "./overlayRenderer.ts";
import {DrawingLayer} from "./drawingLayer.ts";

export {INDICATOR_HEIGHT_LIMIT, INDICATOR_PANE_HEIGHT, MAIN_HEIGHT_LIMIT, VOLUME_RATIO_LIMIT} from "./constants.ts";

const COMPARISON_PERCENT_DECIMALS = 2;  // 값 표시에 적는 비교 종목 등락률의 소수 자릿수
const LOAD_OLDER_THRESHOLD = 50;   // 화면 왼쪽 끝에서 받아 둔 첫 캔들까지 이만큼 이하로 남으면 과거 구간을 요청한다
const PINCH_DELTA_LIMIT = 30;   // 휠 한 번의 이동량이 이보다 작으면 트랙패드 두 손가락 벌리기로 본다
const WHEEL_ZOOM_RATE = 0.0015;
const PINCH_WHEEL_ZOOM_RATE = 0.01; // 트랙패드 두 손가락 벌리기 (ctrl + wheel 로 들어옴)
const WHEEL_LINE_HEIGHT = 16;
const DECIMAL_SAMPLE_SIZE = 300;    // 가격의 소수 자릿수를 알아낼 때 살펴보는 최근 캔들 수
// 가격축을 끌어 세로 배율을 바꿀 때: 1px 에 이 비율만큼, 아래 범위 안에서
const PRICE_ZOOM_RATE = 0.005;
const MIN_PRICE_ZOOM = 0.2;
const MAX_PRICE_ZOOM = 10;
// 영역 사이의 경계를 잡을 수 있는 거리 (경계선의 위아래로, CSS px). 손가락은 넓게 잡는다
const BOUNDARY_REACH = 4;
const BOUNDARY_TOUCH_REACH = 12;
const RATIO_STEPS = 1000;   // 거래량 영역의 비율을 소수 셋째 자리까지만 다룬다
const MINUTE_MS = 60_000;
// 우클릭한 자리가 떠 있는 십자선에서 이 거리 안이면 십자선의 자리를 누른 것으로 본다 (CSS px)
const CROSSHAIR_KEEP_DISTANCE = 24;
// 키보드 조작: 화살표 한 번에 옮기는 캔들 수(Shift 를 누르면 크게), +/- 한 번에 바뀌는 캔들 너비의 비율
const KEY_STEP = 1;
const KEY_LARGE_STEP = 10;
const KEY_ZOOM_RATIO = 1.2;
// 이 안에 포커스가 있으면 키보드 조작을 하지 않는다 (글자 입력, 열려 있는 창·메뉴)
const KEY_IGNORED_TARGETS = 'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]';
const COUNTDOWN_CHECK_MS = 250;    // 남은 시간의 글자가 바뀌었는지 살피는 간격. 1초보다 짧게 잡아 초가 건너뛰지 않게 한다

/** Ctrl(Mac 은 ⌘)을 누른 채 그리거나 고치는 중인지. 그동안은 자석이 반대로 동작한다. */
const invertsMagnet = (event: PointerEvent): boolean => event.ctrlKey || event.metaKey;

/** 영역 사이의 경계 하나. start 는 끌기 시작할 때의 크기(거래량이면 비율, 그 밖에는 높이) */
type Boundary =
    | { target: 'volume', start: number }
    | { target: 'main', start: number }
    | { target: 'indicator', type: IndicatorType, start: number };

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
    private hovered = false;                // 마우스가 차트 위에 있는지. 키보드 조작을 받을지 정한다
    // 우클릭 메뉴가 떠 있는 동안 십자선을 우클릭한 자리에 붙들어 둔다. 메뉴가 마우스를 가로채도 지우지 않는다
    private crosshairHeld = false;

    private chartType: ChartType = 'candle';
    private shapes: Candle[] = [];          // 모양을 그릴 캔들. 하이킨아시면 다시 만든 것, 그 밖에는 candles 그대로
    private logScale = false;
    private percentScale = false;
    private priceZoom = 1;                  // 가격축 세로 배율. 1 이면 보이는 구간에 맞춤
    private scaleDrag: { pointerId: number, startY: number, startZoom: number } | null = null;  // 가격축을 끄는 중

    private paneSizes: PaneSizes = {};      // 바깥에서 정해 준 영역 크기
    // 영역 사이의 경계를 끄는 중. change 는 지금까지 끌어서 바뀐 크기(아직 움직이지 않았으면 null)
    private paneDrag: { pointerId: number, startY: number, boundary: Boundary, change: PaneResize | null } | null = null;

    private valueDecimals = 0;              // 캔들 가격의 소수 자릿수
    private widestPrice = '';               // 가장 긴 가격 표기 (가격축 너비를 정하는 데 쓴다)
    private axisWidth = PRICE_AXIS_WIDTH;   // 오른쪽 가격축 너비 (CSS px)

    private candleInterval: CandleInterval | null = null;   // 캔들 한 개가 담는 기간. 남은 시간을 적는 데 쓴다
    private countdownTimer = 0;
    private countdownText: string | null = null;            // 마지막으로 그린 남은 시간

    private flatByPrevClose = false;
    private averagePeriods: number[] = [];
    private averages: Series[] = [];        // averagePeriods 와 같은 순서
    private averageColors: number[] = [];   // 이동평균선마다의 색 순번. 비어 있거나 모자라면 순서대로의 색
    private indicatorConfigs: IndicatorConfig[] = [];
    // indicatorConfigs 를 계산해 그려지는 자리별로 나눈 것
    private paneIndicators: PaneIndicator[] = [];
    private paneTypes: IndicatorType[] = [];    // paneIndicators 와 같은 순서의 지표 종류
    private priceOverlays: OverlayIndicator[] = [];
    private volumeOverlays: OverlayIndicator[] = [];
    private priceLines: PriceLine[] = [];
    private comparisons: Comparison[] = [];
    private comparisonAlign: ComparisonAlign = 'time';
    private comparisonCloses: Series[] = [];    // comparisons 와 같은 순서. 주 종목의 캔들 순번에 맞춘 종가

    /** 도형이 추가·변경·삭제되면 새 목록을 알린다. */
    onDrawingsChange: ((drawings: Drawing[]) => void) | null = null;
    /** 도형 하나를 다 그렸거나 취소해서 도구가 풀리면 알린다. */
    onToolChange: ((tool: DrawingTool | null) => void) | null = null;
    /** 선택한 도형이 바뀌면 알린다. */
    onSelectionChange: ((id: string | null) => void) | null = null;
    /**
     * 글자 도형의 내용을 입력받아야 할 때 알린다(글자 도구로 차트를 눌렀거나, 글자를 더블클릭했거나, editText 를 불렀을 때).
     * 받는 쪽은 입력 칸을 띄우고, 새 글자면 addText 로 넘기고 고치는 것이면 도형 목록을 바꿔 setDrawings 로 넘긴다.
     */
    onTextRequest: ((request: TextRequest) => void) | null = null;
    /**
     * 영역 사이의 경계를 끌어 크기를 바꾸면 알린다. 끄는 동안 계속 부르고, 손을 떼면 done 이 true 다.
     * 차트 전체 높이가 달라지므로 받는 쪽은 엔진을 담은 요소의 높이를 맞추고, 값을 setPaneSizes 로 다시 넘긴다.
     */
    onPaneResize: ((change: PaneResize, done: boolean) => void) | null = null;
    /** 차트를 우클릭하면 알린다. 받는 쪽이 메뉴를 띄운다. 그리기 도구를 고른 동안과 터치의 길게 누르기에는 알리지 않는다. */
    onContextMenu: ((request: ContextMenuRequest) => void) | null = null;
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
        timeUnit: () => this.timeUnit,
        lineValues: index => [...this.averages, ...this.priceOverlays.flatMap(overlay => overlay.series)]
            .map(series => series[index])
            .filter(isNumber),
        redraw: () => this.scheduleOverlay(),
        refreshCursor: () => this.updateCursor(),
        drawingsChanged: drawings => this.onDrawingsChange?.(drawings),
        toolReleased: () => this.onToolChange?.(null),
        selectionChanged: id => this.onSelectionChange?.(id),
        textRequested: request => this.onTextRequest?.(request),
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
        container.addEventListener('dblclick', this.handleDoubleClick);
        container.addEventListener('touchstart', this.handleTouchStart, {passive: false});
        container.addEventListener('contextmenu', this.handleContextMenu);
        // 이동·확대 키는 차트를 클릭하지 않아도 마우스가 위에 있으면 받도록 창 전체에서 듣는다.
        window.addEventListener('keydown', this.handleNavigationKey);
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
        this.measurePrices();
        this.computeSeries();
        this.scheduleDraw();
    }

    setStyle(style: ChartStyle) {
        this.style = style;
        this.scheduleDraw();
    }

    /** 가격을 그리는 방식 (캔들·봉·선·영역·하이킨아시) */
    setChartType(chartType: ChartType) {
        this.chartType = chartType;
        this.computeSeries();
        this.scheduleDraw();
    }

    /** 가격축을 로그로 할지. 로그 축에서는 같은 등락률이 같은 높이를 차지한다. */
    setLogScale(enabled: boolean) {
        this.logScale = enabled;
        this.scheduleDraw();
    }

    /**
     * 가격축에 가격 대신 등락률(%)을 적을지. 기준(0%)은 화면에 보이는 첫 캔들의 종가라서 화면을 움직이면 따라 바뀐다.
     * 캔들의 자리와 위쪽 값 표시는 그대로이고, 축에 적는 글자(눈금·현재가·십자선·수평선·가격선)만 바뀐다.
     */
    setPercentScale(enabled: boolean) {
        this.percentScale = enabled;
        this.scheduleDraw();
    }

    /** 시가와 종가가 같은 캔들의 색을 전일 종가와 비교해 정할지 (국내 HTS 방식). 기본은 상승색 */
    setFlatByPrevClose(enabled: boolean) {
        this.flatByPrevClose = enabled;
        this.scheduleDraw();
    }

    /**
     * 그릴 이동평균선의 기간들 (예: [5, 20, 60, 120])과 선마다의 색(style.lineColors 안에서의 순번).
     * 색을 주지 않으면 순서대로의 색을 쓴다.
     */
    setMovingAverages(periods: number[], colors: number[] = []) {
        this.averagePeriods = periods;
        this.averageColors = colors;
        this.computeSeries();
        this.scheduleDraw();
    }

    /** 켤 보조지표와 설정값. 별도 영역 지표는 적은 순서대로 위에서 아래로 놓인다. */
    setIndicators(indicators: IndicatorConfig[]) {
        this.indicatorConfigs = indicators;
        this.computeSeries();
        this.scheduleDraw();
    }

    /**
     * 비교 종목 목록을 통째로 바꾼다. 주 종목과 같은 주기의 캔들을 줄 것.
     * 하나라도 있으면 가격축이 퍼센트 축이 되고, 다 비우면 setPercentScale 로 정한 설정으로 돌아간다.
     * 화면에 보이는 첫 캔들을 0% 로 놓고, 주 종목과 비교 종목이 그 뒤로 움직인 등락률을 같은 축에 그린다.
     * align: 두 종목의 캔들을 무엇으로 맞출지. 일봉 이상에서 종류가 다른 종목을 섞으면 날·주·달·해로 맞춘다.
     */
    setComparisons(comparisons: Comparison[], align: ComparisonAlign = 'time') {
        this.comparisons = comparisons;
        this.comparisonAlign = align;
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

    /** 새로 그리는 도형에 입힐 꾸미기 (색·굵기·점선). 이미 그린 도형은 목록의 값을 따른다. */
    setDrawingStyle(style: DrawingStyle) {
        this.drawingLayer.setNewStyle(style);
    }

    /** 새로 그리는 피보나치 되돌림에 쓸 비율. null 이면 기본 비율. 이미 그린 것은 그 도형의 값을 따른다. */
    setFibonacciLevels(levels: number[] | null) {
        this.drawingLayer.setNewLevels(levels);
    }

    /**
     * 자석: 도형의 점을 놓거나 고칠 때 캔들 값(시가·고가·저가·종가)에 붙이는 정도.
     * indicators 가 true 면 가격 영역에 그려진 선(이동평균선, 지수이동평균, 볼린저밴드, 일목균형표, VWAP)의 값에도 붙는다.
     * Ctrl(Mac 은 ⌘)을 누른 채 그리거나 고치면 그동안만 반대로 동작한다.
     */
    setMagnet(mode: MagnetMode, indicators = false) {
        this.drawingLayer.setMagnet(mode, indicators);
    }

    /** onTextRequest 로 요청한 새 글자의 입력이 끝나면 부른다. anchor 는 요청에 담겨 있던 자리 */
    addText(anchor: Anchor, text: string) {
        this.drawingLayer.addText(anchor, text);
    }

    /** 이미 있는 글자 도형을 고칠 수 있게 onTextRequest 를 부른다. */
    editText(id: string) {
        this.drawingLayer.requestTextEdit(id);
    }

    /** 세로로 쌓인 영역들의 크기. 비운 항목은 기본값을 쓴다. */
    setPaneSizes(sizes: PaneSizes) {
        this.paneSizes = sizes;
        // 경계를 끄는 중이면 끌고 있는 값이 더 최신이다.
        if (this.paneDrag?.change) this.applyResize(this.paneDrag.change);
        this.scheduleDraw();
    }

    /** 특정 가격에 긋는 가로선들 (목표가 등). 가격축 범위 밖의 선은 그리지 않는다. */
    setPriceLines(priceLines: PriceLine[]) {
        this.priceLines = priceLines;
        this.scheduleDraw();
    }

    /**
     * 캔들 한 개가 담는 기간. 분봉이면 현재가 라벨 아래에 마지막 캔들이 마감하기까지 남은 시간을 적는다.
     * 일봉 이상이거나 null 이면 적지 않는다. 시각은 기기 시계를 따른다.
     */
    setCandleInterval(interval: CandleInterval | null) {
        this.candleInterval = interval;
        window.clearInterval(this.countdownTimer);
        this.countdownTimer = interval?.unit === 'minute'
            ? window.setInterval(() => {
                if (this.countdown() !== this.countdownText) this.scheduleDraw();
            }, COUNTDOWN_CHECK_MS)
            : 0;
        this.scheduleDraw();
    }

    /** 확대 정도는 그대로 두고 가장 최근 캔들이 오른쪽 끝에 오도록 이동한다. */
    scrollToLatest() {
        const view = this.resolveView();
        this.setView({...view, rightEdge: Math.max(this.candles.length, this.plotWidth() / view.spacing)});
    }

    /** 가격축을 끌어 바꾼 세로 배율을 되돌려 보이는 구간에 다시 맞춘다. */
    resetPriceScale() {
        if (this.priceZoom === 1) return;
        this.priceZoom = 1;
        this.scheduleDraw();
    }

    /** 우클릭 메뉴가 닫히면 부른다. 붙들어 둔 십자선을 풀고, 마우스가 다시 움직일 때까지 십자선을 지운다. */
    releaseCrosshair() {
        if (!this.crosshairHeld) return;
        this.crosshairHeld = false;
        this.pointer = null;
        this.scheduleOverlay();
    }

    /** 도형을 하나 더 만든다. 원래 것에서 오른쪽 아래로 조금 비켜 놓고 새 도형을 선택한다. */
    duplicateDrawing(id: string) {
        this.drawingLayer.duplicate(id);
    }

    /** 정해진 가격에 수평선을 긋는다. 새로 그리는 도형의 꾸미기를 따른다. */
    addHorizontalLine(price: number) {
        this.drawingLayer.addHorizontal(price);
    }

    /** 드래그·확대한 상태를 버리고 기본 보기로 돌아간다. 다른 종목·주기로 바뀔 때 부른다. */
    resetView() {
        this.view = null;
        this.priceZoom = 1;
        this.scheduleDraw();
    }

    resize(width: number, height: number) {
        if (width === this.width && height === this.height) return;
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
        // 캔버스는 크기를 바꾸면 지워진다. 다음 프레임까지 기다리면 그 사이 빈 화면이 보이므로
        // (경계를 끌어 높이가 계속 바뀌는 동안 깜박인다) 바로 그린다.
        this.drawNow();
    }

    destroy() {
        if (this.frame) cancelAnimationFrame(this.frame);
        if (this.overlayFrame) cancelAnimationFrame(this.overlayFrame);
        this.frame = 0;
        this.overlayFrame = 0;
        window.clearInterval(this.countdownTimer);
        this.container.removeEventListener('keydown', this.handleKeyDown);
        this.container.removeEventListener('pointerdown', this.handlePointerDown);
        this.container.removeEventListener('pointermove', this.handlePointerMove);
        this.container.removeEventListener('pointerup', this.handlePointerUp);
        this.container.removeEventListener('pointercancel', this.handlePointerUp);
        this.container.removeEventListener('pointerleave', this.handlePointerLeave);
        this.container.removeEventListener('wheel', this.handleWheel);
        this.container.removeEventListener('dblclick', this.handleDoubleClick);
        this.container.removeEventListener('touchstart', this.handleTouchStart);
        this.container.removeEventListener('contextmenu', this.handleContextMenu);
        window.removeEventListener('keydown', this.handleNavigationKey);
        this.mainCanvas.remove();
        this.overlayCanvas.remove();
    }

    /** 캔들이나 지표 설정이 바뀌면 이동평균·보조지표 값을 다시 계산한다. */
    private computeSeries() {
        this.shapes = this.chartType === 'heikinAshi' ? heikinAshi(this.candles) : this.candles;
        this.averages = this.averagePeriods.map(period => movingAverage(this.candles, period));
        this.comparisonCloses = this.comparisons.map(comparison => (
            alignCloses(this.candles, comparison.candles, this.comparisonAlign)
        ));
        const context = {
            timeUnit: this.timeUnit,
            formatPrice: (value: number) => formatPrice(value, this.valueDecimals),
        };
        const instances = this.indicatorConfigs.map(config => createIndicator(config, this.candles, context));
        this.paneIndicators = instances.filter(instance => instance.placement === 'pane');
        this.paneTypes = this.indicatorConfigs
            .filter((_, order) => instances[order].placement === 'pane')
            .map(config => config.type);
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

        const idle = this.activePointers.size === 0 && this.editPointerId === null && this.scaleDrag === null
            && this.paneDrag === null;

        // 영역 사이의 경계를 누르면 그 위 영역의 크기 조절을 시작한다.
        const boundary = idle ? this.boundaryAt(point, event.pointerType === 'touch') : null;
        if (boundary) {
            this.paneDrag = {pointerId: event.pointerId, startY: point.y, boundary, change: null};
            this.container.setPointerCapture(event.pointerId);
            this.pointer = null;
            this.updateCursor();
            this.scheduleOverlay();
            return;
        }

        // 가격축을 누르면 세로 배율 조절을 시작한다. 차트 이동·그리기와는 따로 처리한다.
        if (idle && this.isOnPriceAxis(point)) {
            this.scaleDrag = {pointerId: event.pointerId, startY: point.y, startZoom: this.priceZoom};
            this.container.setPointerCapture(event.pointerId);
            return;
        }

        // 도구를 골랐거나 도형 위를 눌렀으면 그리기·옮기기로 처리하고, 차트는 이동시키지 않는다.
        if (this.activePointers.size === 0 && this.editPointerId === null
            && this.drawingLayer.beginEdit(point, invertsMagnet(event))) {
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
        if (event.pointerType !== 'touch') this.hovered = true;
        if (event.pointerId === this.paneDrag?.pointerId) {
            const change = this.resizedBy(this.paneDrag.boundary, point.y - this.paneDrag.startY);
            this.paneDrag.change = change;
            this.applyResize(change);
            this.scheduleDraw();
            this.onPaneResize?.(change, false);
            return;
        }
        if (event.pointerId === this.scaleDrag?.pointerId) {
            // 아래로 끌면 범위가 넓어져 캔들이 납작해지고, 위로 끌면 좁아져 길어진다.
            const {startY, startZoom} = this.scaleDrag;
            this.priceZoom = clamp(
                startZoom * Math.exp((point.y - startY) * PRICE_ZOOM_RATE), MIN_PRICE_ZOOM, MAX_PRICE_ZOOM,
            );
            this.scheduleDraw();
            return;
        }
        if (event.pointerId === this.editPointerId) {
            this.pointer = point;
            this.drawingLayer.updateEdit(point, invertsMagnet(event));
            this.scheduleOverlay();
            return;
        }
        if (!this.activePointers.has(event.pointerId)) {
            // 누르지 않은 채 움직임: 십자선만 옮긴다. 추세선의 첫 점을 찍은 뒤라면 끝점이 따라온다.
            if (event.pointerType === 'touch') return;
            this.pointer = point;
            this.drawingLayer.hover(point, invertsMagnet(event));
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
        if (event.pointerId === this.paneDrag?.pointerId) {
            const {change} = this.paneDrag;
            this.paneDrag = null;
            if (this.container.hasPointerCapture(event.pointerId)) {
                this.container.releasePointerCapture(event.pointerId);
            }
            this.updateCursor();
            if (change) this.onPaneResize?.(change, true);
            return;
        }
        if (event.pointerId === this.scaleDrag?.pointerId) {
            this.scaleDrag = null;
            if (this.container.hasPointerCapture(event.pointerId)) {
                this.container.releasePointerCapture(event.pointerId);
            }
            return;
        }
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

    /**
     * 영역 사이의 경계를 더블클릭하면 그 위 영역을 기본 크기로 되돌리고, 가격축을 더블클릭하면 세로 배율을 되돌려
     * 보이는 구간에 다시 맞추고, 글자 도형을 더블클릭하면 고치기를 요청한다.
     */
    private readonly handleDoubleClick = (event: MouseEvent) => {
        const point = this.localPoint(event);
        const boundary = this.boundaryAt(point, false);
        if (boundary) {
            const reset: PaneResize = boundary.target === 'volume' ? {target: 'volume', ratio: null}
                : boundary.target === 'main' ? {target: 'main', height: null}
                : {target: 'indicator', type: boundary.type, height: null};
            this.applyResize(reset);
            this.scheduleDraw();
            this.onPaneResize?.(reset, true);
            return;
        }
        if (!this.isOnPriceAxis(point)) {
            this.drawingLayer.editTextAt(point);
            return;
        }
        this.resetPriceScale();
    };

    /**
     * 우클릭: 브라우저의 메뉴 대신 차트의 메뉴를 띄우도록 알린다. 도형 위면 그 도형을 선택한다.
     * 그리기 도구를 고른 동안에는 아무 메뉴도 띄우지 않고, 터치의 길게 누르기는 브라우저에 맡긴다.
     */
    private readonly handleContextMenu = (event: MouseEvent) => {
        if ((event as PointerEvent).pointerType === 'touch') return;
        event.preventDefault();
        if (this.drawingLayer.activeTool) return;
        // 십자선이 떠 있고 누른 자리가 그 근처면 십자선의 자리를 쓴다. 트랙패드의 두 손가락 클릭은 누르는 순간
        // 페이지를 몇 px 스크롤시키곤 하는데, 그러면 마우스는 그대로여도 차트가 밀려 누른 자리의 가격이 화면에 보이던
        // 십자선의 가격과 달라진다. 사용자가 보고 누른 것은 십자선이므로 그 가격을 메뉴에 쓴다.
        const clicked = this.localPoint(event);
        const shown = this.pointer;
        const point = shown && Math.hypot(clicked.x - shown.x, clicked.y - shown.y) <= CROSSHAIR_KEEP_DISTANCE
            ? shown
            : clicked;
        const pane = this.layout?.panes[0];
        const insidePrice = this.layout && pane
            && point.x < this.layout.plotWidth && point.y >= pane.top && point.y <= pane.bottom;
        // 캔들 가격의 자릿수로 맞춘다(주식이면 원 단위).
        const price = insidePrice ? Number(paneToValue(pane)(point.y).toFixed(this.valueDecimals)) : null;
        if (!this.onContextMenu) return;
        // 십자선을 메뉴가 떠 있는 동안 그 자리에 그대로 둔다. 축에 적힌 가격과 메뉴의 가격이 같은 자리의 값이다.
        this.pointer = point;
        this.crosshairHeld = true;
        this.scheduleOverlay();
        this.onContextMenu({
            clientX: event.clientX,
            clientY: event.clientY,
            drawingId: this.drawingLayer.selectAt(point),
            price,
            priceText: price === null ? null : formatPrice(price, this.valueDecimals),
            priceScaled: this.priceZoom !== 1,
        });
    };

    /**
     * 손가락으로 경계를 잡았으면 페이지가 세로로 스크롤되지 않게 막는다.
     * (세로 스크롤은 브라우저에 맡겨 두었으므로, 막지 않으면 끌기가 중간에 끊긴다.)
     */
    private readonly handleTouchStart = (event: TouchEvent) => {
        if (event.touches.length !== 1 || !event.cancelable) return;
        const rect = this.container.getBoundingClientRect();
        const touch = event.touches[0];
        if (this.boundaryAt({x: touch.clientX - rect.left, y: touch.clientY - rect.top}, true)) event.preventDefault();
    };

    // ---------- 영역 크기 ----------

    /** 별도 영역 지표들의 높이. paneIndicators 와 같은 순서 */
    private indicatorHeights(): number[] {
        return this.paneTypes.map(type => this.paneSizes.indicators?.[type] ?? INDICATOR_PANE_HEIGHT);
    }

    /** 가격+거래량 영역의 높이. 정해 주지 않았으면 요소의 높이에서 지표 영역을 뺀 나머지 */
    private mainHeight(): number {
        return this.paneSizes.mainHeight
            ?? this.height - this.indicatorHeights().reduce((sum, paneHeight) => sum + paneHeight, 0);
    }

    /**
     * point 가 놓인 영역 사이의 경계. 경계는 그 위 영역의 크기를 바꾼다:
     * 가격과 거래량 사이(거래량 비율) / 거래량 아래(가격+거래량 높이) / 지표 영역 아래(그 영역의 높이).
     * 그리기 도구를 고른 동안에는 잡지 않는다.
     */
    private boundaryAt(point: Point, touch: boolean): Boundary | null {
        const layout = this.layout;
        if (!layout || this.drawingLayer.activeTool || layout.panes.length !== this.paneTypes.length + 2) return null;
        const [, volume, ...indicatorPanes] = layout.panes;
        const heights = this.indicatorHeights();
        const boundaries: { y: number, boundary: Boundary }[] = [
            {y: volume.top - PANE_GAP / 2, boundary: {target: 'volume', start: this.paneSizes.volumeRatio ?? VOLUME_RATIO}},
            // 가격+거래량 높이를 정해 주지 않았으면 요소의 높이를 따르므로 끌어서 바꿀 수 없다.
            ...(this.paneSizes.mainHeight === undefined ? [] : [
                {y: volume.bottom, boundary: {target: 'main' as const, start: this.paneSizes.mainHeight}},
            ]),
            ...indicatorPanes.map((pane, order) => ({
                y: pane.bottom,
                boundary: {target: 'indicator' as const, type: this.paneTypes[order], start: heights[order]},
            })),
        ];
        const reach = touch ? BOUNDARY_TOUCH_REACH : BOUNDARY_REACH;
        const nearest = boundaries
            .filter(({y}) => Math.abs(point.y - y) <= reach)
            .sort((a, b) => Math.abs(point.y - a.y) - Math.abs(point.y - b.y))[0];
        return nearest?.boundary ?? null;
    }

    /** 경계를 아래로 delta 만큼 끌었을 때의 크기 */
    private resizedBy(boundary: Boundary, delta: number): PaneResize {
        if (boundary.target === 'volume') {
            // 경계가 내려가면 거래량 영역이 줄어든다.
            const innerHeight = Math.max(1, this.mainHeight() - TIME_AXIS_HEIGHT - PRICE_PANE_TOP);
            const ratio = clamp(boundary.start - delta / innerHeight, VOLUME_RATIO_LIMIT.min, VOLUME_RATIO_LIMIT.max);
            return {target: 'volume', ratio: Math.round(ratio * RATIO_STEPS) / RATIO_STEPS};
        }
        if (boundary.target === 'main') {
            const height = clamp(Math.round(boundary.start + delta), MAIN_HEIGHT_LIMIT.min, MAIN_HEIGHT_LIMIT.max);
            return {target: 'main', height};
        }
        const height = clamp(Math.round(boundary.start + delta), INDICATOR_HEIGHT_LIMIT.min, INDICATOR_HEIGHT_LIMIT.max);
        return {target: 'indicator', type: boundary.type, height};
    }

    /** 끌어서 바꾼 크기를 바로 반영한다. 기본 크기로 되돌린 것이면 그 항목을 비운다. */
    private applyResize(change: PaneResize) {
        if (change.target === 'volume') {
            this.paneSizes = {...this.paneSizes, volumeRatio: change.ratio ?? undefined};
        } else if (change.target === 'main') {
            // 가격+거래량의 기본 높이는 바깥이 정하므로, 되돌릴 때는 바깥이 setPaneSizes 로 넘겨 줄 때까지 그대로 둔다.
            if (change.height !== null) this.paneSizes = {...this.paneSizes, mainHeight: change.height};
        } else {
            this.paneSizes = {
                ...this.paneSizes,
                indicators: {...this.paneSizes.indicators, [change.type]: change.height ?? undefined},
            };
        }
    }

    /** 가격 영역 오른쪽의 가격축 위인지 */
    private isOnPriceAxis(point: Point): boolean {
        const pane = this.layout?.panes[0];
        return Boolean(this.layout && pane)
            && point.x >= this.layout!.plotWidth && point.y >= pane!.top && point.y <= pane!.bottom;
    }

    private readonly handlePointerLeave = (event: PointerEvent) => {
        // 터치는 손을 떼도 십자선을 남겨 값을 읽을 수 있게 한다.
        if (event.pointerType === 'touch') return;
        this.hovered = false;
        if (this.crosshairHeld) return;
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

    /**
     * 키보드로 이동·확대한다. 마우스가 차트 위에 있거나 차트를 클릭해 둔 동안에만 받는다.
     * ← / → 한 칸 이동(Shift 를 누르면 열 칸), + / - 화면 오른쪽 끝을 기준으로 확대·축소.
     * ↑ / ↓ 는 페이지 스크롤에 맡기고, Ctrl·⌘·Alt 와 함께 누른 것은 브라우저와 다른 단축키에 맡긴다.
     */
    private readonly handleNavigationKey = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey || event.altKey || this.candles.length === 0) return;
        if (!this.hovered && document.activeElement !== this.container) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest(KEY_IGNORED_TARGETS)) return;

        const view = this.resolveView();
        const step = event.shiftKey ? KEY_LARGE_STEP : KEY_STEP;
        if (event.key === 'ArrowLeft') {
            this.setView({...view, rightEdge: view.rightEdge - step});
        } else if (event.key === 'ArrowRight') {
            this.setView({...view, rightEdge: view.rightEdge + step});
        } else if (event.key === '+' || event.key === '=') {
            this.zoomAt(view, this.plotWidth(), view.rightEdge, view.spacing * KEY_ZOOM_RATIO);
        } else if (event.key === '-' || event.key === '_') {
            this.zoomAt(view, this.plotWidth(), view.rightEdge, view.spacing / KEY_ZOOM_RATIO);
        } else {
            return;
        }
        event.preventDefault();
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

    /** 상황에 맞는 마우스 커서: 끄는 중 / 영역 경계 위 / 가격축 위 / 도구 고름 / 도형 위 / 기본 */
    private updateCursor(hover?: Point) {
        this.container.style.cursor = this.paneDrag ? 'row-resize'
            : this.gesture ? 'grabbing'
            : hover && this.boundaryAt(hover, false) ? 'row-resize'
            : hover && this.isOnPriceAxis(hover) ? 'ns-resize'
            : this.drawingLayer.activeTool ? 'crosshair'
            : hover && this.drawingLayer.isOver(hover) ? 'pointer'
            : '';
    }

    // ---------- 보기 상태 ----------

    private plotWidth(): number {
        return Math.max(1, this.width - this.axisWidth);
    }

    /**
     * 캔들 가격을 적는 데 필요한 소수 자릿수와 가장 긴 가격 표기를 구해 둔다.
     * 주식은 정수지만 코인은 1억 원대부터 소수점 아래 여러 자리까지 있어, 축 너비와 표기를 캔들에 맞춘다.
     */
    private measurePrices() {
        const recent = this.candles.slice(-DECIMAL_SAMPLE_SIZE);
        this.valueDecimals = recent.reduce((most, candle) => Math.max(
            most, decimalsOf(candle.open), decimalsOf(candle.high), decimalsOf(candle.low), decimalsOf(candle.close),
        ), 0);
        const highest = this.candles.reduce((most, candle) => Math.max(most, candle.high), 0);
        this.widestPrice = formatPrice(highest, this.valueDecimals);
    }

    /** 가장 긴 가격 표기가 들어가도록 가격축 너비를 잡는다. 기본 너비보다 좁아지지는 않는다. */
    private updateAxisWidth(style: ChartStyle) {
        const painter = this.mainPainter;
        painter.useFont(style);
        const textWidth = painter.ctx.measureText(this.widestPrice).width / painter.dpr;
        this.axisWidth = Math.max(PRICE_AXIS_WIDTH, Math.ceil(textWidth) + AXIS_LABEL_OFFSET * 2);
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
            this.drawAll();
        });
    }

    /** 다음 프레임을 기다리지 않고 바로 그린다. */
    private drawNow() {
        if (this.frame) cancelAnimationFrame(this.frame);
        if (this.overlayFrame) cancelAnimationFrame(this.overlayFrame);
        this.frame = 0;
        this.overlayFrame = 0;
        this.drawAll();
    }

    private drawAll() {
        this.layout = this.drawMain();
        this.drawOverlay();

        const atLatest = this.resolveView().rightEdge >= this.candles.length - 0.5;
        if (atLatest !== this.atLatest) {
            this.atLatest = atLatest;
            this.onLatestChange?.(atLatest);
        }

        // 받아 둔 캔들의 왼쪽 끝이 가까우면 과거 구간을 더 달라고 알린다.
        if (this.layout && this.layout.range.leftEdge < LOAD_OLDER_THRESHOLD) this.onNeedOlder?.();
    }

    /** 마우스 이동은 위 장만 다시 그린다. */
    private scheduleOverlay() {
        if (this.overlayFrame || this.frame) return;
        this.overlayFrame = requestAnimationFrame(() => {
            this.overlayFrame = 0;
            this.drawOverlay();
        });
    }

    /**
     * 마지막 캔들이 마감하기까지 남은 시간. 분봉이 아니거나 마감 시각이 이미 지났으면(장이 끝났거나 체결이 없어
     * 캔들이 멈춘 경우) null. 기기 시계가 늦어 한 캔들의 길이보다 길게 남은 것으로 나와도 적지 않는다.
     */
    private countdown(): string | null {
        const last = this.candles[this.candles.length - 1];
        const interval = this.candleInterval;
        if (!last || interval?.unit !== 'minute') return null;
        const end = bucketEnd(last.time, interval);
        if (end === null) return null;
        const remaining = end - Date.now();
        return remaining > 0 && remaining <= interval.count * MINUTE_MS ? formatCountdown(remaining) : null;
    }

    /** 아래 장 전체를 그리고, 그린 배치를 돌려준다. 그릴 것이 없으면 null */
    private drawMain(): Layout | null {
        this.mainPainter.ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        const style = this.style;
        this.countdownText = this.countdown();
        if (!style || this.candles.length === 0) return null;
        this.updateAxisWidth(style);

        return renderMain(this.mainPainter, {
            candles: this.candles,
            chartType: this.chartType,
            shapes: this.shapes,
            logScale: this.logScale,
            // 비교 종목은 등락률로만 견줄 수 있으므로, 있는 동안에는 설정과 상관없이 퍼센트 축으로 그린다.
            percentScale: this.percentScale || this.comparisons.length > 0,
            priceZoom: this.priceZoom,
            timeUnit: this.timeUnit,
            style,
            width: this.width,
            mainHeight: this.mainHeight(),
            volumeRatio: this.paneSizes.volumeRatio ?? VOLUME_RATIO,
            indicatorHeights: this.indicatorHeights(),
            range: visibleRange(this.resolveView(), this.candles.length, this.plotWidth()),
            averages: this.averages,
            averageColors: this.averageColors,
            indicators: this.paneIndicators,
            priceOverlays: this.priceOverlays,
            volumeOverlays: this.volumeOverlays,
            priceLines: this.priceLines,
            comparisons: this.comparisons.map(({color}, order) => ({closes: this.comparisonCloses[order] ?? [], color})),
            flatByPrevClose: this.flatByPrevClose,
            axisWidth: this.axisWidth,
            valueDecimals: this.valueDecimals,
            countdown: this.countdownText,
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
            drawCandleLegend(
                painter, layout, style, candle, candleColor(this.candles, index, style, this.flatByPrevClose),
                this.candles[index - 1]?.close ?? null,
            );
        }
        const comparisonItems = this.comparisons.map(({name, color}, order): LegendItem => {
            const percent = comparisonPercent(this.comparisonCloses[order] ?? [], layout.comparisonBases[order] ?? null, index);
            return [
                `${name} ${percent === null ? '-' : formatPercent(percent, COMPARISON_PERCENT_DECIMALS)}`,
                lineColor(style, color),
            ];
        });
        drawOverlayLegends(
            painter, layout, style, this.averagePeriods, this.averages, this.averageColors, index, comparisonItems,
        );
        drawIndicatorLegends(painter, layout, style, index);
    }
}
