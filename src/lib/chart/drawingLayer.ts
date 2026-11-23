import {
    Anchor, Candle, ChartStyle, Drawing, DrawingStyle, DrawingTool, FIBONACCI_DEFAULT_LEVELS, MagnetMode, MAX_DRAWINGS,
    TextRequest, TimeUnit,
} from "./types.ts";
import {AXIS_LABEL_OFFSET, AXIS_TAG_HEIGHT, AXIS_TAG_PADDING, DRAG_THRESHOLD} from "./constants.ts";
import {formatTime} from "./scale.ts";
import {clamp, distanceToSegment, Layout, Pane, paneToValue, paneToY, Point, tagCenterWithin} from "./layout.ts";
import {lineColor, Painter} from "./painter.ts";

// 사용자가 그리는 도형: 그리기, 선택, 옮기기, 지우기, 화면에 그리기
// 도형을 추가하려면 types.ts 의 Drawing 에 모양을 넣고, 여기의 geometryOf(화면에서의 선·손잡이·채움)와
// 만드는 과정(beginEdit·finishEdit), 옮기는 방법(moved)을 채운다. 백엔드의 저장 검증(ChartService)도 함께 고친다.

const HIT_TOLERANCE = 6;        // 선에서 이만큼 안쪽을 누르면 그 선을 잡은 것으로 본다
const HANDLE_SIZE = 7;          // 선택한 도형의 점에 그리는 손잡이 크기
const DRAFT_ID = 'draft';       // 그리는 중인 도형
const DEFAULT_COLOR = 4;        // 꾸미기를 정하지 않은 도형의 색 (style.lineColors 안에서의 순서)
const MAX_LINE_WIDTH = 3;
const DASH = [6, 4];
const FILL_ALPHA = 0.1;         // 사각형·채널 안쪽 채움
const RAY_LENGTH = 20000;       // 반직선을 화면 밖까지 뻗는 길이 (CSS px)
const MAGNET_DISTANCE = 12;     // 약한 자석: 캔들의 시가·고가·저가·종가가 이만큼 안에 있으면 그 값에 붙는다 (CSS px)
const TEXT_SIZES = [12, 15, 19];    // 글자 도형의 크기. 꾸미기의 굵기 1~3 에 차례로 대응한다 (CSS px)
const TEXT_LINE_HEIGHT = 1.3;   // 여러 줄 글자의 줄 간격 (글자 크기의 배수)
const TEXT_PADDING = 3;        // 글자를 잡을 수 있는 범위를 글자보다 이만큼 넓힌다
const LABEL_GAP = 2;            // 선과 그 위에 적는 글자 사이
const GUIDE_ALPHA = 0.5;        // 보조선(피보나치의 두 점을 잇는 선)의 진하기
const BACKDROP_ALPHA = 0.85;    // 글자 뒤에 까는 바탕의 진하기
// 복제한 도형을 원래 것에서 비켜 놓는 정도: 오른쪽으로 캔들 몇 칸, 아래로 몇 px
const COPY_SHIFT_BARS = 2;
const COPY_SHIFT_Y = 16;

/** 두 점 이상으로 만드는 도형. 한 번 눌러 끝나는 수평선·수직선·글자는 여기에 없다. */
type PointTool = 'trend' | 'ray' | 'rectangle' | 'channel' | 'fibonacci' | 'measure';

/** 도형에서 잡을 수 있는 부분: 전체, 또는 점 하나 */
type Part = 'body' | 'from' | 'to' | 'third';

/**
 * 그리는 중인 도형. origin 은 첫 점을 누른 화면 위치.
 * 평행 채널은 두 점을 정한 뒤(stage 2) 한 번 더 눌러 맞은편 선의 자리(third)를 정한다.
 */
interface Draft {
    type: PointTool,
    from: Anchor,
    to: Anchor,
    third: Anchor | null,
    origin: Point,
    stage: 1 | 2,
    thirdPlaced: boolean,
}

/** 이미 그린 도형을 끌어 옮기는 중 */
interface Move {
    part: Part,
    start: Point,
    original: Drawing,
    changed: boolean,
}

/** 도형이 화면에 놓인 모양 (CSS px) */
interface Geometry {
    lines: [Point, Point][],            // 그릴 선분들. 잡는 판정에도 쓴다
    handles: [Part, Point][],           // 끌어서 옮길 수 있는 점
    fill: Point[] | null,               // 옅게 채울 영역의 꼭짓점
    guides?: [Point, Point][],          // 옅은 점선으로 긋는 보조선. 잡는 판정에도 쓴다
    labels?: Label[],                   // 도형에 함께 적는 글자
    box?: Box,                          // 이 안을 누르면 도형을 잡은 것으로 본다 (글자 도형)
}

interface Label {
    at: Point,
    text: string,
    align: 'left' | 'center',
    baseline: 'bottom' | 'middle',
    backdrop: boolean,      // 캔들에 묻히지 않게 글자 뒤에 바탕을 깔지
}

interface Box {
    left: number,
    top: number,
    right: number,
    bottom: number,
}

/** 도형 계층이 엔진에서 읽어 오는 것과 엔진에 알리는 것 */
export interface DrawingHost {
    layout: () => Layout | null,    // 마지막으로 그린 배치
    candles: () => Candle[],
    hasOlder: () => boolean,        // 더 받을 과거 구간이 남아 있는지
    timeUnit: () => TimeUnit,       // 수직선의 날짜 라벨 표기 단위
    // index 번째 캔들 자리에서 가격 영역에 그려진 선들의 값(이동평균선, 볼린저밴드 등). 자석이 지표 선에 붙을 때 쓴다
    lineValues: (index: number) => number[],
    redraw: () => void,            // 위 장을 다시 그려 달라고 요청
    refreshCursor: () => void,      // 도구 상태가 바뀌어 마우스 커서를 다시 정해야 함
    drawingsChanged: (drawings: Drawing[]) => void,     // 사용자가 추가·변경·삭제함
    toolReleased: () => void,       // 하나를 다 그렸거나 취소해서 도구가 풀림
    selectionChanged: (id: string | null) => void,
    textRequested: (request: TextRequest) => void,      // 글자를 입력받아 달라고 요청
    limitReached: () => void,       // 도형이 이미 MAX_DRAWINGS 개라 더 넣지 못함
    beforeRangeBlocked: () => void, // 받아 둔 캔들보다 앞선 점이 있는 도형이라 복제하지 못함
}

