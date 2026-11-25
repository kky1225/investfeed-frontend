import {
    Anchor, Candle, ChartStyle, ChartType, Comparison, ContextMenuRequest, Drawing, DrawingStyle, DrawingTool, IndicatorConfig, MagnetMode,
    CandleInterval, PaneResize, PaneSizes, PriceLine, SeriesStroke, TextRequest, TimeUnit, TradeMarker,
} from "./types.ts";
import {bucketEnd} from "./realtime.ts";
import {heikinAshi, movingAverage, Series} from "./indicators.ts";
import {
    AXIS_LABEL_OFFSET, DRAG_THRESHOLD, INDICATOR_HEIGHT_LIMIT, INDICATOR_PANE_HEIGHT, MAIN_HEIGHT_LIMIT, PRICE_AXIS_WIDTH,
    PRICE_PANE_TOP, TIME_AXIS_HEIGHT, VOLUME_RATIO, VOLUME_RATIO_LIMIT,
} from "./constants.ts";
import {decimalsOf, formatCountdown, formatPercent, formatPrice} from "./scale.ts";
import {alignCloses, ComparisonAlign, comparisonPercent} from "./comparison.ts";
import {clamp, isNumber, Layout, paneToValue, paneToY, Point, View} from "./layout.ts";
import {clampView, defaultView, fittedView, futureMargin, logicalAt, visibleRange, zoomedView} from "./viewport.ts";
import {candleColor, lineColor, Painter, textColorOf, watchPixelRatio} from "./painter.ts";
import {createIndicator, LegendItem, OverlayIndicator, PaneIndicator} from "./indicatorPanes.ts";
import {PANE_GAP, renderMain} from "./mainRenderer.ts";
import {SessionDay} from "./timeAxis.ts";
import {
    drawCandleLegend, drawCrosshair, drawIndicatorLegends, drawLinkedCrosshair, drawOverlayLegends, drawTradeTooltip,
} from "./overlayRenderer.ts";
import {CrosshairPoint} from "./crosshairLink.ts";
import {ViewEdge, ViewSpan} from "./viewLink.ts";
import {createFutureClock, FutureClock} from "./futureTime.ts";
import {DrawingLayer, timeToIndex} from "./drawingLayer.ts";

export {INDICATOR_HEIGHT_LIMIT, INDICATOR_PANE_HEIGHT, MAIN_HEIGHT_LIMIT, VOLUME_RATIO_LIMIT} from "./constants.ts";

const COMPARISON_PERCENT_DECIMALS = 2;  // 값 표시에 적는 비교 종목 등락률의 소수 자릿수
// 기간 이동에서 캔들이 여러 날을 담는지(주·월·연봉) 볼 때: 앞뒤로 이만큼의 간격을 보고, 중간값이 이보다 길면 여러 날로 본다.
// 일봉은 연휴에도 중간값이 1일 남짓이고 주봉은 7일이다
const SPAN_SAMPLE = 5;
const MULTI_DAY_GAP_MS = 3 * 24 * 60 * 60 * 1000;
const LOAD_OLDER_THRESHOLD = 50;   // 화면 왼쪽 끝에서 받아 둔 첫 캔들까지 이만큼 이하로 남으면 과거 구간을 요청한다
const MAX_LINKED_BLANK = 0.9;      // 기간 연동으로 받은 구간에서 마지막 캔들 뒤를 비우는 비율의 상한 (1 에 가까우면 계산이 튄다)
const PINCH_DELTA_LIMIT = 30;   // 휠 한 번의 이동량이 이보다 작으면 트랙패드 두 손가락 벌리기로 본다
const WHEEL_ZOOM_RATE = 0.0015;
const PINCH_WHEEL_ZOOM_RATE = 0.01; // 트랙패드 두 손가락 벌리기 (ctrl + wheel 로 들어옴)
const WHEEL_LINE_HEIGHT = 16;
const DECIMAL_SAMPLE_SIZE = 300;    // 가격의 소수 자릿수를 알아낼 때 살펴보는 최근 캔들 수
// 가격축을 끌어 세로 배율을 바꿀 때: 1px 에 이 비율만큼, 아래 범위 안에서
const PRICE_ZOOM_RATE = 0.005;
const MIN_PRICE_ZOOM = 0.2;
const MAX_PRICE_ZOOM = 10;
const MAX_PRICE_SHIFT = 5;      // 가격 범위를 위아래로 옮길 수 있는 한계 (보이는 범위의 몇 배)
const LONG_PRESS_MS = 400;      // 손가락을 이만큼 움직이지 않고 누르고 있으면 십자선을 띄운다
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
    | { target: 'indicator', key: string, start: number };

