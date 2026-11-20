import {useCallback, useEffect, useState} from "react";
import {fetchSecondaryPasswordLockStatus} from "../api/auth/AuthApi";
import {syncSecondaryAuth} from "../lib/secondaryAuth";

// 2차 비밀번호를 틀렸을 때의 안내. 인증 창과 변경 창이 함께 쓴다.
// 맞히지 못한 채 연달아 10번 틀리면 2차 비밀번호가 정지되고, 관리자가 초기화할 때까지 풀리지 않는다(기다리는 시간은 없다).

export const SECONDARY_PASSWORD_SUSPENDED_MESSAGE = '2차 비밀번호를 여러 번 틀려 정지되었습니다. 관리자에게 문의하세요.';

const WRONG_CODE = 'AUTH_4042';         // 틀렸다
const SUSPENDED_CODE = 'AUTH_4044';     // 정지됐다

const errorDataOf = (err: unknown) => (
    (err as { response?: { data?: { code?: string, message?: string } } }).response?.data
);

/** 서버가 2차 비밀번호가 정지됐다고 답했는지 */
export const isSecondaryPasswordSuspended = (err: unknown): boolean => errorDataOf(err)?.code === SUSPENDED_CODE;

/**
 * 틀렸을 때 보여 줄 문구. 서버가 남은 횟수까지 적어 준다("…3번 더 틀리면 정지됩니다.").
 * 틀려서 난 오류가 아니면(서버 오류, 연결 실패 등) null 이라, 부르는 쪽이 "올바르지 않다"고 잘못 안내하지 않는다.
 */
export const wrongSecondaryPasswordMessage = (err: unknown): string | null => {
    const data = errorDataOf(err);
    return data?.code === WRONG_CODE ? data.message ?? '2차 비밀번호가 올바르지 않습니다.' : null;
};

/**
 * 창을 여는 동안 2차 비밀번호가 정지된 상태인지. 입력하다 정지되면 markSuspended 로 알린다. 창을 닫으면 지워진다.
 * check: 창을 열 때 서버에 물어 미리 알아 둘지. 2차 비밀번호를 처음 만드는 창처럼 물을 필요가 없으면 false.
 * 조회에 실패하면 정지되지 않은 것으로 두고 창은 그대로 보여 준다(입력하면 서버가 다시 판단한다).
 */
export const useSecondaryPasswordSuspended = (open: boolean, check = true): [boolean, () => void] => {
    const [suspended, setSuspended] = useState(false);
    useEffect(() => {
        if (!open) {
            setSuspended(false);
            return;
        }
        if (!check) return;
        let cancelled = false;
        fetchSecondaryPasswordLockStatus({skipGlobalError: true})
            .then(res => {
                // 조회가 늦게 끝나도, 그 사이 입력하다 정지된 것(markSuspended)을 정지 전 값으로 되돌리지 않는다.
                if (!cancelled) setSuspended(previous => previous || (res.result?.suspended ?? false));
            })
            .catch(error => console.error(error));
        return () => {
            cancelled = true;
        };
    }, [open, check]);
    const markSuspended = useCallback(() => {
        setSuspended(true);
        // 서버가 유지 중이던 2차 인증도 끝냈다. 상단 자물쇠가 바로 따라가게 한다.
        void syncSecondaryAuth();
    }, []);
    return [suspended, markSuspended];
};
