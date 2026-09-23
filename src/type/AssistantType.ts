// Kotlin domain/assistant DTO 와 1:1 (docs/assistant-spec.md 5.3)

export type MessageType = 'BRIEFING' | 'ALERT' | 'USER' | 'ASSISTANT' | 'SYSTEM';
export type HeadlineScope = 'PERSONAL' | 'MARKET';
/** LOCKED: 2차 인증 전 개인 섹션 껍데기 (제목만) */
export type SectionStatus = 'OK' | 'EMPTY' | 'FAILED' | 'LOCKED';

export interface Headline {
    text: string;
    scope: HeadlineScope;
    publicText?: string | null;
}

export interface Section {
    id: string;
    title: string;
    personal: boolean;
    status: SectionStatus;
    asOf?: string | null;
    /** 섹션 상단 지표 타일 (요약 줄과 같은 `라벨 값 (부가) · …` 형식). 개인 보유 섹션의 총 평가금액·일간 수익 등 */
    summary?: string | null;
    /** 개인 보유 섹션의 계좌 요약. 있으면 계좌 화면과 같은 카드로 그린다 (2026-09-18) */
    account?: AccountBlock | null;
    /** 마크다운 (GFM 부분집합) + 색 문법 {값|up} / {값|down} */
    text: string;
}

/** 칸 하나. value 는 서버가 서식·색 문법까지 완성한 문자열 */
export interface AccountStat {
    label: string;
    value: string;
}

export interface AccountBroker {
    name: string;
    /** 조회 실패면 null */
    total: string | null;
    /** 증권사가 하나면 빈 배열 (총액과 같은 숫자라서) */
    stats: AccountStat[];
    /** 종목 표 마크다운 */
    table: string;
    failed: boolean;
}

/** 총액 카드 + 증권사별 카드. 칸 순서는 총 수익 → 일간 수익 → 실현(이달) */
export interface AccountBlock {
    total: string;
    stats: AccountStat[];
    brokers: AccountBroker[];
}

export interface MessageBody {
    schemaVersion: number;
    type: MessageType;
    subtype?: string | null;
    asOf?: string | null;
    headline: Headline;
    summary: string;
    sections: Section[];
    cards: string[];
    refs: Record<string, number>;
}

export interface TimelineMessage {
    id: number;
    createdAt: string;
    body: MessageBody;
}

export interface TimelinePage {
    items: TimelineMessage[];
    nextCursor: number | null;
    unreadCount: number;
    personalIncluded: boolean;
}

export interface AssistantSettingRes {
    /** 국내주식: 07:00 장 전 + 16:00 마감 */
    krEnabled: boolean;
    /** 미국주식: 미국 마감 */
    usEnabled: boolean;
    /** 코인: 09:05 코인 마감. 행이 없으면 코인 계좌가 있을 때만 기본 on */
    coinEnabled: boolean;
    /** 국내 지수(코스피·코스닥) 장중 ±3%·±5% 급변 알림 */
    krWarnEnabled: boolean;
    /** 미국 지수(나스닥·S&P500) 장중 ±3%·±5% 급변 알림 */
    usWarnEnabled: boolean;
    /** 지표 발표 알림. 서킷브레이커는 설정과 관계없이 항상 */
    releaseAlertEnabled: boolean;
    sectionsOff: string[];
}

export type AssistantSettingReq = AssistantSettingRes;

export interface ReadMarkerReq {
    lastSeenId: number;
}

/** POST /api/assistant/secure/token — RS256 비서 토큰 (5분). 메모리에만 보관, 저장소 X */
export interface AssistantTokenRes {
    token: string;
    expiresAt: string;
    kid: string;
}

/** 설정 화면의 섹션 on/off 목록. id 는 Kotlin 렌더러가 내보내는 섹션 ID 와 같아야 한다 */
export const BRIEFING_SECTIONS: { group: string; items: { id: string; label: string; personal?: boolean }[] }[] = [
    {
        group: '미국 장 마감',
        items: [
            {id: 'U1A', label: '내 미국 종목', personal: true},
            {id: 'U2', label: '미국 지수'},
            {id: 'U2B', label: '미국 국채 금리'},
            {id: 'U4', label: '환율'},
        ],
    },
    {
        group: '국내 장 전 (07:00)',
        items: [
            {id: 'P2B', label: '오늘 추천 (시스템 분류)'},
            {id: 'P4', label: '매크로'},
        ],
    },
    {
        group: '국내 장 마감 (16:00)',
        items: [
            {id: 'C2', label: '국내 지수'},
            {id: 'C3', label: '투자자 수급'},
            {id: 'C4', label: '업종'},
            {id: 'C6', label: '환율 마감'},
        ],
    },
    {
        group: '국내 계좌 마감 (20:05)',
        items: [
            {id: 'C1A', label: '내 국내 종목', personal: true},
        ],
    },
    {
        group: '코인 마감 (09:05)',
        items: [
            {id: 'K1A', label: '내 코인', personal: true},
            {id: 'K2', label: '코인 시세'},
        ],
    },
];
