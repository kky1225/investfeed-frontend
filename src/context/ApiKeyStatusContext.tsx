import { createContext, useContext, useMemo, useCallback, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApiKeys } from '../api/auth/AuthApi';
import { fetchBrokerList, fetchMyBrokerList } from '../api/broker/BrokerApi';
import { fetchMyCryptoBrokerList } from '../api/cryptoBroker/CryptoBrokerApi';
import { requireOk } from '../lib/apiResponse';
import type { ApiKeyRes } from '../type/AuthType';
import type { Broker, MemberBroker } from '../type/BrokerType';
import { useAuth } from './AuthContext';

/**
 * 외부에서 캐시 무효화 시 사용할 query key 상수.
 * 예: queryClient.invalidateQueries({queryKey: apiKeyStatusKeys.apiKeys})
 */
export const apiKeyStatusKeys = {
    apiKeys: ['apiKeys'] as const,
    brokers: ['brokerList', 'all'] as const,
    myStockBrokers: ['myBrokers', 'stock'] as const,
    myCryptoBrokers: ['myBrokers', 'crypto'] as const,
};

interface ApiKeyStatusContextType {
    /** type='API' 인 broker 마스터 (id → 메타데이터 매핑용) */
    apiBrokers: Broker[];
    /** 사용자가 등록한 API Key 의 raw 응답. 페이지에서 만료일 등 표시용. */
    apiKeys: ApiKeyRes[];
    /** 본인 주식 계좌 broker 전체 (type=API + MANUAL 모두). 페이지에서 정렬/필터해서 사용. */
    myStockBrokers: MemberBroker[];
    /** 본인 코인 거래소 broker 전체. */
    myCryptoBrokers: MemberBroker[];
    /** 등록 API Key 중 만료되지 않은 broker id (apiKeys 에서 derive). */
    validBrokerIds: Set<number>;
    /** 본인 계좌 broker 중 type='API' 만 (myStockBrokers ∪ myCryptoBrokers 에서 derive). */
    myApiBrokerIds: Set<number>;
    /** 초기 로딩 완료 여부. 권한 보유한 query 가 모두 fetched 면 true */
    isLoaded: boolean;
    /** 메뉴 의존성을 만족하는지 검사 (모두 등록되어 있고 만료되지 않아야 true) */
    isSatisfied: (requiredBrokerIds: number[]) => boolean;
    /** 단일 broker 가 사용 가능한 상태인지 (등록 + 미만료) */
    isBrokerValid: (brokerId: number) => boolean;
    /** broker id 들을 사람이 읽을 수 있는 broker 이름 배열로 변환 (없는 id 는 무시) */
    getBrokerNames: (brokerIds: number[]) => string[];
}

const ApiKeyStatusContext = createContext<ApiKeyStatusContextType | null>(null);

/** type='API' 인 본인 broker 만 필터링해서 broker id 추출 */
const collectApiBrokerIds = (brokers: MemberBroker[]): number[] =>
    brokers.filter((b) => b.type === 'API').map((b) => b.brokerId);

