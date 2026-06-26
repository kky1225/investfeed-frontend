/**
 * 관리자 — 추천 시스템 일일 운영 모니터링 타입.
 *
 * 백엔드 `domain/recommend/admin/dto/res/*` 에 대응.
 */

export type ModuleTrigger = 'PROMOTE' | 'DEMOTE' | 'NONE' | null;
export type RecommendType = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
export type MacroScenario =
    | 'UP_BUY_BUY'           // 케이스 1: BUY 격상
    | 'UP_BUY_SELL'          // 케이스 2: 다이버전스 유지
    | 'UP_SELL_SELL'         // 케이스 3: BUY 격하
    | 'DOWN_SELL_SELL'       // 케이스 4: SELL 격상
    | 'DOWN_BUY_SELL'        // 케이스 5: 다이버전스 유지
    | 'DOWN_BUY_BUY'         // 케이스 6: SELL 격하
    | 'NEUTRAL'              // 기타
    | null;

export interface AdminRecommendPickRes {
    // Signal
    stkCd: string;
    stkNm: string;
    marketType: string | null;
    originSide: string | null;
    type: string;                          // raw classify 등급 (수급/백본, 모듈 보정 전)
    effectiveType: string;                 // Stage1 모듈 보정 최종 등급 (전체 모듈 ON, 매크로 제외)

    // 수급 (백본 근거) — 왜 이 등급인지
    backboneReason: string;                // classify 근거 한 줄
    penfndK: number | null;                // 연기금 K (≥3.0 + B′통과 → STRONG)
    frgnrBlocked: boolean | null;          // 외국인 반대매매 BLOCK 여부
    frgnrOppositeK: number | null;         // 외국인 반대 K (강반대 3.0↑ HOLD / 중간 1.5~3.0 방향유지)
    frgnrMcapRatio: number | null;         // 외국인 시총비중 signed (≥0.1% STRONG / ≥0.05% 일반)
    frgnrSameDirK: number | null;          // 외국인 동조 K (history 만)
    priorTrendRatio: number | null;        // B′ 추세 명확성 (≥0.7 STRONG 게이트)
    foreignerAligned: boolean | null;      // 옵션B: 외국인 12일 동조
    marketCap: number | null;              // 시총(억) (history 만)

    // 후행 모듈 trigger — 매크로(동행지표) 제외
    pvTrigger: ModuleTrigger;
    maTrigger: ModuleTrigger;
    vpTrigger: ModuleTrigger;
    rsiTrigger: ModuleTrigger;
    hl52wTrigger: ModuleTrigger;
    breakoutTrigger: ModuleTrigger;

    // 후행 raw 지표
    rsi14: number | null;
    rsi14Breakdown70: boolean | null;
    ma5: number | null;
    ma20: number | null;
    flu5Pct: number | null;
    todayChangeRate: number | null;
    todayVolume: number | null;
    avg20dVolume: number | null;

    // 사이징 (변동성 스케일 캡)
    realizedVol: number | null;            // 20일 실현변동성(연율, ratio)
    volCapRatio: number | null;            // 적용 종목당 캡(ratio 0.05~0.10) = volCap(realizedVol)

    // 52주 위치 — 키움 ka10001 공식 250일 고저 (HighLow52w/Breakout 공용)
    high52w: number | null;
    low52w: number | null;
    distFromHigh52w: number | null;     // % (음수)
    distFromLow52w: number | null;      // % (양수)
    closeAboveMa20: boolean | null;

    // 가격 + Performance (history 조회 시만)
    pickDate: string | null;               // YYYY-MM-DD
    pickPrice: number | null;
    priceOpen1d: number | null;
    priceClose1d: number | null;
    priceClose5d: number | null;
    priceClose20d: number | null;
    ret1d: number | null;                  // %
    ret5d: number | null;
    ret20d: number | null;
}

// ── Aggregate Metrics ───────────────────────────────────────────────────────
export interface AdminBacktestMetricsRes {
    periodDays: number;
    totalSignals: number;
    insufficientReason: string | null;
    metrics1d: HorizonMetrics;
    metrics5d: HorizonMetrics;
    metrics20d: HorizonMetrics;
    byType: GroupMetrics[];
    byOriginSide: GroupMetrics[];
}

export interface HorizonMetrics {
    horizon: string;
    evaluable: number;
    meanReturn: number | null;
    hitRate: number | null;
    stdDev: number | null;
    maxReturn: number | null;
    minReturn: number | null;
    // 같은 표본 같은 N영업일 시장 평균 등락률 (KOSPI/KOSDAQ 시장구분별 가중평균)
    marketMeanReturn: number | null;
}

export interface GroupMetrics {
    groupKey: string;
    count: number;
    // 1d/5d/20d 각각 신호 평균 + 시장 평균
    signalMean1dPct: number | null;
    marketMean1dPct: number | null;
    signalMean5dPct: number | null;
    marketMean5dPct: number | null;
    signalMean20dPct: number | null;
    marketMean20dPct: number | null;
    hitRate5d: number | null;          // 5d 적중률 (대표)
}

export interface AdminMarketSnapshotRes {
    capturedDate: string;                  // YYYY-MM-DD
    kospiChangeRate: number | null;
    kospiForeignerSign: string | null;
    kospiInstitutionSign: string | null;
    kospiScenario: MacroScenario;
    kosdaqChangeRate: number | null;
    kosdaqForeignerSign: string | null;
    kosdaqInstitutionSign: string | null;
    kosdaqScenario: MacroScenario;
    capturedAt: string;                    // ISO LocalDateTime
}

export interface AdminBackfillStatusRes {
    pickDate: string;                      // YYYY-MM-DD
    totalCount: number;
    filled1d: number;
    filled5d: number;
    filled20d: number;
}
