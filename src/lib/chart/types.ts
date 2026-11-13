/** 캔들 한 개. 가로축은 time 이 아니라 배열 순번으로 배치한다(휴장일·장 사이 공백 없음). */
export interface Candle {
    time: number,   // epoch ms. 눈금 라벨 표시에만 사용
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number,
}

/** 날짜 눈금 표기 단위. minute=HH:mm, day=YYYY.MM.DD, month=YYYY.MM, year=YYYY */
export type TimeUnit = 'minute' | 'day' | 'month' | 'year';

/** 특정 가격에 긋는 가로선 (목표가 등) */
export interface PriceLine {
    price: number,
    title: string,                      // 선 왼쪽에 적는 이름
    tone: 'up' | 'down' | 'neutral',    // 색: 상승색 / 하락색 / 글자색
}

/** 그린 도형이 붙는 자리. 화면 좌표가 아니라 캔들 시각과 가격에 고정된다. */
export interface Anchor {
    time: number,   // 캔들 시각 (epoch ms)
    price: number,
}

/** 사용자가 차트에 직접 그린 도형 */
export type Drawing =
    | { id: string, type: 'trend', from: Anchor, to: Anchor }  // 추세선: 두 점을 잇는 선분
    | { id: string, type: 'horizontal', price: number };       // 수평선

export type DrawingTool = Drawing['type'];

/**
 * 보조지표. 그려지는 자리는 지표마다 정해져 있다(indicatorPanes.ts 의 INDICATORS):
 * bollinger 는 가격 영역, volumeAverage 는 거래량 영역, 나머지는 차트 아래 별도 영역
 */
export type IndicatorType = 'bollinger' | 'volumeAverage' | 'rsi' | 'macd' | 'stochastic';

/** 켜 둔 지표 하나와 그 설정값. params 의 순서와 뜻은 INDICATORS 의 params 를 따른다. 비우면 기본값 */
export interface IndicatorConfig {
    type: IndicatorType,
    params?: number[],
}

/** 캔들 한 개가 담는 기간. 실시간 체결이 어느 캔들에 들어갈지 정하는 데 쓴다. */
export type CandleInterval =
    | { unit: 'minute', count: number }     // count 분봉
    | { unit: 'day' | 'week' | 'month' | 'year' };

/** 실시간 체결 한 건 */
export interface Tick {
    time: number,       // epoch ms
    price: number,
    volume: number,     // 이 체결의 수량
}

/** 캔버스는 CSS 변수를 못 읽으므로, 테마에서 풀어낸 실제 색 문자열을 넘긴다. */
export interface ChartStyle {
    upColor: string,     // 상승 (종가 > 시가)
    downColor: string,   // 하락 (종가 < 시가)
    textColor: string,   // 축 글자, 보합 캔들
    gridColor: string,   // 격자, 축 경계선
    backgroundColor: string,    // 십자선 라벨 글자, 값 표시 바탕
    lineColors: string[],       // 선 색. 이동평균선은 기간 순서대로, 지표는 정해진 순번의 색을 쓴다
    fontFamily: string,
}