/** 글자 도형의 크기 (CSS px) */
const textSizeOf = (drawing: DrawingStyle): number =>
    TEXT_SIZES[clamp(Math.round(drawing.lineWidth ?? 1), 1, TEXT_SIZES.length) - 1];

/** 글자 도형의 줄들. 줄 바꿈으로 나눈다 */
const textLinesOf = (text: string): string[] => text.split('\n');

const createId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** 시각이 time 인 캔들의 순번. 꼭 맞는 캔들이 없으면(주기가 바뀐 경우) 그 직전 캔들 */
const timeToIndex = (candles: Candle[], time: number): number => {
    let low = 0;
    let high = candles.length - 1;
    while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (candles[middle].time <= time) low = middle;
        else high = middle - 1;
    }
    return low;
};

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export class DrawingLayer {
    private readonly host: DrawingHost;
    private drawings: Drawing[] = [];
    private tool: DrawingTool | null = null;        // 고른 도구. null 이면 선택·이동 상태
    private selectedId: string | null = null;
    private draft: Draft | null = null;
    private move: Move | null = null;
    private newStyle: DrawingStyle = {};            // 새로 그리는 도형에 입힐 꾸미기
    private newLevels: number[] | null = null;      // 새로 그리는 피보나치 되돌림에 쓸 비율. null 이면 기본 비율
    private magnet: MagnetMode = 'off';             // 점을 캔들의 시가·고가·저가·종가에 붙이는 정도
    private magnetIndicators = false;               // 자석을 가격 영역의 지표 선에도 붙일지
    private textSpot: Anchor | null = null;         // 글자 도구로 누른 자리. 손을 떼면 이 자리에 입력을 요청한다
    private textWidths = new Map<string, number>(); // 글자 도형의 너비(CSS px). 그릴 때 재 두고 잡는 판정에 쓴다

    constructor(host: DrawingHost) {
        this.host = host;
    }

    get activeTool(): DrawingTool | null {
        return this.tool;
    }

    get hasSelection(): boolean {
        return this.selectedId !== null;
    }

    /** 도형 목록을 통째로 바꾼다. (바깥에서 준 목록이라 변경을 알리지 않는다) */
    setDrawings(drawings: Drawing[]) {
        this.drawings = drawings;
        // 도형을 끌어 옮기는 중에 목록이 바뀌었으면(저장된 선의 조회가 끝남 등) 옮기던 것을 그만둔다.
        // 옮긴 결과는 손을 뗄 때 알리므로, 끄는 도중에 들어온 목록에는 옮기던 것이 들어 있지 않다.
        // 누르기만 하고 아직 움직이지 않았으면(글자 입력을 마치며 다른 도형을 누른 경우 등) 새 목록의 그 도형으로 이어 간다.
        const move = this.move;
        if (move) {
            const current = move.changed ? undefined
                : drawings.find(drawing => (
                    drawing.id === move.original.id && !drawing.hidden && !drawing.locked
                    && this.canMove(drawing, move.part)
                ));
            this.move = current ? {...move, original: current} : null;
        }
        // 선택한 도형이 지워졌거나 숨겨졌으면 선택을 푼다.
        this.dropUnseenSelection();
        this.host.redraw();
    }

    /** 캔들이 바뀌었을 때(주기 변경, 과거 구간이 붙음) 부른다. 그릴 자리가 없어진 도형은 선택을 푼다. */
    candlesChanged() {
        this.dropUnseenSelection();
    }

    /** 선택한 도형이 지워졌거나 숨겨졌거나 그릴 자리가 없으면 선택을 푼다. 보이지 않는 도형이 지워지거나 바뀌지 않게 한다. */
    private dropUnseenSelection() {
        const selectedId = this.selectedId;
        if (!selectedId) return;
        const selected = this.drawings.find(drawing => drawing.id === selectedId);
        if (!selected || selected.hidden || this.isBeforeRange(selected)) this.select(null);
    }

    /** 그리기 도구를 고른다. null 이면 선택·이동 상태로 돌아간다. */
    setTool(tool: DrawingTool | null) {
        this.tool = tool;
        this.draft = null;
        this.textSpot = null;
        if (tool) this.select(null);
        this.host.refreshCursor();
        this.host.redraw();
    }

    /** 새로 그리는 도형에 입힐 꾸미기 (색·굵기·점선) */
    setNewStyle(style: DrawingStyle) {
        this.newStyle = style;
    }

    /** 새로 그리는 피보나치 되돌림에 쓸 비율. null 이면 기본 비율 */
    setNewLevels(levels: number[] | null) {
        this.newLevels = levels;
    }

    /**
     * 자석: 점을 놓거나 고칠 때 캔들 값(시가·고가·저가·종가)에 붙이는 정도.
     * indicators 가 true 면 가격 영역에 그려진 지표 선의 값에도 붙는다.
     */
    setMagnet(mode: MagnetMode, indicators: boolean) {
        this.magnet = mode;
        this.magnetIndicators = indicators;
    }

    /** 이번 동작에 쓸 자석. invert(Ctrl·⌘를 누르는 중)면 반대로: 꺼져 있으면 약하게 켜고, 켜져 있으면 끈다. */
    private magnetFor(invert: boolean): MagnetMode {
        if (!invert) return this.magnet;
        return this.magnet === 'off' ? 'weak' : 'off';
    }

    /** 입력받은 글자를 anchor 자리에 도형으로 넣는다. */
    addText(anchor: Anchor, text: string) {
        if (this.isFull()) return;
        this.changeDrawings([...this.drawings, {...this.newStyle, type: 'text', from: anchor, text, id: createId()}]);
    }

    /** 이미 있는 글자 도형을 고칠 수 있게 입력을 요청한다. */
    requestTextEdit(id: string) {
        const layout = this.host.layout();
        const drawing = this.drawings.find(item => item.id === id);
        if (!layout || drawing?.type !== 'text') return;
        this.host.textRequested({id, text: drawing.text, anchor: drawing.from, ...this.pointOf(drawing.from, layout)});
    }

    /** 화면 위치에 글자 도형이 있으면 고치기를 요청한다(더블클릭). 요청했으면 true */
    editTextAt(point: Point): boolean {
        const hit = this.hitTest(point);
        if (hit?.drawing.type !== 'text') return false;
        this.requestTextEdit(hit.drawing.id);
        return true;
    }

    /** Esc: 그리던 것을 취소하고, 그리는 중이 아니면 선택을 푼다. */
    cancel() {
        if (this.tool || this.draft) this.releaseTool();
        else this.select(null);
        this.host.redraw();
    }

    /** 선택한 도형을 지운다. 잠근 도형은 지우지 않는다. */
    deleteSelected() {
        const selectedId = this.selectedId;
        if (!selectedId || this.drawings.find(drawing => drawing.id === selectedId)?.locked) return;
        this.select(null);
        this.changeDrawings(this.drawings.filter(drawing => drawing.id !== selectedId));
    }

    /** 누르지 않은 채 움직일 때: 첫 점을 찍은 뒤라면 다음 점이 마우스를 따라온다. */
    hover(point: Point, invertMagnet: boolean) {
        const draft = this.draft;
        if (!draft) return;
        const anchor = this.anchorAt(point, true, this.magnetFor(invertMagnet));
        if (!anchor) return;
        if (draft.stage === 1) draft.to = anchor;
        else if (!draft.thirdPlaced) draft.third = anchor;
    }

    /** 화면 위치에 도형이 있는지 (마우스 커서 모양용) */
    isOver(point: Point): boolean {
        return this.hitTest(point) !== null;
    }

    /** 화면 위치에 도형이 있으면 그 도형을 선택하고 id 를 돌려준다. 없으면 선택을 그대로 두고 null (우클릭 메뉴용) */
    selectAt(point: Point): string | null {
        const id = this.hitTest(point)?.drawing.id ?? null;
        if (id) this.select(id);
        return id;
    }

    /**
     * 도형을 하나 더 만든다. 원래 것과 겹치지 않게 오른쪽 아래로 조금 비켜 놓고, 새 도형을 선택한다.
     * 잠금은 따라가지 않는다(바로 옮길 수 있어야 하므로).
     */
    duplicate(id: string) {
        const layout = this.host.layout();
        const original = this.drawings.find(drawing => drawing.id === id);
        if (!layout || !original || this.isFull()) return;
        // 받아 둔 캔들보다 앞선 점은 제자리를 알 수 없어, 비켜 놓을 자리를 정하지 못한다.
        if (!this.canMove(original, 'body')) {
            this.host.beforeRangeBlocked();
            return;
        }
        const pane = layout.panes[0];
        const toY = paneToY(pane);
        const toPrice = paneToValue(pane);
        const lower = (price: number) => toPrice(toY(price) + COPY_SHIFT_Y);
        const shift = (anchor: Anchor): Anchor => this.anchorOf(this.indexOf(anchor) + COPY_SHIFT_BARS, lower(anchor.price));
        const base = {...original, id: createId(), locked: null};
        const copy: Drawing = base.type === 'horizontal' ? {...base, price: lower(base.price)}
            : base.type === 'vertical' ? {...base, ...this.columnOf(this.indexOf(base) + COPY_SHIFT_BARS)}
            : base.type === 'text' ? {...base, from: shift(base.from)}
            : base.type === 'channel' ? {...base, from: shift(base.from), to: shift(base.to), third: shift(base.third)}
            : {...base, from: shift(base.from), to: shift(base.to)};
        this.changeDrawings([...this.drawings, copy]);
        this.select(copy.id);
    }

    /** 도구를 고르지 않고 정해진 가격에 수평선을 긋는다. (우클릭 메뉴용) */
    addHorizontal(price: number) {
        this.add({type: 'horizontal', price});
    }

    /** 누른 자리에서 그리기나 옮기기를 시작한다. 시작했으면 true, 아니면(빈 곳) false 로 차트 이동에 넘긴다. */
    beginEdit(point: Point, invertMagnet: boolean): boolean {
        const tool = this.tool;
        if (tool) {
            const anchor = this.anchorAt(point, false, this.magnetFor(invertMagnet));
            if (!anchor) return false;
            const draft = this.draft;
            // 더 넣을 수 없으면 그리기를 시작하지 않는다. (누른 것은 받은 것으로 해서 차트가 끌려가지 않게 한다)
            if (!draft && this.isFull()) return true;
            if (tool === 'horizontal') {
                // 수평선·수직선은 누른 자리에 바로 긋는다.
                this.add({type: 'horizontal', price: anchor.price});
            } else if (tool === 'vertical') {
                this.add({type: 'vertical', time: anchor.time, offset: anchor.offset});
            } else if (tool === 'text') {
                // 입력 칸은 손을 뗀 뒤에 띄운다. 누르는 순간에 띄우면 차트가 포커스를 가져가 입력 칸이 바로 닫힌다.
                this.textSpot = anchor;
            } else if (!draft) {
                this.draft = {
                    type: tool, from: anchor, to: anchor, third: null, origin: point, stage: 1, thirdPlaced: false,
                };
            } else if (draft.stage === 1) {
                // 첫 점을 찍어 둔 상태: 이번에 누른 자리가 둘째 점
                draft.to = anchor;
            } else {
                // 평행 채널: 맞은편 선의 자리
                draft.third = anchor;
                draft.thirdPlaced = true;
            }
            return true;
        }

        const hit = this.hitTest(point);
        if (!hit) {
            this.select(null);
            return false;
        }
        this.select(hit.drawing.id);
        // 잠근 도형은 선택만 하고 옮기지 않는다. 끌면 차트가 이동한다.
        // 받아 둔 캔들보다 앞선 점이 걸린 옮기기도 마찬가지다(그 점의 시각이 첫 캔들의 시각으로 바뀌어 버린다).
        if (hit.drawing.locked || !this.canMove(hit.drawing, hit.part)) return false;
        this.move = {part: hit.part, start: point, original: hit.drawing, changed: false};
        return true;
    }

    /** 누른 채 움직이는 동안: 그리는 도형의 점을 옮기거나, 잡은 도형을 옮긴다. */
    updateEdit(point: Point, invertMagnet: boolean) {
        const draft = this.draft;
        const move = this.move;
        // 도형 전체를 옮길 때는 자석을 쓰지 않는다. 잡은 자리만 붙으면 나머지 점이 어디에 놓일지 알기 어렵기 때문이다.
        // 수평선은 옮기는 것이 곧 가격을 고치는 것이라 붙인다.
        const snap = draft !== null || move?.part !== 'body' || move.original.type === 'horizontal';
        const target = this.anchorAt(point, true, snap ? this.magnetFor(invertMagnet) : 'off');
        if (!target) return;
        if (draft) {
            if (draft.stage === 1) draft.to = target;
            else draft.third = target;
            return;
        }
        if (!move) return;
        if (!move.changed && distance(point, move.start) < DRAG_THRESHOLD) return;

        const start = this.anchorAt(move.start, true, 'off');
        if (!start) return;
        const next = this.moved(move.original, move.part, start, target);
        move.changed = true;
        this.drawings = this.drawings.map(drawing => drawing.id === next.id ? next : drawing);
    }

    /** 손을 뗐을 때: 그리던 도형을 다음 단계로 넘기거나 확정하고, 옮긴 결과를 알린다. */
    finishEdit(point: Point) {
        const textSpot = this.textSpot;
        const layout = this.host.layout();
        if (textSpot) {
            this.releaseTool();
            if (layout) this.host.textRequested({id: null, text: '', anchor: textSpot, ...this.pointOf(textSpot, layout)});
            return;
        }
        const draft = this.draft;
        if (draft) {
            if (draft.stage === 1) {
                // 끌어서 그렸으면 둘째 점까지 정해진 것. 제자리에서 뗐으면 첫 점만 찍힌 상태로 두고 다음 누름을 둘째 점으로 받는다.
                if (distance(point, draft.origin) < DRAG_THRESHOLD) return;
                if (draft.type === 'channel') {
                    draft.stage = 2;
                    draft.third = draft.to;
                } else {
                    this.add({type: draft.type, from: draft.from, to: draft.to});
                }
            } else if (draft.thirdPlaced && draft.third) {
                this.add({type: 'channel', from: draft.from, to: draft.to, third: draft.third});
            }
            return;
        }
        if (this.move?.changed) this.host.drawingsChanged(this.drawings);
        this.move = null;
    }

    /**
     * 그린 도형들을 위 장에 그린다. 가격 영역 밖으로는 나가지 않는다.
     * 수직선만 아래 영역(거래량·보조지표)까지 긋고 날짜축에 날짜를 적는다. 숨긴 도형은 그리지 않는다.
     */
    render(painter: Painter, layout: Layout, style: ChartStyle) {
        const draft = this.draft;
        const shown = this.drawings.filter(drawing => !drawing.hidden && !this.isBeforeRange(drawing));
        const drawings: Drawing[] = draft ? [...shown, this.created(this.draftShape(draft), DRAFT_ID)] : shown;
        if (drawings.length === 0) return;

        const ctx = painter.ctx;
        const pane = layout.panes[0];
        const toY = paneToY(pane);
        const line = painter.lineWidth();
        const plotRightPx = painter.px(layout.plotWidth);
        const handle = painter.px(HANDLE_SIZE);
        const colorOf = (drawing: Drawing) => lineColor(style, drawing.color ?? DEFAULT_COLOR);

        // 글자 도형의 너비는 그릴 때만 잴 수 있어, 먼저 재 두고 자리 계산(geometryOf)과 잡는 판정에 쓴다.
        this.textWidths = new Map();
        drawings.forEach(drawing => {
            if (drawing.type !== 'text') return;
            ctx.font = `${painter.px(textSizeOf(drawing))}px ${style.fontFamily}`;
            // 여러 줄이면 가장 긴 줄의 너비
            const widest = Math.max(...textLinesOf(drawing.text).map(textLine => ctx.measureText(textLine).width));
            this.textWidths.set(drawing.id, widest / painter.dpr);
        });
        painter.useFont(style);

        const drawOne = (drawing: Drawing) => {
            const active = drawing.id === this.selectedId || drawing.id === DRAFT_ID;
            const geometry = this.geometryOf(drawing, layout);
            const color = colorOf(drawing);
            const width = Math.max(1, Math.round(clamp(drawing.lineWidth ?? 1, 1, MAX_LINE_WIDTH) * painter.dpr));
            ctx.strokeStyle = color;
            ctx.fillStyle = color;

            if (geometry.fill) {
                ctx.beginPath();
                geometry.fill.forEach((corner, order) => {
                    if (order === 0) ctx.moveTo(corner.x * painter.dpr, corner.y * painter.dpr);
                    else ctx.lineTo(corner.x * painter.dpr, corner.y * painter.dpr);
                });
                ctx.closePath();
                ctx.globalAlpha = FILL_ALPHA;
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            // 선택했거나 그리는 중이면 한 단계 굵게
            ctx.lineWidth = active ? width + line : width;
            ctx.setLineDash(drawing.dashed ? DASH.map(length => painter.px(length)) : []);
            ctx.beginPath();
            geometry.lines.forEach(([start, end]) => {
                // 가로·세로로 곧은 선은 픽셀에 맞춰 흐려지지 않게 한다.
                const straight = start.x === end.x || start.y === end.y;
                const at = (value: number) => straight ? painter.px(value) + line / 2 : value * painter.dpr;
                ctx.moveTo(at(start.x), at(start.y));
                ctx.lineTo(at(end.x), at(end.y));
            });
            ctx.stroke();

            // 보조선: 가늘고 옅은 점선
            if (geometry.guides?.length) {
                ctx.lineWidth = line;
                ctx.setLineDash(DASH.map(length => painter.px(length)));
                ctx.globalAlpha = GUIDE_ALPHA;
                ctx.beginPath();
                geometry.guides.forEach(([start, end]) => {
                    ctx.moveTo(start.x * painter.dpr, start.y * painter.dpr);
                    ctx.lineTo(end.x * painter.dpr, end.y * painter.dpr);
                });
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            ctx.setLineDash([]);

            geometry.labels?.forEach(label => {
                const x = label.at.x * painter.dpr;
                const y = label.at.y * painter.dpr;
                ctx.textAlign = label.align;
                ctx.textBaseline = label.baseline;
                if (label.backdrop) {
                    const width = ctx.measureText(label.text).width + painter.px(TEXT_PADDING) * 2;
                    const height = painter.px(AXIS_TAG_HEIGHT);
                    ctx.fillStyle = style.backgroundColor;
                    ctx.globalAlpha = BACKDROP_ALPHA;
                    ctx.fillRect(Math.round(x - width / 2), Math.round(y - height / 2), Math.round(width), height);
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = color;
                }
                ctx.fillText(label.text, x, y);
            });
            ctx.textBaseline = 'middle';

            if (drawing.type === 'text' && geometry.box) {
                const {box} = geometry;
                ctx.textAlign = 'left';
                ctx.font = `${painter.px(textSizeOf(drawing))}px ${style.fontFamily}`;
                // 첫 줄의 가운데는 상자 위에서 여백 + 글자 높이의 반만큼 내려온 자리이고, 그 아래로 줄 간격만큼씩 내려간다.
                const size = textSizeOf(drawing);
                textLinesOf(drawing.text).forEach((textLine, order) => ctx.fillText(
                    textLine,
                    (box.left + TEXT_PADDING) * painter.dpr,
                    (box.top + TEXT_PADDING + size / 2 + order * size * TEXT_LINE_HEIGHT) * painter.dpr,
                ));
                painter.useFont(style);
                // 선택한 글자는 둘레에 점선 테두리를 친다.
                if (active) {
                    ctx.lineWidth = line;
                    ctx.setLineDash(DASH.map(length => painter.px(length)));
                    ctx.strokeRect(
                        painter.px(box.left) + line / 2, painter.px(box.top) + line / 2,
                        painter.px(box.right) - painter.px(box.left), painter.px(box.bottom) - painter.px(box.top),
                    );
                    ctx.setLineDash([]);
                }
            }

            // 잠근 도형은 점을 고칠 수 없으므로 손잡이를 그리지 않는다. 받아 둔 캔들보다 앞선 점도 마찬가지다.
            if (active && !drawing.locked) {
                geometry.handles.filter(([part]) => this.canMove(drawing, part)).forEach(([, point]) => {
                    ctx.fillRect(
                        Math.round(point.x * painter.dpr - handle / 2), Math.round(point.y * painter.dpr - handle / 2),
                        handle, handle,
                    );
                });
            }
        };
        /** 위에서 bottom 까지의 그림 영역 안에만 그려지게 하고 도형들을 그린다. */
        const drawWithin = (bottom: number, items: Drawing[]) => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, painter.px(pane.top), plotRightPx, painter.px(bottom) - painter.px(pane.top));
            ctx.clip();
            items.forEach(drawOne);
            ctx.restore();
        };
        const verticals = drawings.filter(drawing => drawing.type === 'vertical');
        drawWithin(pane.bottom, drawings.filter(drawing => drawing.type !== 'vertical'));
        drawWithin(layout.plotBottom, verticals);

        // 수평선은 오른쪽 축에 가격 라벨을 붙인다.
        const labelHeight = painter.px(AXIS_TAG_HEIGHT);
        const axisWidthPx = painter.px(layout.axisWidth);
        ctx.textAlign = 'left';
        ctx.lineWidth = line;
        drawings.forEach(drawing => {
            if (drawing.type !== 'horizontal' || drawing.price < pane.min || drawing.price > pane.max) return;
            const color = colorOf(drawing);
            // 선은 제자리에 두고 라벨만 그 영역 안으로 당긴다.
            const y = tagCenterWithin(
                painter.px(toY(drawing.price)), painter.px(pane.top), painter.px(pane.bottom), labelHeight,
            );
            const labelTop = Math.round(y - labelHeight / 2);
            ctx.fillStyle = style.backgroundColor;
            ctx.fillRect(plotRightPx, labelTop, axisWidthPx, labelHeight);
            ctx.strokeStyle = color;
            ctx.strokeRect(plotRightPx + line / 2, labelTop + line / 2, axisWidthPx - line, labelHeight - line);
            ctx.fillStyle = color;
            ctx.fillText((pane.axisFormat ?? pane.format)(drawing.price), plotRightPx + painter.px(AXIS_LABEL_OFFSET), y);
        });

        // 수직선은 아래 날짜축에 그 캔들의 날짜 라벨을 붙인다. 캔들이 없는 자리(미래 구간)와 화면 밖의 선에는 붙이지 않는다.
        const candles = this.host.candles();
        const timeUnit = this.host.timeUnit();
        const labelPadding = painter.px(AXIS_TAG_PADDING);
        const labelTop = painter.px(layout.plotBottom) + line;
        ctx.textAlign = 'center';
        verticals.forEach(drawing => {
            if (drawing.type !== 'vertical') return;
            const index = this.indexOf(drawing);
            const candle = candles[index];
            const x = painter.px(this.xOf(index, layout));
            if (!candle || x < 0 || x > plotRightPx) return;
            const color = colorOf(drawing);
            const text = formatTime(candle.time, timeUnit, true);
            const width = ctx.measureText(text).width + labelPadding * 2;
            // 그림 영역 밖으로 나가지 않게 밀어 넣는다.
            const left = Math.round(clamp(x - width / 2, 0, Math.max(0, plotRightPx - width)));
            ctx.fillStyle = style.backgroundColor;
            ctx.fillRect(left, labelTop, width, labelHeight);
            ctx.strokeStyle = color;
            ctx.strokeRect(left + line / 2, labelTop + line / 2, width - line, labelHeight - line);
            ctx.fillStyle = color;
            ctx.fillText(text, left + width / 2, labelTop + labelHeight / 2);
        });
        ctx.textAlign = 'left';
    }

    private select(id: string | null) {
        if (this.selectedId === id) return;
        this.selectedId = id;
        this.host.selectionChanged(id);
        this.host.redraw();
    }

    private changeDrawings(drawings: Drawing[]) {
        this.drawings = drawings;
        this.host.drawingsChanged(drawings);
        this.host.redraw();
    }

    /** 모양에 새 도형의 꾸미기(색·굵기·점선, 피보나치면 비율)를 입혀 도형으로 만든다. */
    private created(shape: DrawingShape, id: string): Drawing {
        const levels = shape.type === 'fibonacci' && this.newLevels ? {levels: this.newLevels} : {};
        return {...this.newStyle, ...shape, ...levels, id} as Drawing;
    }

    /** 다 그린 도형을 목록에 넣고 도구를 푼다. */
    private add(shape: DrawingShape) {
        if (this.isFull()) return;
        this.changeDrawings([...this.drawings, this.created(shape, createId())]);
        this.releaseTool();
    }

    /** 도형을 더 넣을 수 없는지. 넣을 수 없으면 고른 도구를 풀고 그 사실을 알린다. */
    private isFull(): boolean {
        if (this.drawings.length < MAX_DRAWINGS) return false;
        if (this.tool || this.draft) this.releaseTool();
        this.host.limitReached();
        return true;
    }

    /** 도형 하나를 다 그렸거나 취소했을 때 도구를 푼다. */
    private releaseTool() {
        this.tool = null;
        this.draft = null;
        this.textSpot = null;
        this.host.refreshCursor();
        this.host.toolReleased();
    }

    /** 그리는 중인 도형을 화면에 보일 모양으로 바꾼다. */
    private draftShape(draft: Draft): DrawingShape {
        return draft.type === 'channel'
            ? {type: 'channel', from: draft.from, to: draft.to, third: draft.third ?? draft.to}
            : {type: draft.type, from: draft.from, to: draft.to};
    }

    // ---------- 자리 계산 ----------

    // 받아 둔 캔들보다 앞선 시각의 점은 제자리를 알 수 없다(과거 구간을 더 받아 와야 안다. 분봉처럼 받아 둔 기간이
    // 짧은 주기로 바꿨을 때 흔하다). 순번으로는 첫 캔들 자리가 되므로, 그대로 그리거나 옮기면 엉뚱한 자리가 된다.
    // 그래서 점이 모두 앞서면 그리지 않고, 일부만 앞서면 그리되 그 점이 움직이는 옮기기와 복제를 막는다.
    // 더 받을 과거가 없으면(끝까지 받았거나 이어 받을 수 없는 차트) 기다려도 제자리가 생기지 않으므로,
    // 앞선 점으로 보지 않고 첫 캔들 자리에 놓는다.

    /** 도형에서 캔들 시각에 놓인 점들과, 그 점을 끄는 부분. 수평선에는 없다 */
    private timedSpots(drawing: Drawing): [Part, { time: number }][] {
        switch (drawing.type) {
            case 'horizontal':
                return [];
            case 'vertical':
                return [['body', drawing]];
            case 'text':
                return [['body', drawing.from]];
            case 'channel':
                return [['from', drawing.from], ['to', drawing.to], ['third', drawing.third]];
            default:
                return [['from', drawing.from], ['to', drawing.to]];
        }
    }

    /** 받아 둔 캔들보다 앞선 시각이고, 그 구간을 더 받아 올 수 있는지 */
    private isEarly(spot: { time: number }): boolean {
        const first = this.host.candles()[0];
        return first !== undefined && spot.time < first.time && this.host.hasOlder();
    }

    /** 도형의 점이 모두 받아 둔 캔들보다 앞서서, 그릴 자리가 없는지 */
    private isBeforeRange(drawing: Drawing): boolean {
        const spots = this.timedSpots(drawing);
        return spots.length > 0 && spots.every(([, spot]) => this.isEarly(spot));
    }

    /** 도형의 part 를 끌어 옮겨도 되는지. 전체(body)를 옮기면 모든 점이, 점 하나를 잡으면 그 점만 움직인다 */
    private canMove(drawing: Drawing, part: Part): boolean {
        const early = this.timedSpots(drawing).filter(([, spot]) => this.isEarly(spot));
        return part === 'body' ? early.length === 0 : !early.some(([earlyPart]) => earlyPart === part);
    }

    /** 점이 놓인 순번. 미래 구간의 점은 마지막 캔들 뒤의 순번이 된다. */
    private indexOf(spot: { time: number, offset?: number | null }): number {
        return timeToIndex(this.host.candles(), spot.time) + (spot.offset ?? 0);
    }

    /** 순번과 가격으로 점을 만든다. 마지막 캔들보다 뒤면 "마지막 캔들 + 몇 칸"으로 적는다. */
    private anchorOf(index: number, price: number): Anchor {
        const candles = this.host.candles();
        const last = candles.length - 1;
        const bounded = Math.max(0, Math.round(index));
        return bounded > last
            ? {time: candles[last].time, price, offset: bounded - last}
            : {time: candles[bounded].time, price};
    }

    /** 순번을 수직선이 놓이는 자리(캔들 시각, 미래 구간이면 몇 칸 뒤인지)로 바꾼다. */
    private columnOf(index: number): { time: number, offset: number | null } {
        const {time, offset} = this.anchorOf(index, 0);
        return {time, offset: offset ?? null};
    }

    /**
     * 화면 위치를 점(캔들 시각·가격)으로 바꾼다. 가로는 그 자리의 칸에 붙이고, 마지막 캔들 오른쪽이면 미래 구간의 점이 된다.
     * 가격 영역 밖이면 null. clampToPane 이면 영역 안으로 끌어와 계산한다(끄는 중에 영역을 벗어났을 때).
     */
    private anchorAt(point: Point, clampToPane: boolean, magnet: MagnetMode): Anchor | null {
        const layout = this.host.layout();
        const pane = layout?.panes[0];
        if (!layout || !pane || this.host.candles().length === 0) return null;
        const inside = point.x >= 0 && point.x < layout.plotWidth && point.y >= pane.top && point.y <= pane.bottom;
        if (!inside && !clampToPane) return null;
        const x = clamp(point.x, 0, layout.plotWidth - 1);
        const y = clamp(point.y, pane.top, pane.bottom);
        const index = Math.floor(layout.range.leftEdge + x / layout.range.spacing);
        return this.anchorOf(index, this.snappedPrice(index, y, pane, magnet));
    }

    /**
     * 자석: 그 칸 캔들의 시가·고가·저가·종가 중 높이 y 에 가장 가까운 값.
     * 지표 선에도 붙이도록 켜 두었으면 그 칸에서의 지표 선 값(이동평균선, 볼린저밴드 등)도 함께 견준다.
     * 약한 자석은 그 값이 가까울 때만, 강한 자석은 항상 붙는다. 붙지 않으면 y 자리의 가격 그대로.
     * 캔들이 없는 칸(미래 구간)에서는 붙지 않는다.
     */
    private snappedPrice(index: number, y: number, pane: Pane, magnet: MagnetMode): number {
        const candle = this.host.candles()[index];
        const free = paneToValue(pane)(y);
        if (magnet === 'off' || !candle) return free;
        const toY = paneToY(pane);
        const lineValues = this.magnetIndicators ? this.host.lineValues(index) : [];
        const nearest = [candle.open, candle.high, candle.low, candle.close, ...lineValues]
            .map(price => ({price, gap: Math.abs(toY(price) - y)}))
            .reduce((best, next) => next.gap < best.gap ? next : best);
        return magnet === 'strong' || nearest.gap <= MAGNET_DISTANCE ? nearest.price : free;
    }

    /** 순번의 가로 위치 (CSS px). 칸의 가운데 */
    private xOf(index: number, layout: Layout): number {
        return (index + 0.5 - layout.range.leftEdge) * layout.range.spacing;
    }

    /** 점을 화면 위치(CSS px)로 바꾼다. */
    private pointOf(anchor: Anchor, layout: Layout): Point {
        return {x: this.xOf(this.indexOf(anchor), layout), y: paneToY(layout.panes[0])(anchor.price)};
    }

    /** 도형이 화면에 놓인 모양: 그릴 선분, 끌 수 있는 점, 채울 영역 */
    private geometryOf(drawing: Drawing, layout: Layout): Geometry {
        const pane = layout.panes[0];
        switch (drawing.type) {
            case 'horizontal': {
                const y = paneToY(pane)(drawing.price);
                return {lines: [[{x: 0, y}, {x: layout.plotWidth, y}]], handles: [], fill: null};
            }
            case 'vertical': {
                const x = this.xOf(this.indexOf(drawing), layout);
                // 거래량·보조지표 영역까지 끝까지 긋는다.
                return {lines: [[{x, y: pane.top}, {x, y: layout.plotBottom}]], handles: [], fill: null};
            }
            case 'trend': {
                const from = this.pointOf(drawing.from, layout);
                const to = this.pointOf(drawing.to, layout);
                return {lines: [[from, to]], handles: [['from', from], ['to', to]], fill: null};
            }
            case 'ray': {
                // from 에서 to 방향으로 화면 밖까지 뻗는다.
                const from = this.pointOf(drawing.from, layout);
                const to = this.pointOf(drawing.to, layout);
                const length = distance(from, to);
                const scale = length > 0 ? RAY_LENGTH / length : 0;
                const far = {x: from.x + (to.x - from.x) * scale, y: from.y + (to.y - from.y) * scale};
                return {lines: [[from, length > 0 ? far : to]], handles: [['from', from], ['to', to]], fill: null};
            }
            case 'rectangle': {
                const from = this.pointOf(drawing.from, layout);
                const to = this.pointOf(drawing.to, layout);
                const corners = [from, {x: to.x, y: from.y}, to, {x: from.x, y: to.y}];
                return {
                    lines: corners.map((corner, order): [Point, Point] => [corner, corners[(order + 1) % corners.length]]),
                    handles: [['from', from], ['to', to]],
                    fill: corners,
                };
            }
            case 'fibonacci': {
                // 비율 0 이 to, 1 이 from. 가로선은 두 점 사이에만 긋고, 선 왼쪽 위에 비율과 가격을 적는다.
                const from = this.pointOf(drawing.from, layout);
                const to = this.pointOf(drawing.to, layout);
                const left = Math.min(from.x, to.x);
                const right = Math.max(from.x, to.x);
                const toY = paneToY(pane);
                const ratios = drawing.levels?.length ? drawing.levels : FIBONACCI_DEFAULT_LEVELS;
                const levels = ratios.map(ratio => {
                    const price = drawing.to.price + (drawing.from.price - drawing.to.price) * ratio;
                    return {text: `${ratio} (${pane.format(price)})`, y: toY(price)};
                });
                return {
                    lines: levels.map(({y}): [Point, Point] => [{x: left, y}, {x: right, y}]),
                    handles: [['from', from], ['to', to]],
                    fill: null,
                    guides: [[from, to]],
                    labels: levels.map(({text, y}): Label => (
                        {at: {x: left, y: y - LABEL_GAP}, text, align: 'left', baseline: 'bottom', backdrop: false}
                    )),
                };
            }
            case 'measure': {
                // from 에서 to 까지의 가격 차이, 등락률, 캔들 수를 상자 가운데에 적는다.
                const from = this.pointOf(drawing.from, layout);
                const to = this.pointOf(drawing.to, layout);
                const corners = [from, {x: to.x, y: from.y}, to, {x: from.x, y: to.y}];
                const change = drawing.to.price - drawing.from.price;
                const rate = drawing.from.price !== 0 ? Math.abs(change / drawing.from.price) * 100 : 0;
                const sign = change < 0 ? '-' : '+';
                const bars = Math.abs(this.indexOf(drawing.to) - this.indexOf(drawing.from));
                return {
                    lines: corners.map((corner, order): [Point, Point] => [corner, corners[(order + 1) % corners.length]]),
                    handles: [['from', from], ['to', to]],
                    fill: corners,
                    labels: [{
                        at: {x: (from.x + to.x) / 2, y: (from.y + to.y) / 2},
                        text: `${sign}${pane.format(Math.abs(change))} (${sign}${rate.toFixed(2)}%) · ${bars}봉`,
                        align: 'center',
                        baseline: 'middle',
                        backdrop: true,
                    }],
                };
            }
            case 'text': {
                // from 이 글자(여러 줄이면 전체)의 왼쪽 가운데. 상자는 글자를 잡는 범위이자 선택 테두리다.
                const at = this.pointOf(drawing.from, layout);
                const size = textSizeOf(drawing);
                const extraLines = textLinesOf(drawing.text).length - 1;
                const half = (size + extraLines * size * TEXT_LINE_HEIGHT) / 2 + TEXT_PADDING;
                const width = (this.textWidths.get(drawing.id) ?? 0) + TEXT_PADDING * 2;
                return {
                    lines: [],
                    handles: [],
                    fill: null,
                    box: {left: at.x - TEXT_PADDING, top: at.y - half, right: at.x - TEXT_PADDING + width, bottom: at.y + half},
                };
            }
            case 'channel': {
                // from-to 선을 third 가 지나는 자리까지 나란히 옮긴 선을 하나 더 긋는다.
                const from = this.pointOf(drawing.from, layout);
                const to = this.pointOf(drawing.to, layout);
                const third = this.pointOf(drawing.third, layout);
                const steep = Math.abs(to.x - from.x) < 0.5;    // 거의 수직이면 옆으로 옮긴다
                const shift = steep
                    ? {x: third.x - from.x, y: 0}
                    : {x: 0, y: third.y - (from.y + (to.y - from.y) / (to.x - from.x) * (third.x - from.x))};
                const oppositeFrom = {x: from.x + shift.x, y: from.y + shift.y};
                const oppositeTo = {x: to.x + shift.x, y: to.y + shift.y};
                return {
                    lines: [[from, to], [oppositeFrom, oppositeTo]],
                    handles: [['from', from], ['to', to], ['third', third]],
                    fill: [from, to, oppositeTo, oppositeFrom],
                };
            }
        }
    }

    /** 화면 위치에 있는 도형과 잡힌 부분. 나중에 그린 도형이 먼저 잡힌다. 점(손잡이)이 선보다 먼저다. */
    private hitTest(point: Point): { drawing: Drawing, part: Part } | null {
        const layout = this.host.layout();
        const pane = layout?.panes[0];
        if (!layout || !pane) return null;
        if (point.x < 0 || point.x >= layout.plotWidth || point.y < pane.top || point.y > layout.plotBottom) return null;
        // 가격 영역 아래(거래량·보조지표)에서는 거기까지 그어지는 수직선만 잡힌다.
        const belowPrice = point.y > pane.bottom;

        for (let order = this.drawings.length - 1; order >= 0; order--) {
            const drawing = this.drawings[order];
            if (drawing.hidden || this.isBeforeRange(drawing) || (belowPrice && drawing.type !== 'vertical')) continue;
            const geometry = this.geometryOf(drawing, layout);
            const handle = geometry.handles.find(([, spot]) => distance(point, spot) <= HIT_TOLERANCE + 2);
            if (handle) return {drawing, part: handle[0]};
            const segments = [...geometry.lines, ...(geometry.guides ?? [])];
            if (segments.some(([start, end]) => distanceToSegment(point, start, end) <= HIT_TOLERANCE)) {
                return {drawing, part: 'body'};
            }
            const box = geometry.box;
            if (box && point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom) {
                return {drawing, part: 'body'};
            }
        }
        return null;
    }

    /**
     * 도형을 옮긴 결과. 점 하나를 잡았으면 그 점을 target 으로,
     * 전체를 잡았으면 start 에서 target 까지 움직인 칸 수·가격만큼 모든 점을 같이 옮긴다.
     */
    private moved(original: Drawing, part: Part, start: Anchor, target: Anchor): Drawing {
        const indexDelta = this.indexOf(target) - this.indexOf(start);
        const priceDelta = target.price - start.price;
        const shift = (anchor: Anchor): Anchor => this.anchorOf(this.indexOf(anchor) + indexDelta, anchor.price + priceDelta);

        switch (original.type) {
            case 'horizontal':
                return {...original, price: target.price};
            case 'vertical':
                return {...original, time: target.time, offset: target.offset};
            case 'text':
                return {...original, from: shift(original.from)};
            case 'channel':
                if (part === 'third') return {...original, third: target};
                if (part === 'body') {
                    return {...original, from: shift(original.from), to: shift(original.to), third: shift(original.third)};
                }
                return {...original, [part]: target};
            default:
                if (part === 'from' || part === 'to') return {...original, [part]: target};
                return {...original, from: shift(original.from), to: shift(original.to)};
        }
    }
}

/** 도형에서 id 와 꾸미기를 뺀, 모양만 */
type DrawingShape =
    | { type: 'trend' | 'ray' | 'rectangle' | 'fibonacci' | 'measure', from: Anchor, to: Anchor }
    | { type: 'channel', from: Anchor, to: Anchor, third: Anchor }
    | { type: 'horizontal', price: number }
    | { type: 'vertical', time: number, offset?: number | null };
