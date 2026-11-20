import {useEffect, useSyncExternalStore} from "react";
import {endSecondaryAuth, fetchSecondaryPasswordLockStatus} from "../api/auth/AuthApi.ts";
import {requireOk} from "./apiResponse.ts";

// 2차 인증 상태를 화면 한 곳에서 관리한다. 상단의 자물쇠와 차트의 내 매매 표시가 같은 값을 본다.
// 인증 쿠키는 화면에서 읽을 수 없으므로 상태와 남은 시간은 서버에 물어 맞춘다: 화면을 열 때, 창으로 돌아올 때,
// 2차 비밀번호 요청(인증·설정·변경·종료)이 성공한 뒤(axios.ts 가 알린다).
// 다른 기기에서 다시 인증하면 이쪽은 바로 풀리므로 화면의 시계만 믿지 않는다. 서버가 인증이 없다고 답하면 곧바로 잠김으로 바꾼다.

interface SecondaryAuthState {
    known: boolean,             // 서버에 한 번이라도 물어 상태를 아는지. 모르는 동안에는 자물쇠를 그리지 않는다
    expiresAt: number | null,   // 2차 인증이 풀리는 시각(epoch ms). 인증하지 않았으면 null
    passwordSet: boolean,       // 2차 비밀번호를 만들어 두었는지. 아니면 자물쇠를 눌렀을 때 설정 창을 띄운다
    suspended: boolean,         // 여러 번 틀려 2차 비밀번호가 정지됐는지. 관리자가 초기화해야 풀린다
    lockedContents: string[],   // 지금 화면에서 2차 인증이 없어 가려진 내용의 이름 (자물쇠에 점을 찍고 이름을 알린다)
}

const INITIAL_STATE: SecondaryAuthState = {
    known: false, expiresAt: null, passwordSet: true, suspended: false, lockedContents: [],
};
const SYNC_GAP_MS = 2000;   // 창으로 돌아올 때 focus 와 visibilitychange 가 함께 와도 한 번만 묻는다

let state = INITIAL_STATE;
const listeners = new Set<() => void>();
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
let syncOrder = 0;          // 가장 최근에 보낸 조회의 순번. 늦게 도착한 앞선 응답이 새 상태를 덮지 않게 한다
let lastSyncAt = 0;

