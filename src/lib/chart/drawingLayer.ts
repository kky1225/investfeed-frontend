import {Anchor, Candle, ChartStyle, Drawing, DrawingTool} from "./types.ts";
import {createInverseScale, createLinearScale} from "./scale.ts";
import {AXIS_LABEL_OFFSET, AXIS_TAG_HEIGHT, DRAG_THRESHOLD, PRICE_AXIS_WIDTH} from "./constants.ts";
import {clamp, distanceToSegment, Layout, Point} from "./layout.ts";
import {lineColor, Painter} from "./painter.ts";

// 사용자가 그리는 도형(추세선·수평선): 그리기, 선택, 옮기기, 지우기, 화면에 그리기

const HIT_TOLERANCE = 6;        // 선에서 이만큼 안쪽을 누르면 그 선을 잡은 것으로 본다
const HANDLE_SIZE = 7;          // 선택한 추세선 양 끝의 손잡이 크기
const DRAFT_ID = 'draft';       // 그리는 중인 도형
const DRAWING_LINE_WIDTH = 1;   // 선 굵기. 선택하면 한 단계 굵어진다
const DRAWING_COLOR = 4;        // style.lineColors 안에서의 색 순서

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

export class DrawingLayer {
    private readonly host: DrawingHost;
    private drawings: Drawing[] = [];
    private tool: DrawingTool | null = null;        // 고른 도구. null 이면 선택·이동 상태
    private selectedId: string | null = null;
    private draft: Draft | null = null;
    private move: Move | null = null;

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

    /** 누르지 않은 채 움직일 때: 추세선의 첫 점을 찍은 뒤라면 끝점이 따라온다. */
    hover(point: Point) {
        if (this.draft) this.draft.to = this.anchorAt(point, true) ?? this.draft.to;
    }

    /** 화면 위치에 도형이 있는지 (마우스 커서 모양용) */
    isOver(point: Point): boolean {
        return this.hitTest(point) !== null;
    }

