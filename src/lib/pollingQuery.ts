import {useEffect, useState} from 'react';
import {useQuery, type QueryKey, type UseQueryOptions} from '@tanstack/react-query';
import type {AxiosRequestConfig} from 'axios';
import type {ApiResponse} from '../type/AuthType';
import {requireOk} from './apiResponse';
import {getServerNow} from './serverTime';

let isSessionExpiredGlobal = false;
if (typeof window !== 'undefined') {
    window.addEventListener('show-session-expired', () => {
        isSessionExpiredGlobal = true;
    });
    window.addEventListener('reset-session-expired', () => {
        isSessionExpiredGlobal = false;
    });
}

export interface PollingFetchConfig extends AxiosRequestConfig {
    skipGlobalError?: boolean;
}

export type PollingFetcher<T> = (config: PollingFetchConfig) => Promise<ApiResponse<T>>;

/**
 * 폴링 데이터 fetch 공용 훅.
 * - signal 자동 전달 (unmount 시 axios 요청 cancel)
 * - skipGlobalError 자동 적용 (전역 에러 다이얼로그 skip)
 * - 응답 wrapper 자동 unwrap (`requireOk` 적용 — code !== "0000" 시 throw → pollError true)
 * - lastUpdated / pollError 변환 제공 (FreshnessIndicator 호환)
 *
 * 사용처에서는 명시적 제네릭으로 result 타입을 지정 권장:
 *   usePollingQuery<DashboardRes>(['key'], fetcher)
 * 미지정 시 result 는 any.
 */
export function usePollingQuery<T = any>(
    queryKey: QueryKey,
    fetcher: PollingFetcher<T>,
    options?: Omit<UseQueryOptions<T | null>, 'queryKey' | 'queryFn'> & {
        intervalMs?: number;
        fallback?: T | null;
    },
) {
    const {intervalMs = 60_000, fallback = null, ...rest} = options ?? {};
    const enabled = rest.enabled !== false; // 명시적 false 만 비활성, 기본 true

    // 세션 만료 이벤트 발생 후 polling 정지 — 컴포넌트별 re-render 트리거용 state
    const [sessionExpired, setSessionExpired] = useState(isSessionExpiredGlobal);
    useEffect(() => {
        const expireHandler = () => setSessionExpired(true);
        const resetHandler = () => setSessionExpired(false);
        window.addEventListener('show-session-expired', expireHandler);
        window.addEventListener('reset-session-expired', resetHandler);
        return () => {
            window.removeEventListener('show-session-expired', expireHandler);
            window.removeEventListener('reset-session-expired', resetHandler);
        };
    }, []);

    const effectiveEnabled = enabled && !sessionExpired;

    const query = useQuery<T | null>({
        queryKey,
        queryFn: async ({signal}) => requireOk<T | null>(await fetcher({signal, skipGlobalError: true}), fallback),
        refetchInterval: intervalMs === 60_000 ? false : intervalMs,
        refetchIntervalInBackground: false,
        ...rest,
        enabled: effectiveEnabled,
    });

    useEffect(() => {
        // 1분 폴링 커스텀 스케줄. enabled=false 또는 세션 만료 시 타이머 자체를 시작하지 않음.
        // (useQuery 의 `enabled` 는 자동 fetch 만 막고 `refetch()` 는 강제 실행되므로 여기서 별도 가드 필요)
        if (intervalMs !== 60_000) return;
        if (!effectiveEnabled) return;

        let timer: ReturnType<typeof setTimeout> | undefined;
        let cancelled = false;

        const schedule = () => {
            const serverNow = getServerNow();
            const wait = 60_000 - (serverNow % 60_000) + 300;
            timer = setTimeout(() => {
                if (cancelled || isSessionExpiredGlobal) return;
                query.refetch();
                schedule();
            }, wait);
        };
        schedule();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [intervalMs, effectiveEnabled]);

    return {
        ...query,
        lastUpdated: query.data ? new Date(query.dataUpdatedAt) : null,
        pollError: !!query.error,
    };
}
