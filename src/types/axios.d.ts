import 'axios';

/**
 * axios declaration merging.
 * 전역 에러 Dialog 를 폴링 등 특정 호출에서 skip 하기 위한 커스텀 config 프로퍼티.
 *
 * 사용 예:
 *   // 폴링 호출 (에러 시 Dialog 표출 안 함)
 *   fetchInvestorList(req, { skipGlobalError: true });
 */
declare module 'axios' {
    export interface AxiosRequestConfig {
        skipGlobalError?: boolean;
        /** 2차 인증 다이얼로그 출처 표시. 'assistant' 면 취소 시 화면 이동 없음 */
        secondaryAuthSource?: string;
        /** true 면 2차 인증 필요(403) 시 다이얼로그를 띄우지 않고 그대로 reject — 사용자가 직접 요청하지 않은 자동 재조회용 */
        secondaryAuthSilent?: boolean;
    }
}
