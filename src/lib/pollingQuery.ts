import {useQuery, type QueryKey, type UseQueryOptions} from '@tanstack/react-query';
import type {AxiosRequestConfig} from 'axios';

export interface PollingFetchConfig extends AxiosRequestConfig {
    skipGlobalError?: boolean;
}

export type PollingFetcher<T> = (config: PollingFetchConfig) => Promise<T>;

/**
 * 폴링 데이터 fetch 공용 훅.
 * - signal 자동 전달 (unmount 시 axios 요청 cancel)
 * - skipGlobalError 자동 적용 (전역 에러 다이얼로그 skip)
 * - lastUpdated / pollError 변환 제공 (FreshnessIndicator 호환)
 *
 * 주의: 응답 wrapper (`{code, message, result}`) 를 그대로 캐시.
 * 사용처에서 `res?.result?.foo` 형태로 접근.
 */
export function usePollingQuery<T>(
    queryKey: QueryKey,
    fetcher: PollingFetcher<T>,
    options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> & {intervalMs?: number},
) {
    const {intervalMs = 60_000, ...rest} = options ?? {};
    const query = useQuery<T>({
        queryKey,
        queryFn: ({signal}) => fetcher({signal, skipGlobalError: true}),
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
