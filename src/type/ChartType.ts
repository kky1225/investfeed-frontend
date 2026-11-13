import type {Drawing} from "../lib/chart/types.ts";

/** 회원별 차트 설정 */
export interface ChartSetting {
    hidden: string[];   // 꺼 둔 지표의 key (average, rsi, macd 등)
}

/** 회원이 한 종목 차트에 그린 선 */
export interface ChartDrawingRes {
    drawings: Drawing[];
}
