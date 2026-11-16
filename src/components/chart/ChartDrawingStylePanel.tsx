import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {ChartToolbarButton} from "./ChartToolbarControls.tsx";
import {DrawingStyle} from "../../lib/chart/types.ts";

interface ChartDrawingStylePanelProps {
    style: DrawingStyle,        // 선택한 도형의 꾸미기
    colorCount: number,         // 고를 수 있는 색의 수. 색은 차트의 --chart-line-N 변수에서 온다
    onChange: (change: DrawingStyle) => void,
    onDelete: () => void,
    locked: boolean,            // 잠근 도형인지. 잠그면 끌어 옮기거나 점을 고칠 수 없다
    onLockChange: (locked: boolean) => void,
    // 글자 도형일 때만 준다. 주면 굵기는 글자 크기로 쓰이고, 점선 대신 글자 수정 버튼이 나온다
    onEditText?: () => void,
}

export const DEFAULT_DRAWING_COLOR = 4;     // 꾸미기를 정하지 않은 도형의 색 순번 (엔진의 기본값과 같다)
const LINE_WIDTHS = [1, 2, 3];
const SWATCH_SIZE = 16;

// 골라 둔 항목의 표시
const selectedSx = {color: 'primary.main', backgroundColor: 'action.selected'};

/**
 * 도형을 선택하면 차트 위쪽 가운데에 뜨는 패널: 색 · 굵기 · 점선 · 잠금 · 삭제. (글자 도형은 색 · 크기 · 글자 수정 · 잠금 · 삭제)
 * 색은 테마에서 온 선 색 목록 안에서만 고른다.
 */
const ChartDrawingStylePanel = ({
    style, colorCount, onChange, onDelete, locked, onLockChange, onEditText,
}: ChartDrawingStylePanelProps) => {
    const widthLabel = onEditText ? '크기' : '굵기';
    const color = style.color ?? DEFAULT_DRAWING_COLOR;
    const lineWidth = style.lineWidth ?? 1;
    const dashed = style.dashed ?? false;

    return (
        <Paper
            elevation={3}
            sx={{position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 2, px: 1, py: 0.5}}
        >
            <Stack direction="row" spacing={0.5} sx={{alignItems: 'center'}}>
                {Array.from({length: colorCount}, (_unused, order) => (
                    <Tooltip key={order} title={`색 ${order + 1}`}>
                        <ButtonBase
                            aria-label={`색 ${order + 1}`}
                            aria-pressed={order === color}
                            onClick={() => onChange({color: order})}
                            sx={{
                                width: SWATCH_SIZE,
                                height: SWATCH_SIZE,
                                borderRadius: '50%',
                                backgroundColor: `var(--chart-line-${order + 1})`,
                                // 고른 색은 바깥에 테두리를 한 겹 둘러 표시한다.
                                outline: order === color ? '2px solid' : 'none',
                                outlineColor: 'primary.main',
                                outlineOffset: 2,
                                mx: 0.5,
                            }}
                        />
                    </Tooltip>
                ))}
                <Divider orientation="vertical" flexItem sx={{my: 0.5}}/>
                {LINE_WIDTHS.map(width => (
                    <Tooltip key={width} title={`${widthLabel} ${width}`}>
                        <ChartToolbarButton
                            aria-label={`${widthLabel} ${width}`}
                            aria-pressed={width === lineWidth}
                            onClick={() => onChange({lineWidth: width})}
                            sx={width === lineWidth ? selectedSx : undefined}
                        >
                            <Box sx={{width: 16, height: width + 1, backgroundColor: 'currentColor', borderRadius: 1}}/>
                        </ChartToolbarButton>
                    </Tooltip>
                ))}
                {onEditText ? (
                    <Tooltip title="글자 수정 (더블클릭)">
                        <ChartToolbarButton aria-label="글자 수정" onClick={onEditText}>
                            <EditOutlinedIcon/>
                        </ChartToolbarButton>
                    </Tooltip>
                ) : (
                    <Tooltip title={dashed ? '실선으로' : '점선으로'}>
                        <ChartToolbarButton
                            aria-label="점선"
                            aria-pressed={dashed}
                            onClick={() => onChange({dashed: !dashed})}
                            sx={dashed ? selectedSx : undefined}
                        >
                            <Box sx={{width: 16, borderTop: '2px dashed', borderColor: 'currentColor'}}/>
                        </ChartToolbarButton>
                    </Tooltip>
                )}
                <Divider orientation="vertical" flexItem sx={{my: 0.5}}/>
                <Tooltip title={locked ? '잠금 해제' : '잠금 (옮기거나 고칠 수 없게)'}>
                    <ChartToolbarButton
                        aria-label="잠금"
                        aria-pressed={locked}
                        onClick={() => onLockChange(!locked)}
                        sx={locked ? selectedSx : undefined}
                    >
                        {locked ? <LockOutlinedIcon/> : <LockOpenOutlinedIcon/>}
                    </ChartToolbarButton>
                </Tooltip>
                <Tooltip title={locked ? '삭제' : '삭제 (Delete)'}>
                    <ChartToolbarButton aria-label="선택한 도형 삭제" onClick={onDelete}>
                        <DeleteOutlineIcon/>
                    </ChartToolbarButton>
                </Tooltip>
            </Stack>
        </Paper>
    );
};

export default ChartDrawingStylePanel;
