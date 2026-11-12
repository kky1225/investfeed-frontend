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

/** 캔버스는 CSS 변수를 못 읽으므로, 테마에서 풀어낸 실제 색 문자열을 넘긴다. */
export interface ChartStyle {
    upColor: string,     // 상승 (종가 > 시가)
    downColor: string,   // 하락 (종가 < 시가)
    textColor: string,   // 축 글자, 보합 캔들
    gridColor: string,   // 격자, 축 경계선
    backgroundColor: string,    // 십자선 라벨 글자, 값 표시 바탕
    fontFamily: string,
}
