import {Anchor, Candle, ChartStyle, Drawing, DrawingStyle, DrawingTool} from "./types.ts";
import {AXIS_LABEL_OFFSET, AXIS_TAG_HEIGHT, DRAG_THRESHOLD} from "./constants.ts";
import {clamp, distanceToSegment, Layout, paneToValue, paneToY, Point} from "./layout.ts";
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

/** 두 점 이상으로 만드는 도형. 한 번 눌러 끝나는 수평선·수직선은 여기에 없다. */
type PointTool = 'trend' | 'ray' | 'rectangle' | 'channel';

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
}

/** 도형 계층이 엔진에서 읽어 오는 것과 엔진에 알리는 것 */
export interface DrawingHost {
    layout: () => Layout | null,    // 마지막으로 그린 배치
    candles: () => Candle[],
    redraw: () => void,             // 위 장을 다시 그려 달라고 요청
    refreshCursor: () => void,      // 도구 상태가 바뀌어 마우스 커서를 다시 정해야 함
    drawingsChanged: (drawings: Drawing[]) => void,     // 사용자가 추가·변경·삭제함
    toolReleased: () => void,       // 하나를 다 그렸거나 취소해서 도구가 풀림
    selectionChanged: (id: string | null) => void,
}

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
        if (this.selectedId && !drawings.some(drawing => drawing.id === this.selectedId)) this.select(null);
        this.host.redraw();
    }

    /** 그리기 도구를 고른다. null 이면 선택·이동 상태로 돌아간다. */
    setTool(tool: DrawingTool | null) {
        this.tool = tool;
        this.draft = null;
        if (tool) this.select(null);
        this.host.refreshCursor();
        this.host.redraw();
    }

    /** 새로 그리는 도형에 입힐 꾸미기 (색·굵기·점선) */
    setNewStyle(style: DrawingStyle) {
        this.newStyle = style;
    }

    /** Esc: 그리던 것을 취소하고, 그리는 중이 아니면 선택을 푼다. */
    cancel() {
        if (this.tool || this.draft) this.releaseTool();
        else this.select(null);
        this.host.redraw();
    }

    /** 선택한 도형을 지운다. */
    deleteSelected() {
        const selectedId = this.selectedId;
        if (!selectedId) return;
        this.select(null);
        this.changeDrawings(this.drawings.filter(drawing => drawing.id !== selectedId));
    }

    /** 누르지 않은 채 움직일 때: 첫 점을 찍은 뒤라면 다음 점이 마우스를 따라온다. */
    hover(point: Point) {
        const draft = this.draft;
        if (!draft) return;
        const anchor = this.anchorAt(point, true);
        if (!anchor) return;
        if (draft.stage === 1) draft.to = anchor;
        else if (!draft.thirdPlaced) draft.third = anchor;
    }

    /** 화면 위치에 도형이 있는지 (마우스 커서 모양용) */
    isOver(point: Point): boolean {
        return this.hitTest(point) !== null;
    }

    /** 누른 자리에서 그리기나 옮기기를 시작한다. 시작했으면 true, 아니면(빈 곳) false 로 차트 이동에 넘긴다. */
    beginEdit(point: Point): boolean {
        const tool = this.tool;
        if (tool) {
            const anchor = this.anchorAt(point, false);
            if (!anchor) return false;
            const draft = this.draft;
            if (tool === 'horizontal') {
                // 수평선·수직선은 누른 자리에 바로 긋는다.
                this.add({type: 'horizontal', price: anchor.price});
            } else if (tool === 'vertical') {
                this.add({type: 'vertical', time: anchor.time, offset: anchor.offset});
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
        this.move = {part: hit.part, start: point, original: hit.drawing, changed: false};
        return true;
    }

    /** 누른 채 움직이는 동안: 그리는 도형의 점을 옮기거나, 잡은 도형을 옮긴다. */
    updateEdit(point: Point) {
        const target = this.anchorAt(point, true);
        if (!target) return;
        const draft = this.draft;
        if (draft) {
            if (draft.stage === 1) draft.to = target;
            else draft.third = target;
            return;
        }
        const move = this.move;
        if (!move) return;
        if (!move.changed && distance(point, move.start) < DRAG_THRESHOLD) return;

        const start = this.anchorAt(move.start, true);
        if (!start) return;
        const next = this.moved(move.original, move.part, start, target);
        move.changed = true;
        this.drawings = this.drawings.map(drawing => drawing.id === next.id ? next : drawing);
    }

    /** 손을 뗐을 때: 그리던 도형을 다음 단계로 넘기거나 확정하고, 옮긴 결과를 알린다. */
    finishEdit(point: Point) {
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

    /** 그린 도형들을 위 장에 그린다. 가격 영역 밖으로는 나가지 않는다. */
    render(painter: Painter, layout: Layout, style: ChartStyle) {
        const draft = this.draft;
        const drawings: Drawing[] = draft
            ? [...this.drawings, {...this.newStyle, ...this.draftShape(draft), id: DRAFT_ID}]
            : this.drawings;
        if (drawings.length === 0) return;

        const ctx = painter.ctx;
        const pane = layout.panes[0];
        const toY = paneToY(pane);
        const line = painter.lineWidth();
        const plotRightPx = painter.px(layout.plotWidth);
        const handle = painter.px(HANDLE_SIZE);
        const colorOf = (drawing: Drawing) => lineColor(style, drawing.color ?? DEFAULT_COLOR);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, painter.px(pane.top), plotRightPx, painter.px(pane.bottom) - painter.px(pane.top));
        ctx.clip();
        drawings.forEach(drawing => {
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
            ctx.setLineDash([]);

            if (active) {
                geometry.handles.forEach(([, point]) => {
                    ctx.fillRect(
                        Math.round(point.x * painter.dpr - handle / 2), Math.round(point.y * painter.dpr - handle / 2),
                        handle, handle,
                    );
                });
            }
        });
        ctx.restore();

        // 수평선은 오른쪽 축에 가격 라벨을 붙인다.
        const labelHeight = painter.px(AXIS_TAG_HEIGHT);
        const axisWidthPx = painter.px(layout.axisWidth);
        ctx.textAlign = 'left';
        ctx.lineWidth = line;
        drawings.forEach(drawing => {
            if (drawing.type !== 'horizontal' || drawing.price < pane.min || drawing.price > pane.max) return;
            const color = colorOf(drawing);
            const y = painter.px(toY(drawing.price));
            const labelTop = Math.round(y - labelHeight / 2);
            ctx.fillStyle = style.backgroundColor;
            ctx.fillRect(plotRightPx, labelTop, axisWidthPx, labelHeight);
            ctx.strokeStyle = color;
            ctx.strokeRect(plotRightPx + line / 2, labelTop + line / 2, axisWidthPx - line, labelHeight - line);
            ctx.fillStyle = color;
            ctx.fillText(pane.format(drawing.price), plotRightPx + painter.px(AXIS_LABEL_OFFSET), y);
        });
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

    /** 다 그린 도형을 목록에 넣고 도구를 푼다. */
    private add(shape: DrawingShape) {
        this.changeDrawings([...this.drawings, {...this.newStyle, ...shape, id: createId()} as Drawing]);
        this.releaseTool();
    }

    /** 도형 하나를 다 그렸거나 취소했을 때 도구를 푼다. */
    private releaseTool() {
        this.tool = null;
        this.draft = null;
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

    /**
     * 화면 위치를 점(캔들 시각·가격)으로 바꾼다. 가로는 그 자리의 칸에 붙이고, 마지막 캔들 오른쪽이면 미래 구간의 점이 된다.
     * 가격 영역 밖이면 null. clampToPane 이면 영역 안으로 끌어와 계산한다(끄는 중에 영역을 벗어났을 때).
     */
    private anchorAt(point: Point, clampToPane: boolean): Anchor | null {
        const layout = this.host.layout();
        const pane = layout?.panes[0];
        if (!layout || !pane || this.host.candles().length === 0) return null;
        const inside = point.x >= 0 && point.x < layout.plotWidth && point.y >= pane.top && point.y <= pane.bottom;
        if (!inside && !clampToPane) return null;
        const x = clamp(point.x, 0, layout.plotWidth - 1);
        const y = clamp(point.y, pane.top, pane.bottom);
        return this.anchorOf(Math.floor(layout.range.leftEdge + x / layout.range.spacing), paneToValue(pane)(y));
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
                return {lines: [[{x, y: pane.top}, {x, y: pane.bottom}]], handles: [], fill: null};
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
        if (point.x < 0 || point.x >= layout.plotWidth || point.y < pane.top || point.y > pane.bottom) return null;

        for (let order = this.drawings.length - 1; order >= 0; order--) {
            const drawing = this.drawings[order];
            const geometry = this.geometryOf(drawing, layout);
            const handle = geometry.handles.find(([, spot]) => distance(point, spot) <= HIT_TOLERANCE + 2);
            if (handle) return {drawing, part: handle[0]};
            if (geometry.lines.some(([start, end]) => distanceToSegment(point, start, end) <= HIT_TOLERANCE)) {
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
    | { type: 'trend' | 'ray' | 'rectangle', from: Anchor, to: Anchor }
    | { type: 'channel', from: Anchor, to: Anchor, third: Anchor }
    | { type: 'horizontal', price: number }
    | { type: 'vertical', time: number, offset?: number | null };
