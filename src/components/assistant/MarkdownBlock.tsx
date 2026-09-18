import ReactMarkdown, {type Components} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Link} from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import {TREND_COLORS} from '../CustomRender';

/**
 * 비서 메시지 본문 렌더러 (docs/assistant-spec.md 5.3).
 * - GFM 부분집합: 굵게·목록·표·내부 링크. 제목·이미지·HTML 은 비활성
 * - 색 문법 `{값|up}` / `{값|down}` 은 표준 마크다운 밖의 유일한 자체 규칙.
 *   렌더 전 `[값](color:up)` 링크로 바꾸고 a 컴포넌트에서 색 span 으로 그린다 (추가 의존성 없음)
 */
const COLOR_TOKEN = /\{([^{}|]+)\|(up|down)\}/g;

function toColorLinks(text: string): string {
    return text.replace(COLOR_TOKEN, (_m, value: string, sign: string) => `[${value}](color:${sign})`);
}

const components: Components = {
    a: ({href, children}) => {
        if (href?.startsWith('color:')) {
            const sign = href.slice('color:'.length) as 'up' | 'down';
            return <span style={{color: TREND_COLORS[sign], fontVariantNumeric: 'tabular-nums'}}>{children}</span>;
        }
        if (href?.startsWith('/')) {
            return <Link to={href} style={{color: 'inherit', textDecorationStyle: 'dotted'}}>{children}</Link>;
        }
        return <span>{children}</span>; // 외부 URL 금지
    },
    p: ({children}) => <Typography variant="body2" component="p" sx={{my: 0.5, lineHeight: 1.7, fontSize: '0.875rem'}}>{children}</Typography>,
    // 증권사·거래소별 보유 블록: 렌더러가 blockquote 로 감싸 보내고 여기서 카드로 그린다 (머리 줄 → 수익 줄 → 종목 표)
    blockquote: ({children}) => (
        <Box sx={{
            border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5, pt: 0.75, pb: 0.5, my: 1, bgcolor: 'background.paper',
            '& > p:first-of-type': {fontSize: '0.9375rem', mt: 0, mb: 0.25},
            '& > p:first-of-type strong': {mr: 0.5},
            '& > p + p': {color: 'text.secondary', mt: 0, mb: 0.5},
            '& table': {mt: 0.5},
        }}>
            {children}
        </Box>
    ),
    ul: ({children}) => <Box component="ul" sx={{my: 0.5, pl: 2.5}}>{children}</Box>,
    ol: ({children}) => <Box component="ol" sx={{my: 0.5, pl: 2.5}}>{children}</Box>,
    li: ({children}) => <Typography variant="body2" component="li" sx={{lineHeight: 1.7}}>{children}</Typography>,
    strong: ({children}) => <Box component="strong" sx={{fontWeight: 600}}>{children}</Box>,
    em: ({children}) => <Typography variant="caption" component="em" color="text.secondary" sx={{fontStyle: 'normal'}}>{children}</Typography>,
    h1: ({children}) => <Box component="strong">{children}</Box>,
    h2: ({children}) => <Box component="strong">{children}</Box>,
    h3: ({children}) => <Box component="strong">{children}</Box>,
    img: () => null,
    table: ({node, children}) => {
        // 열 수: 종목 표(6열)처럼 넓은 표는 첫 열을 좁혀 숫자 열 폭을 확보
        const firstRow = (node?.children?.[0] as {children?: unknown[]} | undefined)?.children?.[0] as {children?: unknown[]} | undefined;
        const cols = firstRow?.children?.filter((c) => (c as {type?: string}).type === 'element').length ?? 0;
        const firstColWidth = cols >= 5 ? '28%' : '40%';
        return (
        <Box sx={{overflowX: 'auto', my: 0.5}}>
            <Box component="table" sx={{
                borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums',
                '& th, & td': {px: 0.75, py: 0.4, whiteSpace: 'nowrap', textAlign: 'right'},
                '& th:first-of-type, & td:first-of-type': {textAlign: 'left', pl: 0, width: firstColWidth},
                '& thead tr:not(:has(th:not(:empty)))': {display: 'none'},   // 요약 표(| | |)처럼 헤더가 비면 숨김
                '& td[align="left"], & th[align="left"], & [style*="text-align:left"], & [style*="text-align: left"]': {textAlign: 'left', whiteSpace: 'normal'},   // GFM |:---| 정렬 존중
                '& th': {color: 'text.secondary', fontWeight: 500, fontSize: '0.75rem', borderBottom: '1px solid', borderColor: 'divider'},
                '& tbody tr + tr td': {borderTop: '1px dashed', borderColor: 'divider'},
            }}>
                {children}
            </Box>
        </Box>
        );
    },
};

export default function MarkdownBlock({text}: { text: string }) {
    if (!text) return null;
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={components}
            urlTransform={(url) => url}
            skipHtml
        >
            {toColorLinks(text)}
        </ReactMarkdown>
    );
}
