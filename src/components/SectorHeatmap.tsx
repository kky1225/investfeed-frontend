import {Box, Tooltip} from "@mui/material";
import {alpha, type Theme} from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import {useNavigate} from "react-router-dom";

export type HeatmapPalette = 'kr' | 'us';

export interface HeatmapTile {
    key: string;
    name: string;
    rate: number;   // 등락률(%) — 색 강도와 타일 숫자
    link: string;
    tooltip?: [string, string][];
    note?: string;  // 툴팁 맨 아래 ※ 안내
}

const US_UP = '46, 125, 50';
const US_DOWN = '211, 47, 47';

// 수익률 크기 → 배경 강도, ±3%에서 최대 채도
const tileColor = (theme: Theme, palette: HeatmapPalette, rate: number): string => {
    const intensity = 0.15 + Math.min(Math.abs(rate) / 3, 1) * 0.75;
    if (rate === 0) return alpha(theme.palette.grey[500], 0.15);
    if (palette === 'us') return `rgba(${rate > 0 ? US_UP : US_DOWN}, ${intensity})`;
    return alpha(rate > 0 ? theme.palette.error.main : theme.palette.info.main, intensity);
};

const rateText = (n: number): string => n > 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`;

export function HeatmapLegend({palette}: { palette: HeatmapPalette }) {
    const swatch = (rate: number) => (
        <Box sx={{width: 10, height: 10, borderRadius: 0.5, backgroundColor: (theme) => tileColor(theme, palette, rate)}}/>
    );
    return (
        <Stack direction="row" spacing={1.5} sx={{alignItems: 'center'}}>
            <Stack direction="row" spacing={0.5} sx={{alignItems: 'center'}}>
                {swatch(3)}
                <Typography variant="caption" color="text.secondary">상승</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{alignItems: 'center'}}>
                {swatch(-3)}
                <Typography variant="caption" color="text.secondary">하락</Typography>
            </Stack>
        </Stack>
    );
}

const SectorHeatmap = ({tiles, palette, loading = false, skeletonCount = 24, dense = false}: {
    tiles: HeatmapTile[];
    palette: HeatmapPalette;
    loading?: boolean;
    skeletonCount?: number;
    dense?: boolean;
}) => {
    const navigate = useNavigate();
    const height = dense ? 64 : 92;

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(${dense ? 112 : 160}px, 1fr))`,
                gap: dense ? 0.75 : 1,
            }}
        >
            {loading ? (
                Array.from({length: skeletonCount}).map((_, index) => (
                    <Skeleton key={index} variant="rounded" height={height}/>
                ))
            ) : (
                tiles.map((tile) => (
                    <Tooltip
                        key={tile.key}
                        arrow
                        title={tile.tooltip || tile.note ? (
                            <Stack spacing={0.25} sx={{p: 0.5}}>
                                {tile.tooltip?.map(([label, text]) => (
                                    <Stack key={label} direction="row" sx={{justifyContent: 'space-between', gap: 2}}>
                                        <Typography variant="caption">{label}</Typography>
                                        <Typography variant="caption">{text}</Typography>
                                    </Stack>
                                ))}
                                {tile.note && <Typography variant="caption">※ {tile.note}</Typography>}
                            </Stack>
                        ) : ''}
                    >
                        <Box
                            onClick={() => navigate(tile.link)}
                            sx={{
                                minHeight: height,
                                p: dense ? 1 : 1.5,
                                borderRadius: 1,
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                backgroundColor: (theme) => tileColor(theme, palette, tile.rate),
                                transition: 'filter 0.15s',
                                '&:hover': {filter: 'brightness(1.15)', outline: '1px solid', outlineColor: 'divider'},
                            }}
                        >
                            <Typography variant={dense ? 'caption' : 'body2'} sx={{fontWeight: 600, lineHeight: 1.3}}>
                                {tile.name}
                            </Typography>
                            <Typography variant={dense ? 'subtitle2' : 'h6'} component="p">
                                {rateText(tile.rate)}
                            </Typography>
                        </Box>
                    </Tooltip>
                ))
            )}
        </Box>
    );
};

export default SectorHeatmap;
