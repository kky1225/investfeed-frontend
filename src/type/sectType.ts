export interface indexListReq {
    inds_cd: string, // 업종코드 001:종합(KOSPI), 002:대형주, 003:중형주, 004:소형주 101:종합(KOSDAQ), 201:KOSPI200, 302:KOSTAR, 701: KRX100 나머지 ※ 업종코드 참고
    trnm: string, // 서비스명 REG : 등록 , REMOVE : 해지
    grp_no: string, // 그룹번호
    refresh: string, // 기존등록유지여부 등록(REG)시 0:기존유지안함 1:기존유지(Default) 0일경우 기존등록한 item/type은 해지, 1일경우 기존등록한 item/type 유지 해지(REMOVE)시 값 불필요
    data: Array<SectIndexListStream> // 실시간 등록 리스트
}

export interface SectIndexListStream {
    item: Array<string> // 실시간 등록 요소 거래소별 종목코드, 업종코드 (KRX:039490,NXT:039490_NX,SOR:039490_AL)
    type: Array<string> // 실시간 항목 TR 명(0A,0B....)
}