type Gesture =
    // vertical: 위아래로도 옮기는지(가격축을 손으로 맞춰 둔 상태에서 마우스로 끌 때). startShift 는 시작할 때의 priceShift
    | { type: 'pan', startX: number, startY: number, startRightEdge: number, startShift: number, vertical: boolean, moved: boolean }
    | { type: 'crosshair' }     // 손가락으로 길게 눌러 십자선을 옮기는 중. 차트는 움직이지 않는다
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
    private readonly stopWatchingPixelRatio: () => void;    // 화면 배율 감시를 끝낸다 (watchPixelRatio)
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
    // 다른 차트에서 옮겨 온 십자선(멀티 화면의 연동). 이 차트의 십자선이 없을 때만 그린다
    private linkedCrosshair: CrosshairPoint | null = null;
    private sharedCrosshair: CrosshairPoint | null = null;  // 마지막으로 알린 이 차트의 십자선 (onCrosshairMove)
    private capturing = false;      // 그림 한 장으로 만드는 중(toImage). 십자선을 그리지도 알리지도 않는다
    private destroyed = false;      // destroy 를 불렀는지. 그 뒤로는 그리기를 예약하지 않는다
    private futureClock: FutureClock | null = null;  // 미래 구간 칸의 시각 어림. 캔들이 바뀌면 다시 만든다 (십자선 라벨용)
    private pixelShift = {x: 0, y: 0};  // 화면 픽셀에 맞추려고 캔버스를 왼쪽·위로 당긴 거리 (CSS px, 1픽셀 미만, alignToPixels)

    private chartType: ChartType = 'candle';
    private shapes: Candle[] = [];          // 모양을 그릴 캔들. 하이킨아시면 다시 만든 것, 그 밖에는 candles 그대로
    private logScale = false;
    private percentScale = false;
    private priceZoom = 1;                  // 가격축 세로 배율. 1 이면 보이는 구간에 맞춤
    // 가격 범위를 위아래로 옮긴 정도(보이는 범위의 몇 배). 가격축을 손으로 맞춰 둔 상태에서 차트를 위아래로 끌면 바뀐다
    private priceShift = 0;
    private longPressTimer = 0;
    private scaleDrag: { pointerId: number, startY: number, startZoom: number } | null = null;  // 가격축을 끄는 중

    private paneSizes: PaneSizes = {};      // 바깥에서 정해 준 영역 크기
    // 영역 사이의 경계를 끄는 중. change 는 지금까지 끌어서 바뀐 크기(아직 움직이지 않았으면 null)
    private paneDrag: { pointerId: number, startY: number, boundary: Boundary, change: PaneResize | null } | null = null;

    private valueDecimals = 0;              // 캔들 가격의 소수 자릿수
    private measuredDecimals = 0;           // 캔들 가격의 소수 자릿수 (상한을 적용하기 전)
    private maxDecimals: number | null = null;  // 캔들 가격을 적는 소수 자릿수의 상한. null 이면 캔들 가격을 그대로 따른다
    private extremePrefix = '';             // 최고·최저 표시의 가격 앞에 붙일 통화 기호
    private widestPrice = '';               // 가장 긴 가격 표기 (가격축 너비를 정하는 데 쓴다)
    private axisWidth = PRICE_AXIS_WIDTH;   // 오른쪽 가격축 너비 (CSS px)

    private candleInterval: CandleInterval | null = null;   // 캔들 한 개가 담는 기간. 남은 시간을 적는 데 쓴다
    private countdownTimer = 0;
    private countdownText: string | null = null;            // 마지막으로 그린 남은 시간

    private flatByPrevClose = false;
    private grid = true;
    private sessionDay: SessionDay = 'midnight';
    private averagePeriods: number[] = [];
    private averages: Series[] = [];        // averagePeriods 와 같은 순서
    private seriesStale = false;            // 캔들이 바뀌어 shapes·averages·지표를 다시 계산해야 하는지 (ensureSeries)
    private averageColors: number[] = [];   // 이동평균선마다의 색 순번. 비어 있거나 모자라면 순서대로의 색
    private averageStrokes: SeriesStroke[] = [];    // 이동평균선마다의 굵기·점선
    private indicatorConfigs: IndicatorConfig[] = [];
    // indicatorConfigs 를 계산해 그려지는 자리별로 나눈 것
    private paneIndicators: PaneIndicator[] = [];
    private paneKeys: string[] = [];    // paneIndicators 와 같은 순서의 지표 이름 (IndicatorConfig 의 key)
    private priceOverlays: OverlayIndicator[] = [];
    private volumeOverlays: OverlayIndicator[] = [];
    private priceLines: PriceLine[] = [];
    // 가격선(목표가)을 끄는 중. price 는 지금 끌어다 놓은 가격이고, 손을 뗄 때까지 그 선을 이 가격에 그린다
    private hoveredPriceLine: string | null = null;     // 마우스가 올라가 있는, 끌 수 있는 가격선
    private priceLineDrag: { pointerId: number, id: string, startY: number, price: number, moved: boolean } | null = null;
    private tradeMarkers: TradeMarker[] = [];
    // tradeMarkers 를 캔들 순번으로 찾게 만든 것. 캔들이나 표시가 바뀌면 다시 만든다
    private tradeMarkersByIndex = new Map<number, TradeMarker[]>();
    private hasOlder = false;       // 더 받을 과거 구간이 남아 있는지
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
    /** 도형이 이미 가득 차서(MAX_DRAWINGS) 새로 그리거나 복제하지 못했을 때 알린다. */
    onDrawingLimit: (() => void) | null = null;
    /** 받아 둔 캔들보다 앞선 점이 있는 도형이라 복제하지 못했을 때 알린다. (과거 구간을 더 받아 오면 된다) */
    onDrawingBeforeRange: (() => void) | null = null;
    /**
     * 영역 사이의 경계를 끌어 크기를 바꾸면 알린다. 끄는 동안 계속 부르고, 손을 떼면 done 이 true 다.
     * 차트 전체 높이가 달라지므로 받는 쪽은 엔진을 담은 요소의 높이를 맞추고, 값을 setPaneSizes 로 다시 넘긴다.
     */
    onPaneResize: ((change: PaneResize, done: boolean) => void) | null = null;
    /**
     * id 가 있는 가격선을 끌어 다른 가격에 놓으면 알린다. 엔진은 손을 떼는 순간 선을 원래 자리로 돌려놓으므로,
     * 받는 쪽이 새 가격을 받아들이려면 setPriceLines 로 바뀐 목록을 넘겨야 한다.
     */
    onPriceLineMove: ((id: string, price: number) => void) | null = null;
    /** 차트를 우클릭하면 알린다. 받는 쪽이 메뉴를 띄운다. 그리기 도구를 고른 동안과 터치의 길게 누르기에는 알리지 않는다. */
    onContextMenu: ((request: ContextMenuRequest) => void) | null = null;
    /** 가장 최근 캔들이 화면에 보이는지가 바뀌면 알린다. (최근으로 이동 버튼 표시용) */
    onLatestChange: ((atLatest: boolean) => void) | null = null;
    /**
     * 화면 왼쪽 끝이 받아 둔 캔들의 처음에 가까워지면 부른다. 가까운 동안 계속 부르므로,
     * 받는 쪽에서 이미 요청 중이거나 더 받을 것이 없으면 무시해야 한다.
     */
    onNeedOlder: (() => void) | null = null;
    /**
     * 이 차트의 십자선이 가리키는 캔들·가격이 바뀌면 알린다(마우스·손가락으로 옮긴 것만). 사라지면 null.
     * 다른 차트가 setLinkedCrosshair 로 받아 같은 자리에 십자선을 띄운다.
     */
    onCrosshairMove: ((point: CrosshairPoint | null) => void) | null = null;
    /**
     * 사용자가 확대·이동해(휠·키·끌기·최근으로 이동·날짜로 이동 등) 보이는 구간이 바뀌면 알린다.
     * 다른 차트가 setLinkedView 로 받아 같은 기간을 보여 준다. setLinkedView 로 옮긴 것은 알리지 않는다.
     */
    onViewMove: ((span: ViewSpan) => void) | null = null;

    private readonly drawingLayer = new DrawingLayer({
        layout: () => this.layout,
        candles: () => this.candles,
        hasOlder: () => this.hasOlder,
        timeUnit: () => this.timeUnit,
        lineValues: index => {
            this.ensureSeries();
            return [...this.averages, ...this.priceOverlays.flatMap(overlay => overlay.series)]
                .map(series => series[index])
                .filter(isNumber);
        },
        redraw: () => this.scheduleOverlay(),
        refreshCursor: () => this.updateCursor(),
        drawingsChanged: drawings => this.onDrawingsChange?.(drawings),
        toolReleased: () => this.onToolChange?.(null),
        selectionChanged: id => this.onSelectionChange?.(id),
        textRequested: request => this.onTextRequest?.(request),
        limitReached: () => this.onDrawingLimit?.(),
        beforeRangeBlocked: () => this.onDrawingBeforeRange?.(),
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
        container.addEventListener('touchmove', this.handleTouchMove, {passive: false});
        container.addEventListener('contextmenu', this.handleContextMenu);
        // 이동·확대 키는 차트를 클릭하지 않아도 마우스가 위에 있으면 받도록 창 전체에서 듣는다.
        window.addEventListener('keydown', this.handleNavigationKey);
        window.addEventListener('scroll', this.handleScroll, {capture: true, passive: true});
        this.stopWatchingPixelRatio = watchPixelRatio(this.handlePixelRatioChange);
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
            else if (this.gesture.type === 'pinch') this.gesture.anchor += prepended;
        }

        // 최근 캔들을 보고 있었다면 새 캔들이 붙어도 계속 최근을 보게 따라간다.
        const previousTotal = previous.length + prepended;
        if (this.view && previous.length > 0 && this.view.rightEdge >= previousTotal - 0.5) {
            this.view = {...this.view, rightEdge: this.view.rightEdge + candles.length - previousTotal};
        }
        this.candles = candles;
        this.timeUnit = timeUnit;
        this.indexTradeMarkers();
        this.measurePrices();
        // 지표는 다시 계산할 것만 표시해 두고, 그리기 직전(또는 값을 읽을 때) 한 번만 계산한다(ensureSeries).
        // 체결은 한 프레임 안에도 여러 건 오는데, 화면에는 마지막 결과만 보이기 때문이다.
        this.seriesStale = true;
        this.futureClock = null;
        this.drawingLayer.candlesChanged();
        this.scheduleDraw();
    }

    /**
     * 캔들 가격(현재가·최고·최저·십자선·시고저종 등)을 적는 소수 자릿수의 상한을 정한다. null 이면 캔들 가격의 자릿수를 따른다.
     * 캔들 값은 그대로 두고 적는 자릿수만 줄인다 (미국 주식처럼 일부 캔들만 자릿수가 긴 경우).
     */
    setMaxDecimals(max: number | null) {
        if (this.maxDecimals === max) return;
        this.maxDecimals = max;
        this.measurePrices();
        this.scheduleDraw();
    }

    /** 최고·최저 표시의 가격 앞에 붙일 통화 기호를 정한다($ 등). 빈 문자열이면 숫자만 적는다. 축·라벨에는 붙이지 않는다 */
    setExtremePrefix(prefix: string) {
        if (this.extremePrefix === prefix) return;
        this.extremePrefix = prefix;
        this.scheduleDraw();
    }

    /** 더 받을 과거 구간이 남아 있는지 알린다. 받아 둔 캔들보다 앞선 자리의 도형을 어떻게 다룰지가 이 값에 달려 있다. */
    setHasOlder(hasOlder: boolean) {
        if (this.hasOlder === hasOlder) return;
        this.hasOlder = hasOlder;
        this.drawingLayer.candlesChanged();
        this.scheduleOverlay();
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

    /** 격자선(가로·세로)을 그을지. 눈금 글자, 축 경계선, 지표의 기준선은 그대로 그린다. */
    setGrid(visible: boolean) {
        this.grid = visible;
        this.scheduleDraw();
    }

    /** 분봉의 날짜 경계선을 몇 시에 그을지. 코인(업비트)은 오전 9시, 그 밖에는 날짜 눈금과 같은 자정 */
    setSessionDay(day: SessionDay) {
        if (this.sessionDay === day) return;
        this.sessionDay = day;
        this.scheduleDraw();
    }

    /**
     * 지금 보이는 차트를 그림 한 장으로 만든다. 바탕색을 칠하고 아래 장과 위 장을 겹친다.
     * 십자선은 빼고, 값 표시는 가장 최근 캔들의 것으로 그린다. 그릴 것이 없으면 null.
     */
    toImage(): HTMLCanvasElement | null {
        const style = this.style;
        if (!style || this.candles.length === 0) return null;
        this.capturing = true;
        this.drawNow();
        this.capturing = false;
        const image = document.createElement('canvas');
        image.width = this.mainCanvas.width;
        image.height = this.mainCanvas.height;
        const ctx = image.getContext('2d');
        if (ctx) {
            ctx.fillStyle = style.backgroundColor;
            ctx.fillRect(0, 0, image.width, image.height);
            ctx.drawImage(this.mainCanvas, 0, 0);
            ctx.drawImage(this.overlayCanvas, 0, 0);
        }
        this.scheduleDraw();
        return ctx ? image : null;
    }

    /**
     * 다른 차트에서 옮겨 온 십자선. point.time 은 이 차트의 캔들 시각이고, price 는 가로선을 그을 가격(없으면 세로선만)이다.
     * null 이면 지운다. 이 차트에 마우스·손가락의 십자선이 있는 동안에는 그것을 그린다.
     */
    setLinkedCrosshair(point: CrosshairPoint | null) {
        const current = this.linkedCrosshair;
        if (current === point || (current && point && current.time === point.time && current.price === point.price)) return;
        this.linkedCrosshair = point;
        // 손을 뗀 뒤 남은 십자선(터치의 길게 누르기, 날짜로 이동)은 다른 차트를 가리키기 시작하면 지운다.
        // 남겨 두면 이 차트만 예전 자리를 가리킨다.
        if (point && !this.isPointing()) this.pointer = null;
        this.scheduleOverlay();
    }

    /**
     * 다른 차트에서 옮겨 온 보는 구간. 화면 왼쪽 끝과 오른쪽 끝이 span 에 오도록 확대·이동한다.
     * 가장 최근 캔들까지 보여 주던 구간(latest)이면 이 차트도 마지막 캔들까지 보여 주고, 그 뒤를 같은 비율(blank)만큼 비운다.
     * 확대 한계에 걸리면 구간의 가운데를 맞춘다. 기준 캔들이 이 차트에 없으면 무시한다.
     */
    setLinkedView(span: ViewSpan) {
        const left = this.logicalOf(span.left);
        // 오른쪽 끝 right 가 "마지막 캔들 끝 + 화면 너비(right - left)의 blank 비율"이 되도록 푼 값
        const blank = clamp(span.blank, 0, MAX_LINKED_BLANK);
        const right = span.latest
            ? left === null ? null : (this.candles.length - blank * left) / (1 - blank)
            : this.logicalOf(span.right);
        if (left === null || right === null || right <= left) return;
        this.view = clampView(fittedView(left, right, this.plotWidth()).view, this.candles.length, this.plotWidth());
        this.scheduleDraw();
    }

    /** 구간 끝을 이 차트의 순번(소수)으로 바꾼다. 기준 캔들이 없으면 null */
    private logicalOf(edge: ViewEdge): number | null {
        if (this.candles.length === 0) return null;
        const index = timeToIndex(this.candles, edge.time);
        return this.candles[index].time === edge.time ? index + edge.offset : null;
    }

    /** 순번(소수)을 구간 끝으로 바꾼다. 받아 둔 캔들 밖이면 가장 가까운 캔들에서 떨어진 칸 수로 적는다 */
    private edgeOf(logical: number): ViewEdge {
        const index = clamp(Math.floor(logical), 0, this.candles.length - 1);
        return {time: this.candles[index].time, offset: logical - index};
    }

    /**
     * 마지막 캔들에서 steps 칸 뒤(미래 구간)의 시각 어림. 미래 칸을 가리킬 때만 만들고, 캔들이 바뀌면 버린다
     * (실시간 체결마다 다시 만들지 않도록).
     */
    private futureTimeAt(steps: number): number | null {
        this.futureClock ??= createFutureClock(this.candles, this.timeUnit);
        return this.futureClock(steps);
    }

    /** 사용자가 지금 이 차트를 가리키는 중인지 (마우스가 위에 있거나, 누르고 있거나, 우클릭 메뉴로 십자선을 붙들어 둠) */
    private isPointing(): boolean {
        return this.hovered || this.activePointers.size > 0 || this.editPointerId !== null
            || this.priceLineDrag !== null || this.crosshairHeld;
    }

    /**
     * 그릴 이동평균선의 기간들 (예: [5, 20, 60, 120])과 선마다의 색(style.lineColors 안에서의 순번).
     * 색을 주지 않으면 순서대로의 색을 쓴다. strokes 는 선마다의 굵기·점선이고, 주지 않으면 굵기 1 의 실선이다.
     */
    setMovingAverages(periods: number[], colors: number[] = [], strokes: SeriesStroke[] = []) {
        this.averagePeriods = periods;
        this.averageColors = colors;
        this.averageStrokes = strokes;
        this.computeSeries();
        this.scheduleDraw();
    }

    /** 켤 보조지표와 설정값. 별도 영역 지표는 적은 순서대로 위에서 아래로 놓인다. 같은 종류를 둘 넣을 때는 key 를 다르게 준다. */
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

    /** 내 매매 표시. 캔들의 time 이 같은 표시만 그린다. 비우면 지운다. */
    setTradeMarkers(tradeMarkers: TradeMarker[]) {
        this.tradeMarkers = tradeMarkers;
        this.indexTradeMarkers();
        this.scheduleDraw();
    }

    private indexTradeMarkers() {
        this.tradeMarkersByIndex = new Map();
        if (this.tradeMarkers.length === 0) return;
        const indexByTime = new Map(this.candles.map((candle, index) => [candle.time, index]));
        this.tradeMarkers.forEach(marker => {
            const index = indexByTime.get(marker.time);
            if (index === undefined) return;
            this.tradeMarkersByIndex.set(index, [...this.tradeMarkersByIndex.get(index) ?? [], marker]);
        });
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

    /**
     * 확대 정도는 그대로 두고 가장 최근 캔들이 오른쪽 끝에 오도록 이동한다.
     * 마지막 캔들 뒤까지 그려지는 지표(일목균형표의 구름)가 켜져 있으면 그만큼 오른쪽을 비워 둔다.
     */
    scrollToLatest() {
        const view = this.resolveView();
        const bars = this.plotWidth() / view.spacing;
        this.setView({...view, rightEdge: Math.max(this.candles.length + futureMargin(this.futureBars(), bars), bars)});
    }

    /** 가격축을 끌어 바꾼 세로 배율과 위아래로 옮긴 것을 되돌려 보이는 구간에 다시 맞춘다. */
    resetPriceScale() {
        if (!this.priceAdjusted()) return;
        this.priceZoom = 1;
        this.priceShift = 0;
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

    /** 화면 왼쪽 끝·가운데·오른쪽 끝에 놓인 캔들의 시각. 캔들이 없으면 null */
    viewTimes(): { first: number, center: number, last: number } | null {
        if (this.candles.length === 0) return null;
        const plotWidth = this.plotWidth();
        const view = this.resolveView();
        const timeAt = (x: number) => this.candles[clamp(Math.floor(logicalAt(view, plotWidth, x)), 0, this.candles.length - 1)].time;
        return {first: timeAt(0), center: timeAt(plotWidth / 2), last: timeAt(plotWidth - 1)};
    }

    /**
     * 시각 from(기간 첫날·첫 분의 시작)부터 to(마지막 날·분의 끝)까지의 캔들이 화면 너비에 꽉 차게 확대·축소해 옮긴다.
     * - 끝은 to 를 담은 캔들(scrollToTime 과 같은 규칙)이다.
     * - 시작은 분봉·일봉이면 from 이후의 첫 캔들이다(휴장일·장 시작 전을 고르면 그다음 캔들). 주·월·연봉처럼 캔들 하나가
     *   여러 날이면 from 을 담은 캔들이다(주 중간 날짜를 골라도 그 주가 들어간다).
     * fits: 구간이 화면에 다 들어가는지(너무 길면 축소 한계에서 가운데를 맞춘다). empty: 기간 안에 캔들이 없어
     * 가장 가까운 앞 캔들을 보여 주었는지(휴장일만 고른 경우, 기간 전체가 마지막 캔들보다 뒤인 경우).
     */
    fitTimeRange(from: number, to: number): { fits: boolean, empty: boolean } {
        const candles = this.candles;
        if (candles.length === 0) return {fits: true, empty: true};
        const end = timeToIndex(candles, to);
        const containing = timeToIndex(candles, from);
        const start = this.spansDays(containing) || candles[containing].time >= from ? containing : containing + 1;
        const empty = start > end;
        const {view, fits} = fittedView(Math.min(start, end), end + 1, this.plotWidth());
        this.setView(view);
        return {fits, empty};
    }

    /** 순번 index 근처 캔들이 하루보다 긴 기간을 담는지 (주·월·연봉). 앞뒤 캔들 간격의 중간값으로 판단한다 */
    private spansDays(index: number): boolean {
        const from = Math.max(1, index - SPAN_SAMPLE);
        const to = Math.min(this.candles.length - 1, index + SPAN_SAMPLE);
        const gaps = [];
        for (let next = from; next <= to; next++) gaps.push(this.candles[next].time - this.candles[next - 1].time);
        if (gaps.length === 0) return false;
        gaps.sort((a, b) => a - b);
        return gaps[Math.floor(gaps.length / 2)] > MULTI_DAY_GAP_MS;
    }

    /**
     * 시각 time 을 담은 캔들이 화면 가운데에 오도록 옮기고, 그 캔들의 종가에 십자선을 올려 둔다. 확대 정도는 그대로다.
     * 그 시각에 캔들이 없으면(휴장일 등) 그 직전 캔들로, 받아 둔 첫 캔들보다 앞서면 첫 캔들로 간다.
     * 십자선은 마우스가 차트 위에서 움직이면 마우스를 따라간다.
     */
    scrollToTime(time: number) {
        if (this.candles.length === 0) return;
        const index = timeToIndex(this.candles, time);
        const view = this.resolveView();
        this.setView({...view, rightEdge: index + 0.5 + this.plotWidth() / view.spacing / 2});
        // 끝 쪽 캔들은 가운데까지 오지 못하므로, 옮긴 배치를 그려 본 뒤 그 캔들의 자리에 십자선을 놓는다.
        this.drawNow();
        const pane = this.layout?.panes[0];
        if (!this.layout || !pane) return;
        const {range} = this.layout;
        this.pointer = {
            x: (index + 0.5 - range.leftEdge) * range.spacing,
            y: clamp(paneToY(pane)(this.candles[index].close), pane.top, pane.bottom),
        };
        this.scheduleOverlay();
    }

    /** 가격을 차트의 가격 라벨과 같은 자릿수로 적는다 (그린 선 목록·꾸미기 패널의 수평선 가격용) */
    formatPriceText(price: number): string {
        return formatPrice(price, this.valueDecimals);
    }

    /** 가격을 차트의 가격 라벨과 같은 자릿수로 반올림한다 (수평선 가격 입력용) */
    roundPrice(price: number): number {
        return Number(price.toFixed(this.valueDecimals));
    }

    /**
     * 그린 도형 하나를 보이는 곳으로 옮기고 선택한다(그린 선 목록용). 확대 정도는 그대로다.
     * 도형이 이미 화면 안에 다 들어 있으면 옮기지 않고, 아니면 도형의 가운데를 화면 가운데에 둔다.
     * 수평선은 가로로 옮길 필요가 없어 선택만 한다. 선택하지 못했으면(숨김, 그릴 자리 없음) false
     */
    focusDrawing(id: string): boolean {
        const span = this.drawingLayer.indexSpan(id);
        if (span && this.candles.length > 0) {
            const view = this.resolveView();
            const bars = this.plotWidth() / view.spacing;
            const inside = span.from >= view.rightEdge - bars && span.to + 1 <= view.rightEdge;
            if (!inside) this.setView({...view, rightEdge: (span.from + span.to + 1) / 2 + bars / 2});
        }
        return this.drawingLayer.selectById(id);
    }

    /** 드래그·확대한 상태를 버리고 기본 보기로 돌아간다. 다른 종목·주기로 바뀔 때 부른다. */
    resetView() {
        this.view = null;
        this.priceZoom = 1;
        this.priceShift = 0;
        this.scheduleDraw();
    }

    resize(width: number, height: number) {
        const dpr = window.devicePixelRatio || 1;
        this.alignToPixels(dpr);
        if (width === this.width && height === this.height && dpr === this.mainPainter.dpr) return;
        this.width = width;
        this.height = height;
        this.mainPainter.dpr = dpr;
        this.overlayPainter.dpr = dpr;
        [this.mainCanvas, this.overlayCanvas].forEach(canvas => {
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            // 표시 크기를 캔버스 픽셀 수에 딱 맞춘다. 너비가 소수(반으로 나눈 패널 등)면 그대로 두었을 때 살짝 늘어나 흐려진다.
            canvas.style.width = `${canvas.width / dpr}px`;
            canvas.style.height = `${canvas.height / dpr}px`;
        });
        // 캔버스는 크기를 바꾸면 지워진다. 다음 프레임까지 기다리면 그 사이 빈 화면이 보이므로
        // (경계를 끌어 높이가 계속 바뀌는 동안 깜박인다) 바로 그린다.
        this.drawNow();
    }

    /**
     * 캔버스를 화면 픽셀 경계에 맞춰 놓는다. 차트가 반 픽셀 같은 자리에서 시작하면(멀티 화면의 오른쪽 패널 등) 브라우저가
     * 그림 전체를 픽셀 사이에 걸쳐 다시 그려 선과 글자가 흐려진다. 시작 위치의 소수 부분만큼 왼쪽·위로 당긴다(1픽셀 미만).
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
        [this.mainCanvas, this.overlayCanvas].forEach(canvas => {
            canvas.style.left = `${-x}px`;
            canvas.style.top = `${-y}px`;
        });
    }

    /**
     * 크기는 그대로인데 위치만 바뀌는 경우(위쪽 패널의 높이가 바뀌어 밀림, 배율이 정수가 아닌 화면에서의 스크롤)에도
     * 정렬을 다시 맞춘다. 스크롤은 어느 요소에서 일어나든 받는다.
     */
    private readonly handleScroll = () => {
        if (this.width > 0) this.alignToPixels(this.mainPainter.dpr);
    };

    /** 화면 배율이 바뀌면 캔버스를 그 배율에 맞춘다. 아직 크기를 받지 못했으면(처음 그리기 전) 크기를 받을 때 맞춘다. */
    private readonly handlePixelRatioChange = () => {
        if (this.width > 0 && this.height > 0) this.resize(this.width, this.height);
    };

    destroy() {
        this.destroyed = true;
        this.stopWatchingPixelRatio();
        if (this.frame) cancelAnimationFrame(this.frame);
        if (this.overlayFrame) cancelAnimationFrame(this.overlayFrame);
        this.frame = 0;
        this.overlayFrame = 0;
        window.clearInterval(this.countdownTimer);
        window.clearTimeout(this.longPressTimer);
        this.container.removeEventListener('touchmove', this.handleTouchMove);
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
        window.removeEventListener('scroll', this.handleScroll, {capture: true});
        this.mainCanvas.remove();
        this.overlayCanvas.remove();
    }

    /** 캔들이 바뀐 뒤 아직 계산하지 않은 이동평균·보조지표가 있으면 계산한다. 계산 결과를 읽는 곳은 먼저 이것을 부른다. */
    private ensureSeries() {
        if (this.seriesStale) this.computeSeries();
    }

    /** 캔들이나 지표 설정이 바뀌면 이동평균·보조지표 값을 다시 계산한다. */
    private computeSeries() {
        this.seriesStale = false;
        this.shapes = this.chartType === 'heikinAshi' ? heikinAshi(this.candles) : this.candles;
        this.averages = this.averagePeriods.map(period => movingAverage(this.candles, period));
        this.comparisonCloses = this.comparisons.map(comparison => (
            alignCloses(this.candles, comparison.candles, this.comparisonAlign)
        ));
        const context = {
            timeUnit: this.timeUnit,
            formatPrice: (value: number) => formatPrice(value, this.valueDecimals),
            // 등락폭 지표(MACD·ATR)의 자릿수는 적는 자릿수의 상한(maxDecimals)을 적용하기 전 값으로 정한다.
            // 상한을 따르면 저가 종목의 작은 값이 0 으로 뭉개진다
            priceDecimals: () => this.measuredDecimals,
        };
        const instances = this.indicatorConfigs.map(config => createIndicator(config, this.candles, context));
        this.paneIndicators = instances.filter(instance => instance.placement === 'pane');
        this.paneKeys = this.indicatorConfigs
            .filter((_, order) => instances[order].placement === 'pane')
            .map(config => config.key ?? config.type);
        const overlays = instances.filter((instance): instance is OverlayIndicator => instance.placement !== 'pane');
        this.priceOverlays = overlays.filter(overlay => overlay.placement === 'price');
        this.volumeOverlays = overlays.filter(overlay => overlay.placement === 'volume');
    }

    // ---------- 입력 ----------

    private localPoint(event: MouseEvent): Point {
        // 그림의 원점은 캔버스를 당긴 만큼(pixelShift) 컨테이너보다 왼쪽·위에 있다.
        const rect = this.container.getBoundingClientRect();
        return {x: event.clientX - rect.left + this.pixelShift.x, y: event.clientY - rect.top + this.pixelShift.y};
    }

    private readonly handlePointerDown = (event: PointerEvent) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        const point = this.localPoint(event);
        this.container.focus({preventScroll: true});

        const idle = this.activePointers.size === 0 && this.editPointerId === null && this.scaleDrag === null
            && this.paneDrag === null && this.priceLineDrag === null;

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

        // 끌 수 있는 가격선(목표가) 위를 눌렀으면 그 선을 위아래로 옮긴다. 그린 도형이 겹쳐 있으면 도형이 먼저다.
        const priceLine = idle ? this.priceLineAt(point) : null;
        if (priceLine?.id) {
            this.priceLineDrag = {
                pointerId: event.pointerId, id: priceLine.id, startY: point.y, price: priceLine.price, moved: false,
            };
            this.container.setPointerCapture(event.pointerId);
            this.pointer = point;
            this.updateCursor();
            this.scheduleOverlay();
            return;
        }

        this.activePointers.set(event.pointerId, point);
        this.container.setPointerCapture(event.pointerId);
        this.beginGesture(event.pointerType === 'touch');
        if (event.pointerType === 'touch') {
            // 손가락은 누르자마자 십자선을 띄우지 않는다. 움직이지 않고 누르고 있으면 그때 띄우고,
            // 그 뒤로는 손가락을 따라 십자선만 움직인다(차트는 그대로). 그냥 끌면 차트가 이동한다.
            window.clearTimeout(this.longPressTimer);
            if (this.activePointers.size === 1) {
                this.longPressTimer = window.setTimeout(() => this.beginTouchCrosshair(event.pointerId), LONG_PRESS_MS);
            } else {
                this.pointer = null;
            }
        } else {
            this.pointer = this.activePointers.size === 1 ? point : null;
        }
        this.scheduleOverlay();
    };

    /** 길게 누른 손가락이 그대로 있으면 그 자리에 십자선을 띄우고, 손을 뗄 때까지 십자선을 옮기는 동작으로 바꾼다. */
    private beginTouchCrosshair(pointerId: number) {
        const point = this.activePointers.get(pointerId);
        const gesture = this.gesture;
        if (!point || this.activePointers.size !== 1 || gesture?.type !== 'pan' || gesture.moved) return;
        this.gesture = {type: 'crosshair'};
        this.pointer = point;
        this.scheduleOverlay();
    }

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
        if (event.pointerId === this.priceLineDrag?.pointerId) {
            const drag = this.priceLineDrag;
            const pane = this.layout?.panes[0];
            this.pointer = point;
            if (pane && (drag.moved || Math.abs(point.y - drag.startY) >= DRAG_THRESHOLD)) {
                drag.moved = true;
                // 가격 영역 안에서만, 캔들 가격의 자릿수로 맞춘다(주식이면 원 단위).
                const y = clamp(point.y, pane.top, pane.bottom);
                const price = Number(paneToValue(pane)(y).toFixed(this.valueDecimals));
                if (price > 0) drag.price = price;
            }
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
            // 누르면 잡힐 가격선을 강조한다. 그린 도형이 겹쳐 있으면 도형이 잡히므로 강조하지 않는다.
            this.hoverPriceLine(this.drawingLayer.isOver(point) ? null : this.priceLineAt(point)?.id ?? null);
            this.scheduleOverlay();
            return;
        }

        this.activePointers.set(event.pointerId, point);
        const changed = this.applyGesture();
        if (event.pointerType !== 'touch' || this.gesture?.type === 'crosshair') {
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
        if (event.pointerId === this.priceLineDrag?.pointerId) {
            const {id, price, moved} = this.priceLineDrag;
            this.priceLineDrag = null;
            if (this.container.hasPointerCapture(event.pointerId)) {
                this.container.releasePointerCapture(event.pointerId);
            }
            this.updateCursor();
            this.scheduleDraw();
            // 끌다가 취소된 것(pointercancel)은 알리지 않는다.
            if (moved && event.type === 'pointerup') this.onPriceLineMove?.(id, price);
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
        window.clearTimeout(this.longPressTimer);
        // 손가락으로 짧게 누르고 떼면 떠 있던 십자선을 지운다. (길게 눌러 띄운 십자선은 손을 떼도 남는다.)
        if (event.pointerType === 'touch' && event.type === 'pointerup' && this.gesture?.type === 'pan' && !this.gesture.moved) {
            this.pointer = null;
            this.scheduleOverlay();
        }
        // 손가락 하나가 남았으면 그 자리에서 드래그를 이어 간다.
        this.beginGesture(event.pointerType === 'touch');
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
                : {target: 'indicator', key: boundary.key, height: null};
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
     * 그리기 도구를 고른 동안에는 아무 메뉴도 띄우지 않는다. 터치의 길게 누르기는 십자선을 띄우는 데 쓰므로
     * 브라우저의 메뉴만 막고 차트의 메뉴는 띄우지 않는다.
     */
    private readonly handleContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        if ((event as PointerEvent).pointerType === 'touch') return;
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
            priceScaled: this.priceAdjusted(),
        });
    };

    /** 가격축을 손으로 맞춰 둔 상태인지 (세로 배율을 바꿨거나 위아래로 옮겼거나) */
    private priceAdjusted(): boolean {
        return this.priceZoom !== 1 || this.priceShift !== 0;
    }

    /** 마지막 캔들 뒤까지 값이 있는 가격 영역 지표가 차지하는 칸 수 (일목균형표의 선행스팬) */
    private futureBars(): number {
        this.ensureSeries();
        const longest = this.priceOverlays.reduce(
            (most, overlay) => overlay.series.reduce((length, series) => Math.max(length, series.length), most), 0,
        );
        return Math.max(0, longest - this.candles.length);
    }

    /** 손가락으로 십자선을 옮기는 동안에는 페이지가 세로로 스크롤되지 않게 막는다. */
    private readonly handleTouchMove = (event: TouchEvent) => {
        if (this.gesture?.type === 'crosshair' && event.cancelable) event.preventDefault();
    };

    /**
     * 손가락으로 경계를 잡았으면 페이지가 세로로 스크롤되지 않게 막는다.
     * (세로 스크롤은 브라우저에 맡겨 두었으므로, 막지 않으면 끌기가 중간에 끊긴다.)
     */
    private readonly handleTouchStart = (event: TouchEvent) => {
        if (event.touches.length !== 1 || !event.cancelable) return;
        const rect = this.container.getBoundingClientRect();
        const touch = event.touches[0];
        const point = {x: touch.clientX - rect.left + this.pixelShift.x, y: touch.clientY - rect.top + this.pixelShift.y};
        if (this.boundaryAt(point, true) || this.priceLineAt(point, true)) event.preventDefault();
    };

    /**
     * point 가 놓인, 끌 수 있는 가격선(id 가 있는 것). 가격 영역의 그림 안에서만 잡는다.
     * 그리기 도구를 고른 동안에는 잡지 않는다.
     */
    private priceLineAt(point: Point, touch = false): PriceLine | null {
        const pane = this.layout?.panes[0];
        if (!pane || this.drawingLayer.activeTool || !this.isInPricePane(point)) return null;
        const toY = paneToY(pane);
        const reach = touch ? BOUNDARY_TOUCH_REACH : BOUNDARY_REACH;
        const nearest = this.priceLines
            .filter(priceLine => priceLine.id !== undefined)
            .map(priceLine => ({priceLine, distance: Math.abs(point.y - toY(priceLine.price))}))
            .filter(({distance}) => distance <= reach)
            .sort((a, b) => a.distance - b.distance)[0];
        return nearest?.priceLine ?? null;
    }

    // ---------- 영역 크기 ----------

    /** 별도 영역 지표들의 높이. paneIndicators 와 같은 순서 */
    private indicatorHeights(): number[] {
        return this.paneKeys.map(key => this.paneSizes.indicators?.[key] ?? INDICATOR_PANE_HEIGHT);
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
        if (!layout || this.drawingLayer.activeTool || layout.panes.length !== this.paneKeys.length + 2) return null;
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
                boundary: {target: 'indicator' as const, key: this.paneKeys[order], start: heights[order]},
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
        return {target: 'indicator', key: boundary.key, height};
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
                indicators: {...this.paneSizes.indicators, [change.key]: change.height ?? undefined},
            };
        }
    }

    /** 가격 영역 오른쪽의 가격축 위인지 */
    private isOnPriceAxis(point: Point): boolean {
        const pane = this.layout?.panes[0];
        return Boolean(this.layout && pane)
            && point.x >= this.layout!.plotWidth && point.y >= pane!.top && point.y <= pane!.bottom;
    }

    /** 마우스가 올라간 가격선이 바뀌면 다시 그린다. */
    private hoverPriceLine(id: string | null) {
        if (id === this.hoveredPriceLine) return;
        this.hoveredPriceLine = id;
        this.scheduleDraw();
    }

    /** 가격 영역의 그림 안인지 (가격축 제외) */
    private isInPricePane(point: Point): boolean {
        const pane = this.layout?.panes[0];
        return Boolean(this.layout && pane)
            && point.x < this.layout!.plotWidth && point.y >= pane!.top && point.y <= pane!.bottom;
    }

    private readonly handlePointerLeave =(event: PointerEvent) => {
        // 터치는 손을 떼도 십자선을 남겨 값을 읽을 수 있게 한다.
        if (event.pointerType === 'touch') return;
        this.hovered = false;
        this.hoverPriceLine(null);
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
    private beginGesture(touch = false) {
        const points = [...this.activePointers.values()];
        const view = this.resolveView();
        if (points.length === 1) {
            this.gesture = {
                type: 'pan',
                startX: points[0].x,
                startY: points[0].y,
                startRightEdge: view.rightEdge,
                startShift: this.priceShift,
                // 가격축을 손으로 맞춰 둔 상태에서 가격 영역을 마우스로 끌 때만 위아래로도 옮긴다.
                // 손가락의 세로 끌기는 페이지 스크롤이라 받지 않는다.
                vertical: !touch && this.priceAdjusted() && this.isInPricePane(points[0]),
                moved: false,
            };
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
            const deltaY = gesture.vertical ? points[0].y - gesture.startY : 0;
            if (!gesture.moved && Math.abs(delta) < DRAG_THRESHOLD && Math.abs(deltaY) < DRAG_THRESHOLD) return false;
            gesture.moved = true;
            const pane = this.layout?.panes[0];
            if (gesture.vertical && pane) {
                // 아래로 끌면 캔들이 따라 내려오도록 가격 범위를 위로 옮긴다.
                const scaleHeight = Math.max(1, pane.scaleBottom - pane.scaleTop);
                this.priceShift = clamp(gesture.startShift + deltaY / scaleHeight, -MAX_PRICE_SHIFT, MAX_PRICE_SHIFT);
            }
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
            : this.priceLineDrag ? 'ns-resize'
            : this.gesture ? 'grabbing'
            : hover && this.boundaryAt(hover, false) ? 'row-resize'
            : hover && this.isOnPriceAxis(hover) ? 'ns-resize'
            : this.drawingLayer.activeTool ? 'crosshair'
            : hover && this.drawingLayer.isOver(hover) ? 'pointer'
            : hover && this.priceLineAt(hover) ? 'ns-resize'
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
        const measured = recent.reduce((most, candle) => Math.max(
            most, decimalsOf(candle.open), decimalsOf(candle.high), decimalsOf(candle.low), decimalsOf(candle.close),
        ), 0);
        this.measuredDecimals = measured;
        this.valueDecimals = this.maxDecimals === null ? measured : Math.min(measured, this.maxDecimals);
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
            : defaultView(this.candles.length, this.plotWidth(), this.futureBars());
    }

    /** 사용자의 확대·이동을 보기에 반영하고, 연동한 차트들에 알린다. */
    private setView(view: View) {
        const plotWidth = this.plotWidth();
        const next = clampView(view, this.candles.length, plotWidth);
        this.view = next;
        this.scheduleDraw();
        if (this.onViewMove && this.candles.length > 0) {
            const bars = plotWidth / next.spacing;
            this.onViewMove({
                left: this.edgeOf(next.rightEdge - bars),
                right: this.edgeOf(next.rightEdge),
                // 최근으로 이동 버튼과 같은 기준으로, 마지막 캔들이 반 칸 넘게 보이면 최근까지 보는 것으로 본다
                latest: next.rightEdge >= this.candles.length - 0.5,
                blank: Math.max(0, next.rightEdge - this.candles.length) / bars,
            });
        }
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
        if (this.frame || this.destroyed) return;
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
        if (this.width > 0) this.alignToPixels(this.mainPainter.dpr);
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
        if (this.overlayFrame || this.frame || this.destroyed) return;
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
        this.ensureSeries();
        this.updateAxisWidth(style);
        const drag = this.priceLineDrag;

        return renderMain(this.mainPainter, {
            candles: this.candles,
            chartType: this.chartType,
            shapes: this.shapes,
            logScale: this.logScale,
            // 비교 종목은 등락률로만 견줄 수 있으므로, 있는 동안에는 설정과 상관없이 퍼센트 축으로 그린다.
            percentScale: this.percentScale || this.comparisons.length > 0,
            priceZoom: this.priceZoom,
            priceShift: this.priceShift,
            timeUnit: this.timeUnit,
            style,
            width: this.width,
            mainHeight: this.mainHeight(),
            volumeRatio: this.paneSizes.volumeRatio ?? VOLUME_RATIO,
            indicatorHeights: this.indicatorHeights(),
            range: visibleRange(this.resolveView(), this.candles.length, this.plotWidth()),
            averages: this.averages,
            averageColors: this.averageColors,
            averageStrokes: this.averageStrokes,
            indicators: this.paneIndicators,
            priceOverlays: this.priceOverlays,
            volumeOverlays: this.volumeOverlays,
            // 끌고 있는 가격선은 끌어다 놓은 가격에 그린다.
            priceLines: drag
                ? this.priceLines.map(priceLine => priceLine.id === drag.id ? {...priceLine, price: drag.price} : priceLine)
                : this.priceLines,
            activePriceLine: drag?.id ?? this.hoveredPriceLine,
            tradeMarks: [...this.tradeMarkersByIndex].flatMap(([index, markers]) => markers.map(({side}) => ({index, side}))),
            comparisons: this.comparisons.map(({color}, order) => ({closes: this.comparisonCloses[order] ?? [], color})),
            flatByPrevClose: this.flatByPrevClose,
            grid: this.grid,
            sessionDay: this.sessionDay,
            axisWidth: this.axisWidth,
            valueDecimals: this.valueDecimals,
            extremePrefix: this.extremePrefix,
            countdown: this.countdownText,
        });
    }

    /** 위 장: 그린 도형 → 십자선 → 값 표시 */
    private drawOverlay() {
        const painter = this.overlayPainter;
        painter.ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        const {layout, style} = this;
        if (!layout || !style) return;
        // 값 표시가 이동평균·비교 종목 값을 읽는다.
        this.ensureSeries();

        painter.useFont(style);
        this.drawingLayer.render(painter, layout, style);

        // 마우스가 가리키는 캔들이 없으면 다른 차트에서 옮겨 온 십자선의 캔들을, 그것도 없으면 가장 최근 캔들의 값을 보여 준다.
        const pointer = this.capturing ? null : this.pointer;
        const pointed = drawCrosshair(
            painter, layout, style, pointer, this.candles, this.timeUnit, steps => this.futureTimeAt(steps),
        );
        if (!this.capturing) this.shareCrosshair(pointed, layout);
        const linked = pointed === null && !this.capturing ? this.drawLinked(layout, style) : null;
        const index = pointed ?? linked ?? this.candles.length - 1;
        const candle = this.candles[index];
        if (candle) {
            drawCandleLegend(
                painter, layout, style, candle,
                textColorOf(style, candleColor(this.candles, index, style, this.flatByPrevClose)),
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

        // 십자선이 매매가 있는 캔들에 오면 그 내역을 마우스 옆에 적는다. 매수는 상승색, 매도는 하락색.
        const markers = pointed === null ? undefined : this.tradeMarkersByIndex.get(pointed);
        if (markers && pointer) {
            drawTradeTooltip(painter, layout, style, pointer, markers.flatMap(({side, lines}) => {
                const color = textColorOf(style, side === 'buy' ? style.upColor : style.downColor);
                return lines.map(text => ({text, color}));
            }));
        }
    }

    /**
     * 이 차트의 십자선이 가리키는 캔들·가격이 바뀌었으면 알린다. 가격은 가격 영역 안을 가리킬 때만 적는다.
     * 사라진 것은 늘 알리고, 새 자리는 사용자가 가리키는 중일 때만 알린다. 남은 십자선이 실시간 체결로 가격축이 움직여
     * 다른 자리를 가리키게 되어도 다른 차트의 연동을 빼앗지 않게 한다.
     */
    private shareCrosshair(pointed: number | null, layout: Layout) {
        if (pointed !== null && !this.isPointing()) return;
        const candle = pointed === null ? undefined : this.candles[pointed];
        const pane = layout.panes[0];
        const pointer = this.pointer;
        const price = candle && pane && pointer && pointer.y >= pane.top && pointer.y <= pane.bottom
            ? paneToValue(pane)(pointer.y)
            : null;
        const next: CrosshairPoint | null = candle ? {time: candle.time, price} : null;
        const previous = this.sharedCrosshair;
        if (previous === next || (previous && next && previous.time === next.time && previous.price === next.price)) return;
        this.sharedCrosshair = next;
        this.onCrosshairMove?.(next);
    }

    /** 다른 차트에서 옮겨 온 십자선을 그리고 그 캔들의 순번을 돌려준다. 그 캔들이 없거나 화면 밖이면 null */
    private drawLinked(layout: Layout, style: ChartStyle): number | null {
        const linked = this.linkedCrosshair;
        if (!linked || this.candles.length === 0) return null;
        const index = timeToIndex(this.candles, linked.time);
        if (this.candles[index].time !== linked.time) return null;
        return drawLinkedCrosshair(
            this.overlayPainter, layout, style, index, linked.price, this.candles, this.timeUnit,
        ) ? index : null;
    }
}
