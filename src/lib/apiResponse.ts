import type {ApiResponse} from '../type/AuthType';

/**
 * 백엔드 응답 wrapper 검증 + result 추출.
 *
 * 이 프로젝트의 API 응답 컨벤션 (`type/AuthType.ts` 의 `ApiResponse<T>`):
 *   { code: "0000", message: "OK", result: ... }   // 성공
 *   { code: "ERROR_xxxx", message: "...", result: null }  // 비즈니스 실패 (HTTP 200)
 *
 * axios interceptor 는 HTTP 4xx/5xx 만 처리하므로,
 * HTTP 200 + code !== "0000" 케이스는 useQuery 의 queryFn 안에서 명시적으로 throw 해야
 * `isError: true` 로 인식되어 화면에 에러 표시 가능.
 *
 * 사용:
 * ```
 * queryFn: async () => unwrapResponse(await fetchPriceTargets(), [])
 * ```
 */
export function unwrapResponse<T>(
    res: ApiResponse<T>,
    fallback: T,
): T {
    if (res.code !== "0000") {
        throw new Error(res.message || `요청 실패 (${res.code})`);
    }
    return res.result ?? fallback;
}
