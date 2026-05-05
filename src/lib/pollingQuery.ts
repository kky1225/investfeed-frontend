import {useQuery, type QueryKey, type UseQueryOptions} from '@tanstack/react-query';
import type {AxiosRequestConfig} from 'axios';
import type {ApiResponse} from '../type/AuthType';
import {unwrapResponse} from './apiResponse';

export interface PollingFetchConfig extends AxiosRequestConfig {
    skipGlobalError?: boolean;
}

export type PollingFetcher<T> = (config: PollingFetchConfig) => Promise<ApiResponse<T>>;

/**
 * 폴링 데이터 fetch 공용 훅.
 * - signal 자동 전달 (unmount 시 axios 요청 cancel)
 * - skipGlobalError 자동 적용 (전역 에러 다이얼로그 skip)
 * - 응답 wrapper 자동 unwrap (`unwrapResponse` 적용 — code !== "0000" 시 throw → pollError true)
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
    const query = useQuery<T | null>({
        queryKey,
        queryFn: async ({signal}) => unwrapResponse<T | null>(await fetcher({signal, skipGlobalError: true}), fallback),
        refetchInterval: intervalMs,
        refetchIntervalInBackground: false,
        ...rest,
    });
    return {
        ...query,
        lastUpdated: query.data ? new Date(query.dataUpdatedAt) : null,
        pollError: !!query.error,
    };
}
