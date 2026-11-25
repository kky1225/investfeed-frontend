/**
 * 국내 지수 화면(지수 상세·주요 지수·대시보드) 우측 상단의 기준 시각 문구. 예: "2026.11.13 09:42", "2026.11.13 장마감".
 * 세 화면 모두 키움 업종 현재가의 시각(tm_n, HHmmss)을 받으므로 같은 규칙으로 읽는다.
 *
 * @param ymd 기준 날짜 yyyyMMdd. 없으면 undefined (화면은 받아 온 시각을 대신 표시)
 * @param tmN 키움 시각 HHmmss. 없으면 날짜만
 */
export const indexAsOfLabel = (ymd: string | null | undefined, tmN: string | null | undefined): string | undefined => {
    if (!ymd || !/^\d{8}$/.test(ymd)) return undefined;
    const date = `${ymd.substring(0, 4)}.${ymd.substring(4, 6)}.${ymd.substring(6, 8)}`;
    if (!tmN || !/^\d{1,6}$/.test(tmN)) return date;

    // 앞자리 0 이 빠져 와도("93000") 시·분을 바르게 읽도록 6자리로 채운다
    const time = tmN.padStart(6, '0');
    const hour = Number(time.substring(0, 2));
    const minute = Number(time.substring(2, 4));
    // 장마감 표시값("888888"·"999999")이거나 정규장(09:00~15:30) 밖이면 장마감.
    // 시와 분을 함께 비교해야 16:05 같은 시각도 장마감이 된다
    const timeOfDay = hour * 100 + minute;
    if (hour > 23 || timeOfDay >= 1530 || timeOfDay < 900) return `${date} 장마감`;
    return `${date} ${time.substring(0, 2)}:${time.substring(2, 4)}`;
};
