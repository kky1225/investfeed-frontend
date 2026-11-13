import type {Drawing} from "../lib/chart/types.ts";

/** 지표 하나에 대해 기본 상태에서 바꾼 것. 바꾸지 않은 항목은 비워 두고, 그 지표의 기본값을 쓴다 */
export interface ChartIndicatorSetting {
    on?: boolean | null;        // 켜짐 여부
    params?: number[] | null;   // 설정값 (기간 등). 순서는 설정 창의 칸 순서
}

/** 회원별 차트 설정 */
export interface ChartSetting {
    // 지표별로 바꾼 것. key 는 지표 이름(average, rsi, macd, bollinger 등). 바꾸지 않은 지표는 없다
    indicators: Record<string, ChartIndicatorSetting>;
    drawingToolbar: boolean;    // 그리기 도구 모음 표시
    flatByPrevClose: boolean;   // 시가와 종가가 같은 캔들의 색을 전일 종가와 비교해 정한다. false 면 상승색
}

/** 회원이 한 종목 차트에 그린 선 */
export interface ChartDrawingRes {
    drawings: Drawing[];
}
