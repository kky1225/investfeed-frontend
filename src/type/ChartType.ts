import type {Drawing} from "../lib/chart/types.ts";

/** 지표 하나에 대해 기본 상태에서 바꾼 것. 바꾸지 않은 항목은 비워 두고, 그 지표의 기본값을 쓴다 */
export interface ChartIndicatorSetting {
    on?: boolean | null;        // 켜짐 여부
    params?: number[] | null;   // 설정값 (기간 등). 순서는 설정 창의 칸 순서
    colors?: number[] | null;   // 선마다의 색. 차트의 선 색 목록에서의 순번. 순서는 설정 창의 선 순서
    widths?: number[] | null;   // 선마다의 굵기(1~3). colors 와 같은 순서
    dashes?: boolean[] | null;  // 선마다 점선인지. colors 와 같은 순서
    height?: number | null;     // 차트 아래에 따로 영역을 차지하는 지표의 영역 높이(px)
}

/** 회원별 차트 설정 */
export interface ChartSetting {
    // 지표별로 바꾼 것. key 는 지표 이름(average, rsi, macd, bollinger 등). 바꾸지 않은 지표는 없다
    indicators: Record<string, ChartIndicatorSetting>;
    chartType: string;          // 가격을 그리는 방식 (candle, bar, line, area, heikinAshi)
    logScale: boolean;          // 가격축을 로그로
    percentScale: boolean;      // 가격축에 가격 대신 등락률(%)을 적는다. 기준은 화면에 보이는 첫 캔들의 종가
    drawingToolbar: boolean;    // 그리기 도구 모음 표시
    flatByPrevClose: boolean;   // 시가와 종가가 같은 캔들의 색을 전일 종가와 비교해 정한다. false 면 상승색
    magnet: string;             // 자석: 도형의 점을 캔들의 시가·고가·저가·종가에 붙이는 정도 (off, weak, strong)
    grid?: boolean;                 // 격자선(가로·세로)을 그을지. 비우면 긋는다
    trades?: boolean;               // 내 매매(매수·매도 지점, 평단가 선)를 표시할지. 비우면 표시하지 않는다
    magnetIndicators?: boolean;    // 자석을 가격 영역의 지표 선(이동평균선 등)에도 붙일지. 비우면 붙이지 않는다
    volumeRatio?: number | null;    // 가격+거래량 높이 중 거래량 영역의 비율. 비우면 기본 비율
    mainHeight?: number | null;     // 가격+거래량 영역의 높이(px). 비우면 화면이 정한 높이
    // 차트 아래에 따로 영역을 차지하는 지표(RSI, MACD 등)를 위에서 아래로 놓는 순서. 지표 이름의 목록이고,
    // 여기 없는 지표는 그 뒤에 정해진 순서로 놓인다. 비우면 정해진 순서
    paneOrder?: string[] | null;
}

/** 회원이 한 종목 차트에 그린 선 */
export interface ChartDrawingRes {
    drawings: Drawing[];
}
