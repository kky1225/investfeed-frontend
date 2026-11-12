const STORAGE_KEY = 'chart-settings';

/** 브라우저에 저장하는 차트 설정. 종목과 무관하게 모든 차트에 공통으로 적용한다. */
export interface ChartSettings {
    hidden: string[],   // 꺼 둔 지표. 켠 것이 아니라 끈 것을 저장해, 나중에 추가되는 지표는 기본으로 켜진다
}

const DEFAULT_SETTINGS: ChartSettings = {hidden: []};

export const loadChartSettings = (): ChartSettings => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        const hidden = (parsed as Partial<ChartSettings> | null)?.hidden;
        return Array.isArray(hidden) ? {hidden: hidden.filter(item => typeof item === 'string')} : DEFAULT_SETTINGS;
    } catch {
        return DEFAULT_SETTINGS;
    }
};

/** 저장에 실패해도(공간 부족·사생활 보호 모드) 화면 동작은 계속한다. */
export const saveChartSettings = (settings: ChartSettings) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // 저장 실패는 무시한다.
    }
};
