import type {ApiResponse} from '../type/AuthType';

export function requireOk<T>(res: ApiResponse<T>, fallback: T): T;
export function requireOk<T>(res: ApiResponse<T>, operation: string): T;
export function requireOk<T>(res: ApiResponse<T>, arg: T | string): T {
    if (res.code !== "0000") {
        const op = typeof arg === 'string' ? arg : '요청';
        throw new Error(res.message || `${op} 실패 (${res.code})`);
    }
    if (typeof arg === 'string') {
        // mutation: result 가 없는 응답 (void) 또는 있는 응답 (result 반환)
        // 호출부가 반환값을 무시하면 void mutation, 받으면 result 사용.
        return res.result as T;
    }

    return res.result ?? arg;
}
