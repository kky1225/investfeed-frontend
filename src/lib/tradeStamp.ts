/**
 * 폴링 / WebSocket 응답에 들어있는 trade timestamp 를 epoch millis 로 정규화.
 *
 * 같은 자산에 대해 폴링 path 와 WS path 가 독립적으로 도착하므로,
 * 두 path 의 가격 갱신을 머지할 때 더 오래된 stamp 가 더 새로운 stamp 를 덮어쓰는
 * race (stale window) 가 발생할 수 있다. `parseTradeStamp` 로 양쪽 stamp 를
 * 같은 단위 (epoch ms) 로 환산한 뒤 last-write-wins 비교에 사용한다.
 *
 * 지원 포맷:
 *   - "yyyyMMdd HHmmss" / "yyyyMMddHHmmss"   (키움 / 키움 WS)
 *   - "yyyy-MM-ddTHH:mm:ss" (ISO, Upbit)
 *   - "yyyyMMdd" (날짜만 — 시간은 00:00:00 로 취급)
 *
 * 파싱 실패 / undefined 는 0 반환 (가장 오래된 값으로 취급되어
 * 최초 1회는 반드시 setState 가 일어나도록 함).
 */
export function parseTradeStamp(raw: string | undefined | null): number {
    if (!raw) return 0;

    // ISO: 2026-03-17T14:30:55(.xxx)
    if (raw.includes('T') || raw.includes('-')) {
        const t = Date.parse(raw);
        return Number.isFinite(t) ? t : 0;
    }

    // 숫자만 (공백 제거): 20260317143055 / 20260317
    const cleaned = raw.replace(/\s+/g, '');
    if (!/^\d+$/.test(cleaned)) return 0;

    if (cleaned.length < 8) return 0;

    const year = Number(cleaned.substring(0, 4));
    const month = Number(cleaned.substring(4, 6)) - 1;
    const day = Number(cleaned.substring(6, 8));
    const hour = cleaned.length >= 10 ? Number(cleaned.substring(8, 10)) : 0;
    const minute = cleaned.length >= 12 ? Number(cleaned.substring(10, 12)) : 0;
    const second = cleaned.length >= 14 ? Number(cleaned.substring(12, 14)) : 0;

    const t = new Date(year, month, day, hour, minute, second).getTime();
    return Number.isFinite(t) ? t : 0;
}

/**
 * 키움 시세 stamp — 폴링은 yyyyMMddHHmm (12자리) 형태이지만
 * WS values["20"] 는 HHmmss (6자리) 만 보낼 수 있다. 6자리 입력은 오늘 날짜를
 * prefix 로 붙여 epoch ms 로 정규화 → 폴링 stamp 와 같은 단위로 비교 가능.
 *
 * 8자리 이상은 parseTradeStamp 위임.
 */
export function parseKiwoomStamp(raw: string | undefined | null): number {
    if (!raw) return 0;
    const cleaned = raw.replace(/\s+/g, '');
    if (/^\d{1,6}$/.test(cleaned)) {
        const now = new Date();
        const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        return parseTradeStamp(ymd + cleaned.padStart(6, '0'));
    }
    return parseTradeStamp(cleaned);
}