export function ApiKeyStatusProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, isInitialized, hasPermission } = useAuth();

    const canReadStockBroker = hasPermission('STOCK_BROKER', 'READ');
    const canReadCryptoBroker = hasPermission('CRYPTO_BROKER', 'READ');

    const apiKeysQuery = useQuery<ApiKeyRes[]>({
        queryKey: apiKeyStatusKeys.apiKeys,
        queryFn: async ({signal}) => requireOk(await fetchApiKeys({signal, skipGlobalError: true}), [] as ApiKeyRes[]),
        enabled: isInitialized && isAuthenticated,
    });

    const brokersQuery = useQuery<Broker[]>({
        queryKey: apiKeyStatusKeys.brokers,
        queryFn: async ({signal}) => {
            const result = requireOk(await fetchBrokerList({signal, skipGlobalError: true}), {brokers: [] as Broker[]});
            return result.brokers ?? [];
        },
        enabled: isInitialized && isAuthenticated && canReadStockBroker,
    });

    const myStockBrokersQuery = useQuery<MemberBroker[]>({
        queryKey: apiKeyStatusKeys.myStockBrokers,
        queryFn: async ({signal}) => {
            const result = requireOk(await fetchMyBrokerList({signal, skipGlobalError: true}), {brokers: [] as MemberBroker[]});
            return result.brokers ?? [];
        },
        enabled: isInitialized && isAuthenticated && canReadStockBroker,
    });

    const myCryptoBrokersQuery = useQuery<MemberBroker[]>({
        queryKey: apiKeyStatusKeys.myCryptoBrokers,
        queryFn: async ({signal}) => {
            const result = requireOk(await fetchMyCryptoBrokerList({signal, skipGlobalError: true}), {brokers: [] as MemberBroker[]});
            return result.brokers ?? [];
        },
        enabled: isInitialized && isAuthenticated && canReadCryptoBroker,
    });

    const apiKeys = apiKeysQuery.data ?? [];
    const myStockBrokers = myStockBrokersQuery.data ?? [];
    const myCryptoBrokers = myCryptoBrokersQuery.data ?? [];

    /** 전체 broker 중 type='API' 만 필터 */
    const apiBrokers = useMemo(
        () => (brokersQuery.data ?? []).filter((b) => b.type === 'API'),
        [brokersQuery.data],
    );

    /** 등록 API Key 중 만료되지 않은 broker id 자동 계산 */
    const validBrokerIds = useMemo(() => {
        const now = Date.now();
        return new Set<number>(
            apiKeys
                .filter((k) => new Date(k.expiresAt).getTime() > now)
                .map((k) => k.brokerId)
        );
    }, [apiKeys]);

    /** 본인 계좌 broker 합집합 중 type='API' 자동 계산 */
    const myApiBrokerIds = useMemo(
        () => new Set<number>([
            ...collectApiBrokerIds(myStockBrokers),
            ...collectApiBrokerIds(myCryptoBrokers),
        ]),
        [myStockBrokers, myCryptoBrokers]
    );

    /**
     * 초기 로드 완료 판정.
     * - 인증 안 됨: isInitialized 면 즉시 완료 (fetch 안 함)
     * - 인증됨: 항상 호출되는 apiKeys 가 fetched, 권한 보유 query 도 fetched 여야 완료.
     *   권한 미보유 query 는 enabled=false → isFetched 도 false 이므로 권한 분기로 skip.
     */
    const isLoaded = !isInitialized
        ? false
        : !isAuthenticated
        ? true
        : apiKeysQuery.isFetched
            && (!canReadStockBroker || (brokersQuery.isFetched && myStockBrokersQuery.isFetched))
            && (!canReadCryptoBroker || myCryptoBrokersQuery.isFetched);

    const isSatisfied = useCallback(
        (requiredBrokerIds: number[]) =>
            requiredBrokerIds.every((id) => validBrokerIds.has(id)),
        [validBrokerIds]
    );

    const isBrokerValid = useCallback(
        (brokerId: number) => validBrokerIds.has(brokerId),
        [validBrokerIds]
    );

    const getBrokerNames = useCallback(
        (brokerIds: number[]) => {
            const map = new Map(apiBrokers.map((b) => [b.id, b.name]));
            return brokerIds.map((id) => map.get(id)).filter((n): n is string => !!n);
        },
        [apiBrokers]
    );

    return (
        <ApiKeyStatusContext.Provider
            value={{
                apiBrokers,
                apiKeys,
                myStockBrokers,
                myCryptoBrokers,
                validBrokerIds,
                myApiBrokerIds,
                isLoaded,
                isSatisfied,
                isBrokerValid,
                getBrokerNames,
            }}
        >
            {children}
        </ApiKeyStatusContext.Provider>
    );
}

export function useApiKeyStatus() {
    const ctx = useContext(ApiKeyStatusContext);
    if (!ctx) throw new Error('useApiKeyStatus must be used within ApiKeyStatusProvider');
    return ctx;
}
