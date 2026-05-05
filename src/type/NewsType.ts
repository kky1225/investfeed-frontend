export interface NewsSearchReq {
    query: string;
    page: number;
}

export interface NewsItem {
    title: string;
    link: string;
    description: string;
    pubDate: string;
    sentiment: string | null; // 추후 AI 호재/악재 분석용
}

