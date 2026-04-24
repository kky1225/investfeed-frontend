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
    }
}
