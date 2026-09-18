import {useCallback, useRef} from 'react';
import {issueAssistantToken} from '../api/assistant/AssistantApi';
import {requireOk} from '../lib/apiResponse';
import type {AssistantTokenRes} from '../type/AssistantType';

const REFRESH_BEFORE_MS = 60_000;

/**
 * 비서 토큰(RS256, 5분). 메모리에만 두고 만료 60초 전이면 재발급. 401 시 호출부가 invalidate() 후 재시도.
 * 발급 경로는 2차 인증 보호 — 인터셉터가 다이얼로그를 띄운다.
 */
export function useAssistantToken() {
    const ref = useRef<AssistantTokenRes | null>(null);

    const getToken = useCallback(async (): Promise<string> => {
        const cur = ref.current;
        if (cur && new Date(cur.expiresAt).getTime() - Date.now() > REFRESH_BEFORE_MS) return cur.token;
        const issued = requireOk<AssistantTokenRes>(await issueAssistantToken(), '비서 토큰 발급');
        ref.current = issued;
        return issued.token;
    }, []);

    const invalidate = useCallback(() => { ref.current = null; }, []);

    return {getToken, invalidate};
}
