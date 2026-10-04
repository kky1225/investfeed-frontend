import type {ChatPick} from '../../type/AssistantType';

/**
 * Python 비서 서비스(/assistant/**, Vite 프록시 → 8000) 호출. axios 인스턴스(/api, 쿠키)와 분리한다.
 * 인증은 Authorization: Bearer <비서 토큰> 만. 쿠키(사용자 JWT)는 보내지 않는다 (credentials: 'omit').
 */

export async function assistantHealth(): Promise<boolean> {
    try {
        const res = await fetch('/assistant/health', {credentials: 'omit'});
        return res.ok;
    } catch {
        return false;
    }
}

/** HTTP 오류. status 401 이면 호출부가 비서 토큰을 버리고 한 번 재시도한다 */
export class AssistantChatError extends Error {
    readonly status: number;
    constructor(status: number) {
        super(`비서 응답 오류 (${status})`);
        this.status = status;
    }
}

export interface ChatRequest {
    message: string;
    pick?: ChatPick;
}

/**
 * 질문 1턴 (POST /assistant/chat, SSE).
 * 이벤트: meta {requestId} → card TurnCard* → reply {text, route} → done {requestId, saved}
 */
export async function assistantChat(token: string, req: ChatRequest, onEvent: (event: string, data: unknown) => void, signal?: AbortSignal): Promise<void> {
    const res = await fetch('/assistant/chat', {
        method: 'POST',
        credentials: 'omit',
        headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: JSON.stringify(req),
        signal,
    });
    if (!res.ok || !res.body) throw new AssistantChatError(res.status);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        buffer = (buffer + decoder.decode(value, {stream: true})).replace(/\r\n/g, '\n');   // sse-starlette 는 CRLF. 청크 경계에서 끊겨도 합친 뒤 정규화
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            let event = 'message';
            const data: string[] = [];
            for (const line of chunk.split('\n')) {
                if (line.startsWith('event:')) event = line.slice(6).trim();
                else if (line.startsWith('data:')) data.push(line.slice(5).trim());
            }
            if (data.length === 0) continue;
            const raw = data.join('\n');
            let parsed: unknown = raw;
            try { parsed = JSON.parse(raw); } catch { /* 문자열 그대로 */ }
            onEvent(event, parsed);
        }
    }
}
