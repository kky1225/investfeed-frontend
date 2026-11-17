import type {CandleInterval, TimeUnit} from "../../lib/chart/types.ts";
import type {AssetType} from "../../type/NotificationType.ts";

// 자산 종류별 차트 규칙. 상세 화면과 멀티 화면이 모두 AssetChart 를 거쳐 이 규칙을 쓴다.
// 종류마다 다른 것(분봉 단위, 저장 기준, 비교·과거 조회 여부)은 여기 한 곳만 고친다.

/** 차트를 보여 주는 자산의 종류 */
export type ChartMarket = 'STOCK' | 'US_STOCK' | 'CRYPTO' | 'INDEX' | 'COMMODITY';

interface MarketChartRule {
    minutes: number[],      // 고를 수 있는 분봉 단위
    defaultMinute: number,  // 분봉을 처음 고를 때의 단위
    year: boolean,          // 연봉이 있는지
    // 분봉에서 캔들 마감까지 남은 시간을 적을지. 미국 종목은 분봉 시각이 미국 동부 시각이라 기기 시계와 맞지 않아 적지 않는다
    countdown: boolean,
    // 그린 선·목표가를 저장하는 기준. 미국 종목·지수·원자재는 종목 코드와 겹치지 않게 코드 뒤에 말을 붙인다
    assetType: AssetType,
    codeSuffix: string,
    comparison: boolean,    // 종목 비교를 쓰는지
    history: boolean,       // 과거 구간을 이어 받는 조회가 있는지
}

export const MARKET_CHART_RULES: Record<ChartMarket, MarketChartRule> = {
    STOCK: {
        minutes: [1, 3, 5, 10, 15, 30, 60], defaultMinute: 1, year: true, countdown: true,
        assetType: 'STOCK', codeSuffix: '', comparison: true, history: true,
    },
    US_STOCK: {
        minutes: [1, 3, 5, 10, 30], defaultMinute: 3, year: true, countdown: false,
        assetType: 'STOCK', codeSuffix: '_US', comparison: true, history: false,
    },
    CRYPTO: {
        minutes: [1, 3, 5, 10, 30], defaultMinute: 3, year: true, countdown: true,
        assetType: 'CRYPTO', codeSuffix: '', comparison: true, history: false,
    },
    INDEX: {
        minutes: [1, 3, 5, 30], defaultMinute: 1, year: true, countdown: true,
        assetType: 'STOCK', codeSuffix: '_INDEX', comparison: true, history: false,
    },
    COMMODITY: {
        minutes: [1, 3, 5, 30], defaultMinute: 1, year: false, countdown: true,
        assetType: 'STOCK', codeSuffix: '_COMMODITY', comparison: false, history: false,
    },
};

const MINUTE_PREFIX = 'MINUTE_';

export const isMinuteChart = (chartType: string) => chartType.startsWith(MINUTE_PREFIX);

/** 분봉 주기 이름 (MINUTE_5) */
export const minuteChartType = (minutes: number | string) => `${MINUTE_PREFIX}${minutes}`;

/** 분봉 주기 이름에서 분 단위를 꺼낸다. 분봉이 아니면 null */
export const minutesOf = (chartType: string): number | null => (
    isMinuteChart(chartType) ? Number(chartType.slice(MINUTE_PREFIX.length)) : null
);

/** 날짜 눈금 표기 단위. 주봉은 날짜까지 적는다 */
export const timeUnitOf = (chartType: string): TimeUnit => {
    if (isMinuteChart(chartType)) return 'minute';
    if (chartType === 'MONTH') return 'month';
    if (chartType === 'YEAR') return 'year';
    return 'day';
};

// 같은 주기에는 늘 같은 객체를 돌려준다 (차트는 값이 바뀔 때만 다시 계산한다).
const INTERVALS = new Map<string, CandleInterval>();

/** 캔들 한 개가 담는 기간. 실시간 체결이 어느 캔들에 들어갈지 정하는 기준이다 */
export const candleIntervalOf = (chartType: string): CandleInterval => {
    const cached = INTERVALS.get(chartType);
    if (cached) return cached;
    const minutes = minutesOf(chartType);
    const interval: CandleInterval = minutes !== null
        ? {unit: 'minute', count: minutes}
        : {unit: chartType === 'WEEK' ? 'week' : chartType === 'MONTH' ? 'month' : chartType === 'YEAR' ? 'year' : 'day'};
    INTERVALS.set(chartType, interval);
    return interval;
};

/** 차트에 넘길 기간. 캔들 마감까지 남은 시간을 적지 않는 종류면 넘기지 않는다 */
export const countdownIntervalOf = (market: ChartMarket, chartType: string): CandleInterval | undefined => (
    MARKET_CHART_RULES[market].countdown ? candleIntervalOf(chartType) : undefined
);

/** 그린 선과 목표가 알림을 저장하는 기준 */
export const chartStorageOf = (market: ChartMarket, code: string): { assetType: AssetType, assetCode: string } => {
    const rule = MARKET_CHART_RULES[market];
    return {assetType: rule.assetType, assetCode: `${code}${rule.codeSuffix}`};
};
