import type {StockPick, WatchlistGroupPick} from '../../type/AssistantType';

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

/**
 * 응답 대기 제한. 비서는 턴 전체 20초 + 저장 5초 안에 끝내고, 그 사이에도 15초마다 ping 을 보낸다.
 * 이 시간 동안 아무것도 오지 않으면 연결이 끊긴 것으로 본다 (비서 재시작 등으로 응답 없이 멈추는 경우)
 */
const IDLE_TIMEOUT_MS = 35_000;
export const STREAM_STALLED = '응답이 중간에 끊겼습니다';

export interface ChatRequest {
    message: string;
    pick?: StockPick;
    /** 관심종목 그룹 목록 카드에서 고른 그룹 */
    group?: WatchlistGroupPick;
    /** 2차 인증 후 이어서 실행 — 비서가 인증 전에 골라 둔 조회를 LLM 재호출 없이 실행한다 */
    resume?: boolean;
}

/**
 * 질문 1턴 (POST /assistant/chat, SSE).
 * 이벤트: meta {requestId} → card TurnCard* → reply {text, route} → done {requestId, saved}
 * route 가 AUTH_REQUIRED 면 개인 질문인데 시장 토큰이었다는 뜻 — 호출부가 2차 인증 후 이어서 보낸다
 */
export async function assistantChat(token: string, req: ChatRequest, onEvent: (event: string, data: unknown) => void, signal?: AbortSignal): Promise<void> {
    // 무응답 감시: 데이터(ping 포함)가 올 때마다 타이머를 다시 건다. 시간이 넘으면 요청을 끊고 STREAM_STALLED 로 알린다
    const controller = new AbortController();
    signal?.addEventListener('abort', () => controller.abort(), {once: true});
    let stalled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => { stalled = true; controller.abort(); }, IDLE_TIMEOUT_MS);
    };
    arm();
    try {
        await readStream(token, req, onEvent, controller.signal, arm);
    } catch (e) {
        if (stalled) throw new Error(STREAM_STALLED);
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

async function readStream(token: string, req: ChatRequest, onEvent: (event: string, data: unknown) => void, signal: AbortSignal, onData: () => void): Promise<void> {
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
        onData();
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
