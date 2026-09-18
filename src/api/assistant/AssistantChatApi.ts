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

/** 5단계용 SSE 스텁. 1단계에서는 호출하는 화면 없음 */
export async function assistantChat(token: string, message: string, onEvent: (event: string, data: string) => void): Promise<void> {
    const res = await fetch('/assistant/chat', {
        method: 'POST',
        credentials: 'omit',
        headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({message}),
    });
    if (!res.ok || !res.body) throw new Error(`${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
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
            onEvent(event, data.join('\n'));
        }
    }
}
