import {wsUrl} from './wsUrl.ts';

// 서버 WebSocketHandler 와 값을 맞출 것
const HEARTBEAT = '{"trnm":"PING"}';
const LOGGED_OUT_CODE = 4001;

const BASE_RETRY_MS = 3_000;
const MAX_RETRY_MS = 60_000;
const STABLE_CONNECTION_MS = 10_000;   // 이 시간 이상 유지돼야 정상 연결로 간주
const SILENCE_LIMIT_MS = 60_000;       // 하트비트 30초 기준, 1개를 놓쳐도 끊지 않는 값
const SILENCE_CHECK_MS = 10_000;

let isSessionExpired = false;
if (typeof window !== 'undefined') {
    window.addEventListener('show-session-expired', () => {
        isSessionExpired = true;
    });
    window.addEventListener('reset-session-expired', () => {
        isSessionExpired = false;
    });
}

export interface ReconnectingSocket {
    close: () => void;
}

/**
 * 실시간 구독 소켓. 등록 API 호출 후 소켓을 열고, 끊기면 등록부터 다시 시도한다.
 * 구독 정보가 서버 메모리에 있어 서버 재시작 후에는 소켓만 다시 열어서는 시세가 오지 않는다.
 *
 * register 는 실패 시 reject 해야 한다. 실패를 삼키면 등록 없이 소켓만 열린다.
 */
export function openReconnectingSocket(opts: {
    register: () => Promise<unknown>;
    onMessage: (event: MessageEvent) => void;
}): ReconnectingSocket {
    let stopped = false;
    let attempt = 0;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let silenceTimer: ReturnType<typeof setInterval> | undefined;

    const scheduleRetry = () => {
        if (stopped || isSessionExpired) return;
        const delay = Math.min(BASE_RETRY_MS * 2 ** attempt, MAX_RETRY_MS);
        attempt++;
        retryTimer = setTimeout(connect, delay);
    };

    const openSocket = () => {
        const ws = new WebSocket(wsUrl('/ws'));
        socket = ws;
        let openedAt: number | null = null;
        let lastReceivedAt = Date.now();

        // 10초 이상 유지된 연결이었을 때만 재시도 간격을 처음(3초)으로 되돌린다.
        // 연결 직후 끊기면(인증 실패 등) 되돌리지 않아 간격이 계속 늘어난다.
        const onDisconnected = () => {
            clearInterval(silenceTimer);
            socket = null;
            if (openedAt != null && Date.now() - openedAt >= STABLE_CONNECTION_MS) {
                attempt = 0;
            }
        };

        // 서버가 멈추면 onclose 가 오지 않으므로 수신이 끊긴 것으로 판단한다
        silenceTimer = setInterval(() => {
            if (Date.now() - lastReceivedAt < SILENCE_LIMIT_MS) return;
            ws.onclose = null;
            ws.onmessage = null;
            ws.close();
            onDisconnected();
            scheduleRetry();
        }, SILENCE_CHECK_MS);

        ws.onopen = () => {
            openedAt = Date.now();
            lastReceivedAt = openedAt;
        };
        ws.onmessage = (event) => {
            lastReceivedAt = Date.now();
            if (event.data === HEARTBEAT) return;
            opts.onMessage(event);
        };
        ws.onclose = (event) => {
            onDisconnected();
            if (event.code === LOGGED_OUT_CODE) {
                stopped = true;
                return;
            }
            scheduleRetry();
        };
    };

    const connect = async () => {
        if (stopped || isSessionExpired) return;
        try {
            await opts.register();
        } catch (error) {
            console.error('[StreamSocket] 등록 실패:', error);
            scheduleRetry();
            return;
        }
        if (!stopped) openSocket();
    };

    void connect();

    return {
        close: () => {
            stopped = true;
            clearTimeout(retryTimer);
            clearInterval(silenceTimer);
            if (socket) {
                socket.onclose = null;
                socket.onmessage = null;
                socket.close();
                socket = null;
            }
        },
    };
}
