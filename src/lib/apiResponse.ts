import type {ApiResponse} from '../type/AuthType';

export function requireOk<T>(res: ApiResponse<T>, fallback: T): T;
export function requireOk(res: ApiResponse<unknown>, operation: string): void;
export function requireOk<T>(res: ApiResponse<T>, arg: T | string): T | void {
    if (res.code !== "0000") {
        const op = typeof arg === 'string' ? arg : '요청';
        throw new Error(res.message || `${op} 실패 (${res.code})`);
    }
    if (typeof arg !== 'string') {
        return res.result ?? arg;
    }
}
