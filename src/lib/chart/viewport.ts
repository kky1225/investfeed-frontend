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

const MAX_FUTURE_RATIO = 1 / 3;     // 마지막 캔들 뒤로 비워 두는 칸은 화면의 이 비율까지만

/**
 * 마지막 캔들 뒤에 비워 둘 칸 수. future: 마지막 캔들 뒤까지 그려지는 지표가 차지하는 칸 수, bars: 화면에 들어가는 칸 수.
 * 화면이 좁을 때 캔들이 밀려나지 않게 화면의 일부까지만 비운다.
 */
export const futureMargin = (future: number, bars: number): number =>
    Math.max(0, Math.min(future, Math.floor(bars * MAX_FUTURE_RATIO)));

/**
 * 기본 보기: 최근 캔들을 오른쪽 끝에 맞춘다. 캔들이 적어 다 들어가면 왼쪽부터 채운다.
 * future 를 주면 마지막 캔들 뒤로 그만큼(화면의 일부까지만) 비워 둔다.
 */
export const defaultView = (total: number, plotWidth: number, future = 0): View => {
    const spacing = clamp(plotWidth / Math.max(1, total + future), DEFAULT_MIN_BAR_SPACING, DEFAULT_MAX_BAR_SPACING);
    const bars = plotWidth / spacing;
    return {spacing, rightEdge: Math.max(total + futureMargin(future, bars), bars)};
};

export const visibleRange = (view: View, total: number, plotWidth: number): VisibleRange => {
    const leftEdge = view.rightEdge - plotWidth / view.spacing;
    const from = Math.max(0, Math.floor(leftEdge));
    const to = Math.min(total, Math.ceil(view.rightEdge));
    return {from, count: Math.max(0, to - from), spacing: view.spacing, leftEdge, rightEdge: view.rightEdge};
};

/** 가로 위치 x 에 놓인 순번(소수) */
export const logicalAt = (view: View, plotWidth: number, x: number): number =>
    view.rightEdge - (plotWidth - x) / view.spacing;

/**
 * 순번 from 부터 to 앞까지(소수 가능)가 화면 너비에 꽉 차는 보기. 확대 한계에 걸리면 그 한계의 너비로 구간의 가운데를 맞춘다.
 * fits 는 구간이 화면에 다 들어가는지다 (너무 길어 축소 한계에 걸리면 false).
 */
export const fittedView = (from: number, to: number, plotWidth: number): { view: View, fits: boolean } => {
    const count = Math.max(1, to - from);
    const spacing = clamp(plotWidth / count, MIN_BAR_SPACING, MAX_BAR_SPACING);
    const bars = plotWidth / spacing;
    return {view: {spacing, rightEdge: (from + to) / 2 + bars / 2}, fits: count <= bars + 1e-6};
};

/** 순번 anchor 가 가로 위치 x 에 그대로 있도록 캔들 너비를 spacing 으로 바꾼 보기 */
export const zoomedView = (view: View, plotWidth: number, x: number, anchor: number, spacing: number): View => {
    const next = clamp(spacing, MIN_BAR_SPACING, MAX_BAR_SPACING);
    return {...view, spacing: next, rightEdge: anchor + (plotWidth - x) / next};
};
