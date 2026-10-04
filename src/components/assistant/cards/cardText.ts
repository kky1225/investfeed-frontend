import type {StockInvestorFlowPayload} from '../../../type/AssistantType';

/**
 * 카드 위 비서 말풍선 문구 (LLM 아님, 카드 데이터로 만드는 고정 문구).
 * 종목 수급: 외국인·기관 연속 순매수/순매도가 2일 이상일 때만 (2026-10-01)
 */
const side = (n: number) => (n > 0 ? '순매수' : '순매도');
const run = (n: number) => `${Math.abs(n)}일 연속 ${side(n)}`;
const meaningful = (n: number) => (Math.abs(n) >= 2 ? n : 0);

/** 받침 있는 영문자 발음 (L·M·N·R → 엘·엠·엔·알) */
const LATIN_WITH_BATCHIM = new Set(['L', 'M', 'N', 'R']);

/** 종목명 + 은/는. 한글은 마지막 글자 받침, 영문·숫자로 끝나면 발음 기준 (삼성전자는 · LG에너지솔루션은 · TLT는) */
export function topic(name: string): string {
    const last = name.trim().slice(-1);
    const code = last.charCodeAt(0);
    let batchim: boolean;
    if (code >= 0xac00 && code <= 0xd7a3) batchim = (code - 0xac00) % 28 !== 0;
    else if (/[0-9]/.test(last)) batchim = '013678'.includes(last);   // 영·일·삼·육·칠·팔
    else batchim = LATIN_WITH_BATCHIM.has(last.toUpperCase());
    return `${name}${batchim ? '은' : '는'}`;
}

/** 종목 1개의 연속 순매수·순매도 문구 (종목명 포함). 없으면 null */
export function streakText(f: StockInvestorFlowPayload): string | null {
    const fo = meaningful(f.foreignStreak);
    const ins = meaningful(f.institutionStreak);
    const who = topic(f.name);
    if (fo && ins) {
        return fo === ins ? `${who} 외국인과 기관 모두 ${run(fo)}예요` : `${who} 외국인 ${run(fo)}, 기관 ${run(ins)}예요`;
    }
    if (fo) return `${who} 외국인이 ${run(fo)}예요`;
    if (ins) return `${who} 기관이 ${run(ins)}예요`;
    return null;
}
