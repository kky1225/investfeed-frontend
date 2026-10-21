/** 미국 장구분 등락률(%): 실시간 가격과 기준 정규장 종가. 둘 중 하나라도 없으면 null */
export function sessionChangeRate(price: number | null | undefined, regularClose: number | null | undefined): number | null {
    if (!price || !regularClose) return null;
    return (price / regularClose - 1) * 100;
}
