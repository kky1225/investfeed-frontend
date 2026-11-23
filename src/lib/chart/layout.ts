import type {OverlayIndicator, PaneIndicator} from "./indicatorPanes.ts";
import {createInverseLogScale, createInverseScale, createLinearScale, createLogScale} from "./scale.ts";

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
    rightEdge: number,  // 그림 오른쪽 끝에 놓인 순번(소수 가능). 캔들 수보다 크면 마지막 캔들 뒤의 빈 구간이 보이는 것
}

/** 세로로 쌓인 영역 하나(가격·거래량·보조지표). 십자선이 마우스 높이를 값으로 바꿀 때 쓴다. (CSS px) */
export interface Pane {
    top: number,            // 영역 범위
    bottom: number,
    scaleTop: number,       // max 가 놓이는 높이
    scaleBottom: number,    // min 이 놓이는 높이
    min: number,
    max: number,
    log?: boolean,          // 로그 축인지 (가격 영역만 해당). 값과 높이는 paneToY·paneToValue 로 바꾼다
    format: (value: number) => string,
    // 오른쪽 축에 적을 때의 표기. 없으면 format 과 같다. 퍼센트 축이면 가격 영역만 등락률로 적는다
    axisFormat?: (value: number) => string,
}

/** 영역의 값 → 높이 (CSS px). 선형·로그 축을 가려 준다. */
export const paneToY = (pane: Pane): (value: number) => number => pane.log
    ? createLogScale(pane.min, pane.max, pane.scaleTop, pane.scaleBottom)
    : createLinearScale(pane.min, pane.max, pane.scaleTop, pane.scaleBottom);

/** 영역의 높이 (CSS px) → 값. paneToY 의 반대 방향. */
export const paneToValue = (pane: Pane): (y: number) => number => pane.log
    ? createInverseLogScale(pane.min, pane.max, pane.scaleTop, pane.scaleBottom)
    : createInverseScale(pane.min, pane.max, pane.scaleTop, pane.scaleBottom);

/** 마지막으로 그린 화면의 배치. 위 장(십자선·도형·값 표시)이 같은 좌표계를 쓰도록 남겨 둔다. (CSS px) */
export interface Layout {
    range: VisibleRange,
    plotWidth: number,
    plotBottom: number,
    axisWidth: number,      // 오른쪽 가격축의 너비. 가장 긴 가격이 들어가도록 캔들에 따라 달라진다
    priceDecimals: number,  // 십자선·이동평균·수평선 라벨의 소수 자릿수. 눈금 간격과 캔들 가격 중 더 잘게 나뉜 쪽
    valueDecimals: number,  // 캔들 가격 자체의 소수 자릿수 (시고저종·현재가·최고 최저 표기)
    panes: Pane[],      // 0: 가격, 1: 거래량, 그 뒤: 보조지표
    indicators: { instance: PaneIndicator, top: number }[],    // 별도 영역 지표와 그 영역의 위쪽 높이
    priceOverlays: OverlayIndicator[],      // 가격 영역에 겹쳐 그린 지표
    volumeOverlays: OverlayIndicator[],     // 거래량 영역에 겹쳐 그린 지표
    // 비교 종목마다 0% 로 삼은 종가. 보이는 구간에 값이 없으면 null. 값 표시가 등락률을 계산할 때 쓴다
    comparisonBases: (number | null)[],
    // 아래 장이 오른쪽 가격축에 붙인 라벨(현재가·가격선·비교 종목)의 자리 (기기 픽셀). 수평선 라벨이 이 자리를 비킨다
    axisTags: Span[],
}

/** 세로로 차지하는 범위 (기기 픽셀) */
export interface Span {
    top: number,
    bottom: number,
}

export interface Point {
    x: number,
    y: number,
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * 축 라벨의 가운데 높이를 그 영역(top~bottom) 안으로 당긴다. 값이 영역 가장자리에 있어도 라벨이 옆 영역을 덮지 않는다.
 * height: 라벨 높이, extra: 라벨 아래로 덧붙는 높이. 모두 같은 단위(기기 픽셀)로 넘긴다.
 */
export const tagCenterWithin = (y: number, top: number, bottom: number, height: number, extra = 0) => {
    const first = top + height / 2;
    return clamp(y, first, Math.max(first, bottom - height / 2 - extra));
};

/**
 * 라벨 하나를 이미 놓인 라벨들(taken)과 겹치지 않는 가장 가까운 자리에 놓을 가운데 높이를 구한다.
 * 원래 자리(center)가 비어 있으면 그대로 두고, 아니면 걸리는 라벨의 바로 위·아래 가운데 원래 자리에 가까운 빈 곳으로 옮긴다.
 * 영역(top~bottom) 안에 빈 곳이 없으면 원래 자리에 겹쳐 놓는다. 모두 같은 단위(기기 픽셀)로 넘긴다.
 */
export const placeTagAmong = (center: number, height: number, taken: Span[], top: number, bottom: number) => {
    const half = height / 2;
    const free = (y: number) => y - half >= top && y + half <= bottom
        && taken.every(span => y + half <= span.top || y - half >= span.bottom);
    return [center, ...taken.flatMap(span => [span.top - half, span.bottom + half])]
        .sort((a, b) => Math.abs(a - center) - Math.abs(b - center))
        .find(free) ?? center;
};

export const isNumber = (value: number | null | undefined): value is number => value !== null && value !== undefined;

/** 점 p 에서 선분 a-b 까지의 거리 */
export const distanceToSegment = (p: Point, a: Point, b: Point): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared, 0, 1);
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