const setState = (change: Partial<SecondaryAuthState>) => {
    state = {...state, ...change};
    listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const setExpiresAt = (expiresAt: number | null) => {
    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = null;
    if (expiresAt !== null) {
        // 시간이 다 되면 그 순간 잠김으로 바꾼다. 가려야 할 내용(차트의 내 매매)이 바로 사라진다.
        expiryTimer = setTimeout(() => setExpiresAt(null), Math.max(0, expiresAt - Date.now()));
    }
    if (expiresAt !== state.expiresAt) setState({expiresAt});
};

/**
 * 풀릴 시각이 지났으면 잠김으로 바꾼다. 탭이 잠들었다 깨어나 타이머가 밀린 경우를 위해 남은 시간을 세는 쪽이 초마다 부른다.
 */
export const expireSecondaryAuthIfDue = () => {
    if (state.expiresAt !== null && Date.now() >= state.expiresAt) setExpiresAt(null);
};

/**
 * 서버에 물어 인증 상태와 남은 시간을 맞춘다. 조회에 실패하면 알고 있던 상태를 그대로 둔다.
 * force 가 아니면 방금 물은 뒤에는 다시 묻지 않는다.
 */
export const syncSecondaryAuth = async (force = true) => {
    expireSecondaryAuthIfDue();
    if (!force && Date.now() - lastSyncAt < SYNC_GAP_MS) return;
    lastSyncAt = Date.now();
    const order = ++syncOrder;
    try {
        const status = requireOk(
            await fetchSecondaryPasswordLockStatus({skipGlobalError: true}), {},
        );
        if (order !== syncOrder) return;
        const seconds = status.authRemainingSeconds ?? 0;
        setExpiresAt(seconds > 0 ? Date.now() + seconds * 1000 : null);
        setState({known: true, passwordSet: status.passwordSet ?? true, suspended: status.suspended ?? false});
    } catch (error) {
        console.error(error);
    }
};

// 서버가 2차 인증이 없다고 답했을 때. 앞서 보낸 조회의 응답이 뒤늦게 와 다시 인증됨으로 덮지 않게 순번도 올린다.
window.addEventListener('secondary-auth-locked', () => {
    syncOrder++;
    setExpiresAt(null);
});
// 2차 비밀번호 요청이 성공해 서버의 인증 상태가 바뀌었을 때 (인증 창, 변경 창의 현재 비밀번호 확인, 변경, 종료)
window.addEventListener('secondary-auth-changed', () => void syncSecondaryAuth());

/** 2차 인증을 지금 끝낸다. */
export const lockSecondaryAuth = async () => {
    requireOk(await endSecondaryAuth(), '2차 인증 종료');
    syncOrder++;
    setExpiresAt(null);
};

/** 로그아웃했을 때. 다음 회원이 앞 회원의 인증 상태를 보지 않게 처음 상태로 돌린다 */
export const resetSecondaryAuth = () => {
    syncOrder++;
    lastSyncAt = 0;
    setExpiresAt(null);
    setState({known: false, passwordSet: true, suspended: false});
};

/** 화면이 직접 연 2차 비밀번호 창이라는 표시. 이 창은 취소해도 이전 화면으로 돌아가지 않는다 */
export const SECONDARY_AUTH_MANUAL_SOURCE = 'manual';

/**
 * 2차 비밀번호 창을 연다(App.tsx 가 띄운다). 보호된 메뉴로 들어가다 뜬 창과 달리, 취소해도 지금 화면에 머문다.
 * 2차 비밀번호를 아직 만들지 않은 회원에게는 설정 창이 뜬다(서버가 알려 준 값으로 가린다).
 * 창을 열기 전에 서버에 한 번 더 묻는다. 그 사이 관리자가 2차 비밀번호를 초기화했으면 인증 창이 아니라 설정 창이 떠야 한다.
 */
export const requestSecondaryAuth = async () => {
    await syncSecondaryAuth();
    window.dispatchEvent(new CustomEvent('show-secondary-auth', {
        detail: {code: state.passwordSet ? 'AUTH_4040' : 'AUTH_4041', source: SECONDARY_AUTH_MANUAL_SOURCE},
    }));
};

/** 서버에 물어 인증 상태를 아는지. 모르는 동안(화면을 막 연 직후)에는 자물쇠를 그리지 않는다 */
export const useSecondaryAuthKnown = (): boolean => useSyncExternalStore(subscribe, () => state.known);

/** 여러 번 틀려 2차 비밀번호가 정지된 상태인지 (마지막으로 서버에 물었을 때 기준) */
export const useSecondaryPasswordSuspendedState = (): boolean => useSyncExternalStore(subscribe, () => state.suspended);

/** 2차 인증이 풀리는 시각(epoch ms). 인증하지 않았으면 null */
export const useSecondaryAuthExpiresAt = (): number | null => useSyncExternalStore(subscribe, () => state.expiresAt);

/** 지금 2차 인증이 된 상태인지 */
export const useSecondaryAuthUnlocked = (): boolean => useSecondaryAuthExpiresAt() !== null;

/** 지금 화면에서 2차 인증이 없어 가려진 내용의 이름들 */
export const useSecondaryAuthLockedContents = (): string[] => useSyncExternalStore(subscribe, () => state.lockedContents);

/**
 * 이 화면에 2차 인증이 없어 가려진 내용이 있다고 알린다(active 인 동안). 상단 자물쇠가 점을 찍고 name 을 알려 준다.
 * 같은 이름을 여러 곳에서 알려도 한 번만 적힌다.
 */
export const useSecondaryAuthLockedContent = (name: string, active: boolean) => {
    useEffect(() => {
        if (!active) return;
        setState({lockedContents: [...state.lockedContents, name]});
        return () => {
            const index = state.lockedContents.indexOf(name);
            if (index < 0) return;
            setState({lockedContents: state.lockedContents.filter((_, order) => order !== index)});
        };
    }, [name, active]);
};

/** 화면을 열 때와 창으로 돌아올 때 서버와 인증 상태를 맞춘다. 로그인한 화면의 한 곳(상단 줄)에서만 부를 것 */
export const useSecondaryAuthSync = () => {
    useEffect(() => {
        const sync = () => {
            if (document.visibilityState === 'visible') void syncSecondaryAuth(false);
        };
        void syncSecondaryAuth();
        window.addEventListener('focus', sync);
        document.addEventListener('visibilitychange', sync);
        return () => {
            window.removeEventListener('focus', sync);
            document.removeEventListener('visibilitychange', sync);
        };
    }, []);
};
