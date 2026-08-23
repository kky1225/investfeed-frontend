import type {MarketIndexRes} from "./MarketIndexType.ts";

export interface UsExchangeRateItem {
    exchTp: string | null; // 환전구분 1:원화(KRW)->달러(USD), 2:달러(USD)->원화(KRW)
    sellAplcExrt: string | null; // 매도적용환율
    buyAplcExrt: string | null; // 매수적용환율
    aplcExrt: string | null; // 적용환율
    exrtTpNm: string | null; // 환율구분명 (예: 고시환율)
    spclBfExrt: string | null; // 우대율 적용 전 환율
    exrtSpclRt: string | null; // 환율우대율
}

export interface UsExchangeRateRes {
    krwToUsd: UsExchangeRateItem | null;
    usdToKrw: UsExchangeRateItem | null;
    marketIndex: MarketIndexRes | null;
}