    /** 누른 자리에서 그리기나 옮기기를 시작한다. 시작했으면 true, 아니면(빈 곳) false 로 차트 이동에 넘긴다. */
    beginEdit(point: Point): boolean {
        if (this.tool) {
            const anchor = this.anchorAt(point, false);
            if (!anchor) return false;
            if (this.tool === 'horizontal') {
                // 수평선은 누른 자리의 가격에 바로 긋는다.
                this.changeDrawings([...this.drawings, {id: createId(), type: 'horizontal', price: anchor.price}]);
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
    updateEdit(point: Point) {
        const target = this.anchorAt(point, true);
        if (!target) return;
        if (this.draft) {
            this.draft.to = target;
            return;
        }
        const move = this.move;
        if (!move) return;
        if (!move.changed && Math.hypot(point.x - move.start.x, point.y - move.start.y) < DRAG_THRESHOLD) return;

        const candles = this.host.candles();
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
            const indexDelta = timeToIndex(candles, target.time) - timeToIndex(candles, start.time);
            const priceDelta = target.price - start.price;
            const shift = (anchor: Anchor): Anchor => ({
                time: candles[clamp(timeToIndex(candles, anchor.time) + indexDelta, 0, candles.length - 1)].time,
                price: anchor.price + priceDelta,
            });
            next = {...original, from: shift(original.from), to: shift(original.to)};
        }
        move.changed = true;
        this.drawings = this.drawings.map(drawing => drawing.id === next.id ? next : drawing);
    }

    /** 손을 뗐을 때: 추세선을 확정하거나, 옮긴 결과를 알린다. */
    finishEdit(point: Point) {
        if (this.draft) {
            // 끌어서 그렸으면 바로 확정. 제자리에서 뗐으면 첫 점만 찍힌 상태로 두고 다음 누름을 끝점으로 받는다.
            const {from, to, origin} = this.draft;
            if (Math.hypot(point.x - origin.x, point.y - origin.y) >= DRAG_THRESHOLD) {
                this.changeDrawings([...this.drawings, {id: createId(), type: 'trend', from, to}]);
                this.releaseTool();
            }
            return;
        }
        if (this.move?.changed) this.host.drawingsChanged(this.drawings);
        this.move = null;
    }

    /** 그린 도형들을 위 장에 그린다. 가격 영역 밖으로는 나가지 않는다. */
    render(painter: Painter, layout: Layout, style: ChartStyle) {
        const drawings: Drawing[] = this.draft
            ? [...this.drawings, {id: DRAFT_ID, type: 'trend', from: this.draft.from, to: this.draft.to}]
            : this.drawings;
        if (drawings.length === 0) return;

        const ctx = painter.ctx;
        const pane = layout.panes[0];
        const toY = createLinearScale(pane.min, pane.max, pane.scaleTop, pane.scaleBottom);
        const color = lineColor(style, DRAWING_COLOR);
        const line = painter.lineWidth();
        const plotRightPx = painter.px(layout.plotWidth);
        const baseWidth = Math.max(1, Math.round(DRAWING_LINE_WIDTH * painter.dpr));
        const handle = painter.px(HANDLE_SIZE);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, painter.px(pane.top), plotRightPx, painter.px(pane.bottom) - painter.px(pane.top));
        ctx.clip();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        drawings.forEach(drawing => {
            const active = drawing.id === this.selectedId || drawing.id === DRAFT_ID;
            ctx.lineWidth = active ? baseWidth + line : baseWidth;
            ctx.beginPath();
            if (drawing.type === 'horizontal') {
                const y = painter.px(toY(drawing.price)) + line / 2;
                ctx.moveTo(0, y);
                ctx.lineTo(plotRightPx, y);
                ctx.stroke();
                return;
            }
            const points = [this.anchorPoint(drawing.from, layout), this.anchorPoint(drawing.to, layout)]
                .map(point => ({x: point.x * painter.dpr, y: point.y * painter.dpr}));
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
        const labelHeight = painter.px(AXIS_TAG_HEIGHT);
        ctx.textAlign = 'left';
        ctx.lineWidth = line;
        drawings.forEach(drawing => {
            if (drawing.type !== 'horizontal' || drawing.price < pane.min || drawing.price > pane.max) return;
            const y = painter.px(toY(drawing.price));
            const labelTop = Math.round(y - labelHeight / 2);
            ctx.fillStyle = style.backgroundColor;
            ctx.fillRect(plotRightPx, labelTop, painter.px(PRICE_AXIS_WIDTH), labelHeight);
            ctx.strokeStyle = color;
            ctx.strokeRect(plotRightPx + line / 2, labelTop + line / 2, painter.px(PRICE_AXIS_WIDTH) - line, labelHeight - line);
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

    /** 도형 하나를 다 그렸거나 취소했을 때 도구를 푼다. */
    private releaseTool() {
        this.tool = null;
        this.draft = null;
        this.host.refreshCursor();
        this.host.toolReleased();
    }

    /**
     * 화면 위치를 캔들 시각·가격으로 바꾼다. 가로는 그 자리의 캔들에 붙인다.
     * 가격 영역 밖이면 null. clampToPane 이면 영역 안으로 끌어와 계산한다(끄는 중에 영역을 벗어났을 때).
     */
    private anchorAt(point: Point, clampToPane: boolean): Anchor | null {
        const layout = this.host.layout();
        const candles = this.host.candles();
        const pane = layout?.panes[0];
        if (!layout || !pane || candles.length === 0) return null;
        const inside = point.x >= 0 && point.x < layout.plotWidth && point.y >= pane.top && point.y <= pane.bottom;
        if (!inside && !clampToPane) return null;
        const index = clamp(
            Math.floor(layout.range.leftEdge + point.x / layout.range.spacing),
            0, candles.length - 1,
        );
        const y = clamp(point.y, pane.top, pane.bottom);
        return {
            time: candles[index].time,
            price: createInverseScale(pane.min, pane.max, pane.scaleTop, pane.scaleBottom)(y),
        };
    }

    /** 캔들 시각·가격을 화면 위치(CSS px)로 바꾼다. */
    private anchorPoint(anchor: Anchor, layout: Layout): Point {
        const pane = layout.panes[0];
        return {
            x: (timeToIndex(this.host.candles(), anchor.time) + 0.5 - layout.range.leftEdge) * layout.range.spacing,
            y: createLinearScale(pane.min, pane.max, pane.scaleTop, pane.scaleBottom)(anchor.price),
        };
    }

    /** 화면 위치에 있는 도형과 잡힌 부분. 나중에 그린 도형이 먼저 잡힌다. */
    private hitTest(point: Point): { drawing: Drawing, part: Move['part'] } | null {
        const layout = this.host.layout();
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
}
