import {Drawing} from "./types.ts";

const STORAGE_PREFIX = 'chart-drawings:';

/** 브라우저에 저장해 둔 도형을 읽는다. key 가 없거나 읽을 수 없으면 빈 목록 */
export const loadDrawings = (key: string | undefined): Drawing[] => {
    if (!key) return [];
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed as Drawing[] : [];
    } catch {
        return [];
    }
};

/** 도형을 브라우저에 저장한다. 저장에 실패해도(공간 부족·사생활 보호 모드) 화면 동작은 계속한다. */
export const saveDrawings = (key: string | undefined, drawings: Drawing[]) => {
    if (!key) return;
    try {
        if (drawings.length === 0) {
            localStorage.removeItem(STORAGE_PREFIX + key);
        } else {
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(drawings));
        }
    } catch {
        // 저장 실패는 무시한다.
    }
};
