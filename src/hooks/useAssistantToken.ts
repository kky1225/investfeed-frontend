import {useCallback, useRef} from 'react';
import {issueAssistantMarketToken, issueAssistantToken} from '../api/assistant/AssistantApi';
import {requireOk} from '../lib/apiResponse';
import type {AssistantTokenRes} from '../type/AssistantType';

const REFRESH_BEFORE_MS = 60_000;

/** personal: 2차 인증 후 발급된 토큰인가 (개인 질문 가능). 아니면 시장 질문 전용 */
export interface AssistantToken {
    token: string;
    personal: boolean;
}

interface Held extends AssistantToken {
    expiresAt: string;
}

const alive = (t: Held | null): t is Held => !!t && new Date(t.expiresAt).getTime() - Date.now() > REFRESH_BEFORE_MS;

/**
 * 비서 토큰(RS256, 5분). 메모리에만 두고 만료 60초 전이면 재발급. 401 시 호출부가 invalidate() 후 재시도.
 * 시장 질문은 2차 인증 없이 시장 토큰으로 보내고, 개인 질문일 때만 2차 인증 경로의 개인 토큰을 받는다.
 */
export function useAssistantToken() {
    const ref = useRef<Held | null>(null);

    const hold = useCallback((res: AssistantTokenRes, personal: boolean): AssistantToken => {
        ref.current = {token: res.token, expiresAt: res.expiresAt, personal};
        return {token: res.token, personal};
    }, []);

    /**
     * 질문 전송용. 다이얼로그를 띄우지 않는다 — 이미 2차 인증된 상태면 개인 토큰, 아니면 시장 토큰.
     * preferPersonal: 들고 있는 시장 토큰이 살아 있어도 개인 토큰을 다시 시도한다 (타임라인에서 방금 인증한 경우)
     */
    const getToken = useCallback(async (preferPersonal: boolean): Promise<AssistantToken> => {
        const cur = ref.current;
        if (alive(cur) && (cur.personal || !preferPersonal)) return cur;
        try {
            return hold(requireOk<AssistantTokenRes>(await issueAssistantToken({secondaryAuthSilent: true, skipGlobalError: true}), '비서 토큰 발급'), true);
        } catch {
            // 2차 인증 전 — 시장 토큰으로 보낸다
        }
        if (alive(cur)) return cur;
        return hold(requireOk<AssistantTokenRes>(await issueAssistantMarketToken(), '비서 토큰 발급'), false);
    }, [hold]);

    /** 개인 질문용. 2차 인증이 안 되어 있으면 인터셉터가 다이얼로그를 띄운다. 취소하면 reject */
    const getPersonalToken = useCallback(async (): Promise<AssistantToken> => {
        const cur = ref.current;
        if (alive(cur) && cur.personal) return cur;
        return hold(requireOk<AssistantTokenRes>(await issueAssistantToken(), '비서 토큰 발급'), true);
    }, [hold]);

    const invalidate = useCallback(() => { ref.current = null; }, []);

    return {getToken, getPersonalToken, invalidate};
}
