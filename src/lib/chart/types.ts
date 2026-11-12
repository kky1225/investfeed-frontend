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

/** 차트 아래 별도 영역에 그리는 보조지표 */
export type IndicatorType = 'rsi' | 'macd';

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
    lineColors: string[],       // 이동평균선 색. 기간 순서대로 돌려 쓴다
    fontFamily: string,
}
