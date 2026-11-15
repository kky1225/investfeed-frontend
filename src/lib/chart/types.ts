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
    // 마지막 캔들보다 오른쪽(미래 구간)에 놓은 점이면, time 의 캔들에서 뒤로 몇 칸인지.
    // 캔들이 새로 생겨도 제자리에 있지만, 주기를 바꾸면 한 칸의 길이가 달라져 위치가 어긋날 수 있다
    offset?: number | null,
}

/** 도형의 꾸미기. 비워 두면 기본값(흰색 계열, 굵기 1, 실선) */
export interface DrawingStyle {
    color?: number | null,      // style.lineColors 안에서의 순번
    lineWidth?: number | null,  // 1~3. 글자 도형에서는 글자 크기의 단계
    dashed?: boolean | null,
}

/**
 * 자석: 도형의 점을 놓거나 고칠 때 그 칸 캔들의 시가·고가·저가·종가에 붙인다.
 * weak 는 가까울 때만, strong 은 거리와 상관없이 항상 붙는다.
 * Ctrl(Mac 은 ⌘)을 누르는 동안은 반대로 동작한다(꺼져 있으면 weak, 켜져 있으면 꺼짐).
 */
export type MagnetMode = 'off' | 'weak' | 'strong';

export const MAGNET_MODES: MagnetMode[] = ['off', 'weak', 'strong'];

/** 글자 도형의 최대 길이 */
export const MAX_DRAWING_TEXT_LENGTH = 100;

/**
 * 글자를 입력받아 달라는 요청. 엔진은 캔버스만 그리므로 입력 칸은 바깥(React)에서 띄운다.
 * 새 글자면 id 가 null 이고, 입력이 끝나면 엔진의 addText 로 넘긴다. 고치는 것이면 id 가 그 도형이다.
 */
export interface TextRequest {
    id: string | null,
    text: string,       // 지금 적혀 있는 내용. 새 글자면 빈 문자열
    anchor: Anchor,     // 글자가 놓일 자리
    x: number,          // 입력 칸을 띄울 화면 위치 (차트 영역 기준, CSS px). 글자의 왼쪽 가운데
    y: number,
}

/** 사용자가 차트에 직접 그린 도형 */
export type Drawing = { id: string } & DrawingStyle & (
    | { type: 'trend', from: Anchor, to: Anchor }       // 추세선: 두 점을 잇는 선분
    | { type: 'ray', from: Anchor, to: Anchor }         // 반직선: from 에서 to 방향으로 끝없이
    | { type: 'rectangle', from: Anchor, to: Anchor }   // 사각형: 두 점이 대각선 모서리
    | { type: 'channel', from: Anchor, to: Anchor, third: Anchor }  // 평행 채널: from-to 선과, third 를 지나는 평행선
    // 피보나치 되돌림: from(1)에서 to(0)까지의 높이를 정해진 비율로 나눈 가로선들
    | { type: 'fibonacci', from: Anchor, to: Anchor }
    // 가격 범위 측정: from 에서 to 까지의 가격 차이·등락률·캔들 수를 적은 상자
    | { type: 'measure', from: Anchor, to: Anchor }
    | { type: 'text', from: Anchor, text: string }      // 글자. from 이 글자의 왼쪽 가운데
    | { type: 'horizontal', price: number }             // 수평선
    | { type: 'vertical', time: number, offset?: number | null }    // 수직선. offset 은 Anchor 의 것과 같다
);

export type DrawingTool = Drawing['type'];

/** 도구 목록에 보이는 순서 */
export const DRAWING_TOOLS: DrawingTool[] = [
    'trend', 'ray', 'horizontal', 'vertical', 'rectangle', 'channel', 'fibonacci', 'measure', 'text',
];

/**
 * 가격을 그리는 방식. 어느 것이든 거래량·지표·십자선·그리기는 똑같이 동작한다.
 * candle 캔들 / bar 봉(세로선 + 왼쪽 시가·오른쪽 종가 눈금) / line 종가 선 / area 선 아래를 채움
 * / heikinAshi 평균값으로 다시 만든 캔들(값 표시와 현재가 선은 실제 가격)
 */
export type ChartType = 'candle' | 'bar' | 'line' | 'area' | 'heikinAshi';

export const CHART_TYPES: ChartType[] = ['candle', 'bar', 'line', 'area', 'heikinAshi'];

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
