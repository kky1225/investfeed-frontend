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
        /** true 면 2차 인증 필요(403) 시 다이얼로그를 띄우지 않고 그대로 reject — 사용자가 직접 요청하지 않은 자동 재조회용 */
        secondaryAuthSilent?: boolean;
        /**
         * true 면 화면 시작 때 로그인 여부를 묻는 호출. 연장에 실패해도 세션 만료 Dialog 를 띄우지 않는다
         * (로그인하지 않은 새 탭은 조용히 로그인 화면으로 간다). 다른 곳 로그인(AUTH_4018)만 안내한다
         */
        sessionCheck?: boolean;
    }
}
