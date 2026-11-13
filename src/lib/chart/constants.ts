// 엔진 전체가 함께 쓰는 배치 상수 (CSS px). 한 파일에서만 쓰는 상수는 그 파일에 둔다.

/** 보조지표 영역 하나의 높이. 래퍼가 전체 높이를 정할 때도 쓴다. */
export const INDICATOR_PANE_HEIGHT = 90;

export const PRICE_AXIS_WIDTH = 64;
export const TIME_AXIS_HEIGHT = 24;
export const PADDING_TOP = 8;
export const FONT_SIZE = 11;
export const AXIS_LABEL_OFFSET = 6;
export const BODY_RATIO = 0.7;          // 한 칸 중 캔들 몸통이 차지하는 비율
export const SERIES_LINE_WIDTH = 1;     // 이동평균선·지표선 굵기. 캔들을 가리지 않게 가늘게 둔다
export const DRAG_THRESHOLD = 3;        // 이만큼 움직여야 드래그로 본다

// 축 위에 덧붙이는 라벨 (십자선, 현재가, 가격선, 수평선)
export const AXIS_TAG_HEIGHT = 18;
export const AXIS_TAG_PADDING = 6;

// 값 표시 (왼쪽 위의 시고저종, 이동평균, 보조지표 이름과 값)
export const LEGEND_LEFT = 8;
export const LEGEND_HEIGHT = 18;
export const LEGEND_GAP = 4;            // 이름과 값 사이
export const LEGEND_ITEM_GAP = 10;      // 항목 사이

// 가격 영역이 시작하는 높이. 그 위는 값 표시 두 줄(시고저종, 이동평균) 전용이라 캔들이 들어오지 않는다
export const PRICE_PANE_TOP = PADDING_TOP + LEGEND_HEIGHT * 2 + 4;
