import type {OverlayIndicator, PaneIndicator} from "./indicatorPanes.ts";

/**
 * 보기 상태. 가로축은 캔들 순번이고, rightEdge 는 그림 오른쪽 끝에 놓인 순번(소수 가능)이다.
 * rightEdge = 캔들 수 이면 마지막 캔들이 오른쪽 끝에 딱 붙는다.
 */
export interface View {
    spacing: number,    // 캔들 한 칸 너비 (CSS px)
    rightEdge: number,
}

export interface VisibleRange {
    from: number,       // 보이는 첫 캔들 순번
    count: number,      // 보이는 캔들 수
    spacing: number,
    leftEdge: number,   // 그림 왼쪽 끝에 놓인 순번(소수 가능)
}

/** 세로로 쌓인 영역 하나(가격·거래량·보조지표). 십자선이 마우스 높이를 값으로 바꿀 때 쓴다. (CSS px) */
export interface Pane {
    top: number,            // 영역 범위
    bottom: number,
    scaleTop: number,       // max 가 놓이는 높이
    scaleBottom: number,    // min 이 놓이는 높이
    min: number,
    max: number,
    format: (value: number) => string,
}

/** 마지막으로 그린 화면의 배치. 위 장(십자선·도형·값 표시)이 같은 좌표계를 쓰도록 남겨 둔다. (CSS px) */
export interface Layout {
    range: VisibleRange,
    plotWidth: number,
    plotBottom: number,
    priceDecimals: number,
    panes: Pane[],      // 0: 가격, 1: 거래량, 그 뒤: 보조지표
    indicators: { instance: PaneIndicator, top: number }[],    // 별도 영역 지표와 그 영역의 위쪽 높이
    priceOverlays: OverlayIndicator[],      // 가격 영역에 겹쳐 그린 지표
    volumeOverlays: OverlayIndicator[],     // 거래량 영역에 겹쳐 그린 지표
}

export interface Point {
    x: number,
    y: number,
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const isNumber = (value: number | null | undefined): value is number => value !== null && value !== undefined;

/** 점 p 에서 선분 a-b 까지의 거리 */
export const distanceToSegment = (p: Point, a: Point, b: Point): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared, 0, 1);
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
