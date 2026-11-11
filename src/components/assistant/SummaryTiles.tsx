import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {TREND_COLORS} from '../CustomRender';

/**
 * 요약 줄 → 지표 타일 (명세 5.3 요약 형식).
 * `라벨 값 (부가) · 라벨 값 (부가)`; 값·부가는 `{텍스트|up|down}` 색 문법 가능.
 * 형식에 맞지 않는 항목은 라벨만 있는 타일로 떨어뜨린다 (깨지지 않게).
 */
const TOKEN = /^\{([^{}|]+)\|(up|down)\}$/;
const ITEM = /^(.+?)\s+(\{[^{}]*\}|[^\s(]+)(?:\s*\((.+)\))?$/;

interface Piece { text: string; sign?: 'up' | 'down' }

function piece(raw: string | undefined): Piece | null {
    if (!raw) return null;
    const m = raw.trim().match(TOKEN);
    return m ? {text: m[1], sign: m[2] as 'up' | 'down'} : {text: raw.trim()};
}

function colorOf(p: Piece | null): string | undefined {
    if (!p?.sign) return undefined;
    return TREND_COLORS[p.sign];
}

export function parseSummary(summary: string): { label: string; value: Piece | null; sub: Piece | null }[] {
    return summary.split(' · ').map((s) => s.trim()).filter(Boolean).map((item) => {
        const m = item.match(ITEM);
        if (!m) return {label: item, value: null, sub: null};
        return {label: m[1], value: piece(m[2]), sub: piece(m[3])};
    });
}

export interface MetricTile { label: string; value: string; sub?: string | null; valueColor?: string; subColor?: string }

/** 지표 타일 모양 — 브리핑 요약 타일과 비서 시세 카드(종목 지표)가 같이 쓴다. minWidth: 타일 최소 폭(px) */
export function MetricTiles({tiles, minWidth = 112}: { tiles: MetricTile[]; minWidth?: number }) {
    if (tiles.length === 0) return null;
    return (
        <Box sx={{display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`, gap: 1, mt: 1.25}}>
            {tiles.map((t, i) => (
                <Box key={i} sx={{bgcolor: 'action.hover', borderRadius: 1.5, px: 1.25, py: 0.75, minWidth: 0}}>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">{t.label}</Typography>
                    <Typography variant="body1" sx={{fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3, color: t.valueColor}} noWrap>
                        {t.value}
                    </Typography>
                    {t.sub && (
                        <Typography variant="caption" sx={{fontVariantNumeric: 'tabular-nums', color: t.subColor ?? 'text.disabled'}} noWrap display="block">
                            {t.sub}
                        </Typography>
                    )}
                </Box>
            ))}
        </Box>
    );
}

export default function SummaryTiles({summary}: { summary: string }) {
    return (
        <MetricTiles tiles={parseSummary(summary).map((t) => ({
            label: t.label, value: t.value?.text ?? '', sub: t.sub?.text, valueColor: colorOf(t.value), subColor: colorOf(t.sub),
        }))}/>
    );
}
