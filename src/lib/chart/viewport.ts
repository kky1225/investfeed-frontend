import {clamp, View, VisibleRange} from "./layout.ts";

// 보기 상태(이동·확대) 계산. 상태는 엔진이 갖고, 여기는 계산만 한다.
// total: 전체 캔들 수, plotWidth: 그림 영역 너비 (CSS px)

const DEFAULT_MIN_BAR_SPACING = 4;  // 처음 보여 줄 때 캔들 한 칸 최소 너비
const DEFAULT_MAX_BAR_SPACING = 16; // 처음 보여 줄 때 캔들 한 칸 최대 너비
const MIN_BAR_SPACING = 1;      // 축소 한계
const MAX_BAR_SPACING = 48;     // 확대 한계
const MIN_VISIBLE_BARS = 5;     // 끝까지 밀어도 화면에 남기는 캔들 수

/** 확대 한계를 지키고, 어느 쪽으로 밀어도 캔들이 몇 개는 화면에 남게 한다. */
export const clampView = (view: View, total: number, plotWidth: number): View => {
    const spacing = clamp(view.spacing, MIN_BAR_SPACING, MAX_BAR_SPACING);
    const bars = plotWidth / spacing;
    const keep = Math.min(total, MIN_VISIBLE_BARS);
    return {spacing, rightEdge: clamp(view.rightEdge, keep, Math.max(keep, total + bars - keep))};
};

/** 기본 보기: 최근 캔들을 오른쪽 끝에 맞춘다. 캔들이 적어 다 들어가면 왼쪽부터 채운다. */
export const defaultView = (total: number, plotWidth: number): View => {
    const spacing = clamp(plotWidth / Math.max(1, total), DEFAULT_MIN_BAR_SPACING, DEFAULT_MAX_BAR_SPACING);
    return {spacing, rightEdge: Math.max(total, plotWidth / spacing)};
};

export const visibleRange = (view: View, total: number, plotWidth: number): VisibleRange => {
    const leftEdge = view.rightEdge - plotWidth / view.spacing;
    const from = Math.max(0, Math.floor(leftEdge));
    const to = Math.min(total, Math.ceil(view.rightEdge));
    return {from, count: Math.max(0, to - from), spacing: view.spacing, leftEdge};
};

/** 가로 위치 x 에 놓인 순번(소수) */
export const logicalAt = (view: View, plotWidth: number, x: number): number =>
    view.rightEdge - (plotWidth - x) / view.spacing;

/** 순번 anchor 가 가로 위치 x 에 그대로 있도록 캔들 너비를 spacing 으로 바꾼 보기 */
export const zoomedView = (view: View, plotWidth: number, x: number, anchor: number, spacing: number): View => {
    const next = clamp(spacing, MIN_BAR_SPACING, MAX_BAR_SPACING);
    return {...view, spacing: next, rightEdge: anchor + (plotWidth - x) / next};
};
