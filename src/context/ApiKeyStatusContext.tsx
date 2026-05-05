import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { fetchApiKeys } from '../api/auth/AuthApi';
import { fetchBrokerList, fetchMyBrokerList } from '../api/broker/BrokerApi';
import { fetchMyCryptoBrokerList } from '../api/cryptoBroker/CryptoBrokerApi';
import type { ApiKeyRes } from '../type/AuthType';
import type { Broker, MemberBroker } from '../type/BrokerType';
import { useAuth } from './AuthContext';

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
    /** 초기 로딩 완료 여부. 초기 false → 인증 후 fetch 완료 시 true */
    isLoaded: boolean;
    /** 메뉴 의존성을 만족하는지 검사 (모두 등록되어 있고 만료되지 않아야 true) */
    isSatisfied: (requiredBrokerIds: number[]) => boolean;
    /** 단일 broker 가 사용 가능한 상태인지 (등록 + 미만료) */
    isBrokerValid: (brokerId: number) => boolean;
    /** broker id 들을 사람이 읽을 수 있는 broker 이름 배열로 변환 (없는 id 는 무시) */
    getBrokerNames: (brokerIds: number[]) => string[];
    /** API Key 등록/삭제 후 호출 → fetchApiKeys 1회. */
    invalidateApiKeys: () => Promise<void>;
    /** 본인 주식 broker 추가/삭제 후 호출 → fetchMyBrokerList 1회. */
    invalidateMyStockBrokers: () => Promise<void>;
    /** 본인 코인 broker 추가/삭제 후 호출 → fetchMyCryptoBrokerList 1회. */
    invalidateMyCryptoBrokers: () => Promise<void>;
}

const ApiKeyStatusContext = createContext<ApiKeyStatusContextType | null>(null);

/** type='API' 인 본인 broker 만 필터링해서 broker id 추출 */
const collectApiBrokerIds = (brokers: MemberBroker[]): number[] =>
    brokers.filter((b) => b.type === 'API').map((b) => b.brokerId);

export function ApiKeyStatusProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, isInitialized, hasPermission } = useAuth();
    const [apiBrokers, setApiBrokers] = useState<Broker[]>([]);
    const [apiKeys, setApiKeys] = useState<ApiKeyRes[]>([]);
    const [myStockBrokers, setMyStockBrokers] = useState<MemberBroker[]>([]);
    const [myCryptoBrokers, setMyCryptoBrokers] = useState<MemberBroker[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

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
     * 인증 직후 1회 초기 로드. 권한 보유 여부에 따라 조건부 fetch.
     * - fetchApiKeys: /api/auth/** (permission 검사 제외) — 항상 호출
     * - fetchBrokerList / fetchMyBrokerList: STOCK_BROKER READ 보유 시만
     * - fetchMyCryptoBrokerList: CRYPTO_BROKER READ 보유 시만
     */
    const initialLoad = useCallback(async () => {
        const canReadStockBroker = hasPermission('STOCK_BROKER', 'READ');
        const canReadCryptoBroker = hasPermission('CRYPTO_BROKER', 'READ');

        try {
            const [keysRes, brokersRes, myStockRes, myCryptoRes] = await Promise.all([
                fetchApiKeys(),
                canReadStockBroker ? fetchBrokerList() : null,
                canReadStockBroker ? fetchMyBrokerList() : null,
                canReadCryptoBroker ? fetchMyCryptoBrokerList() : null,
            ]);

            if (keysRes.code !== "0000") throw new Error(keysRes.message || `API Key 조회 실패 (${keysRes.code})`);
            if (brokersRes && brokersRes.code !== "0000") throw new Error(brokersRes.message || `증권사 목록 조회 실패 (${brokersRes.code})`);
            if (myStockRes && myStockRes.code !== "0000") throw new Error(myStockRes.message || `본인 증권사 조회 실패 (${myStockRes.code})`);
            if (myCryptoRes && myCryptoRes.code !== "0000") throw new Error(myCryptoRes.message || `본인 거래소 조회 실패 (${myCryptoRes.code})`);

            setApiKeys(keysRes.result ?? []);

            const brokers: Broker[] = brokersRes?.result?.brokers ?? [];
            setApiBrokers(brokers.filter((b) => b.type === 'API'));

            setMyStockBrokers(myStockRes?.result?.brokers ?? []);
            setMyCryptoBrokers(myCryptoRes?.result?.brokers ?? []);
        } catch {
            // 조회 실패 = 미등록 취급. 글로벌 에러 다이얼로그가 따로 잡으므로 여기서는 무시
            setApiKeys([]);
            setApiBrokers([]);
            setMyStockBrokers([]);
            setMyCryptoBrokers([]);
        } finally {
            setIsLoaded(true);
        }
    }, [hasPermission]);

    /** API Key 등록/삭제 후 호출. apiKeys 갱신 (validBrokerIds 는 자동 derive). */
    const invalidateApiKeys = useCallback(async () => {
        try {
            const res = await fetchApiKeys();
            if (res.code !== "0000") throw new Error(res.message || `API Key 조회 실패 (${res.code})`);
            setApiKeys(res.result ?? []);
        } catch (err) {
            console.error(err);
            setApiKeys([]);
        }
    }, []);

    /** 본인 주식 broker 추가/삭제 후 호출. myStockBrokers 갱신. STOCK_BROKER READ 미보유 시 skip. */
    const invalidateMyStockBrokers = useCallback(async () => {
        if (!hasPermission('STOCK_BROKER', 'READ')) return;
        try {
            const res = await fetchMyBrokerList();
            if (res.code !== "0000") throw new Error(res.message || `증권사 조회 실패 (${res.code})`);
            setMyStockBrokers(res?.result?.brokers ?? []);
        } catch (err) {
            console.error(err);
            setMyStockBrokers([]);
        }
    }, [hasPermission]);

    /** 본인 코인 broker 추가/삭제 후 호출. myCryptoBrokers 갱신. CRYPTO_BROKER READ 미보유 시 skip. */
    const invalidateMyCryptoBrokers = useCallback(async () => {
        if (!hasPermission('CRYPTO_BROKER', 'READ')) return;
        try {
            const res = await fetchMyCryptoBrokerList();
            if (res.code !== "0000") throw new Error(res.message || `거래소 조회 실패 (${res.code})`);
            setMyCryptoBrokers(res?.result?.brokers ?? []);
        } catch (err) {
            console.error(err);
            setMyCryptoBrokers([]);
        }
    }, [hasPermission]);

    useEffect(() => {
        if (!isInitialized) return;
        if (!isAuthenticated) {
            setApiKeys([]);
            setApiBrokers([]);
            setMyStockBrokers([]);
            setMyCryptoBrokers([]);
            setIsLoaded(true);
            return;
        }
        // 권한이 부여되지 않은 endpoint 는 initialLoad 내부 catch 로 빈 배열 fallback.
        // 권한 부여 시 정상 로드.
        void initialLoad();
    }, [isInitialized, isAuthenticated, initialLoad]);

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
                invalidateApiKeys,
                invalidateMyStockBrokers,
                invalidateMyCryptoBrokers,
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
