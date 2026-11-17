// 화면 내용의 최대 너비. 넓은 모니터에서 내용이 가운데로 모이는 폭을 사용자가 고른다.
// 모니터마다 맞는 폭이 달라 계정이 아니라 브라우저(localStorage)에 저장한다.
// 화면들은 maxWidth 에 'var(--page-max-width)' 를 쓰고, 여기서 그 값을 바꾼다.

export type PageWidth = 'default' | 'wide' | 'full';

export const PAGE_WIDTHS: PageWidth[] = ['default', 'wide', 'full'];

export const PAGE_WIDTH_LABELS: Record<PageWidth, string> = {
    default: '기본',
    wide: '넓게',
    full: '전체',
};

// 최대 너비 값. 전체는 제한을 두지 않는다
const PAGE_WIDTH_VALUES: Record<PageWidth, string> = {
    default: '1700px',
    wide: '2400px',
    full: 'none',
};

const STORAGE_KEY = 'pageWidth';
const CSS_VARIABLE = '--page-max-width';
const INITIAL_PAGE_WIDTH: PageWidth = 'wide';

/** 저장해 둔 폭. 없거나 모르는 값이면 처음 값(넓게) */
export const loadPageWidth = (): PageWidth => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return PAGE_WIDTHS.find(width => width === saved) ?? INITIAL_PAGE_WIDTH;
    } catch {
        // 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 처음 값으로 둔다.
        return INITIAL_PAGE_WIDTH;
    }
};

/** 고른 폭을 화면에 적용한다. */
export const applyPageWidth = (width: PageWidth) => {
    document.documentElement.style.setProperty(CSS_VARIABLE, PAGE_WIDTH_VALUES[width]);
};

/** 고른 폭을 저장하고 화면에 적용한다. */
export const savePageWidth = (width: PageWidth) => {
    try {
        localStorage.setItem(STORAGE_KEY, width);
    } catch {
        // 저장하지 못해도 이번에 연 동안은 적용한다.
    }
    applyPageWidth(width);
};

// 화면을 그리기 전에 저장해 둔 폭을 적용한다 (이 파일을 처음 가져올 때 한 번).
applyPageWidth(loadPageWidth());
