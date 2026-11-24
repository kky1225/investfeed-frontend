import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {formatTime} from "../../lib/chart/scale.ts";
import {Drawing, DrawingState, TimeUnit} from "../../lib/chart/types.ts";
import {DRAWING_ICONS, DRAWING_LABELS} from "./drawingToolLabels.tsx";

interface ChartDrawingListDialogProps {
    open: boolean,
    onClose: () => void,
    onExited?: () => void,      // 창이 다 닫힌 뒤(사라지는 효과까지 끝난 뒤) 부른다
    drawings: Drawing[],        // 그린 순서. 목록에는 최근에 그린 것을 위에 보인다
    timeUnit: TimeUnit,         // 지금 차트의 주기. 분봉이면 날짜에 시각을 붙인다
    formatPrice: (price: number) => string,     // 수평선 가격을 차트 라벨과 같은 자릿수로 적는다
    onChange: (id: string, change: DrawingState) => void,  // 잠금·숨김을 바꾼다
    onDelete: (id: string) => void,
    onDeleteAll: () => void,
    onShowAll: () => void,      // 숨긴 선을 모두 다시 보이게 한다
    onSelect: (drawing: Drawing) => void,   // 줄 이름을 누르면 부른다. 창을 닫고 그 선으로 옮겨 선택한다
}

const TEXT_PREVIEW_LENGTH = 20;     // 글자 도형의 내용을 앞에서 몇 자까지 보일지

/**
 * 점 하나의 시각 표기. 선은 주기와 상관없이 같은 목록이라 분봉에서도 연도를 붙인다(분봉은 시각까지).
 * 미래 구간의 점은 마지막 캔들에서 몇 칸 뒤인지 붙인다
 */
const spotText = (spot: { time: number, offset?: number | null }, timeUnit: TimeUnit) => {
    const date = formatTime(spot.time, 'day');
    const text = timeUnit === 'minute' ? `${date} ${formatTime(spot.time, 'minute')}` : date;
    return spot.offset ? `${text} +${spot.offset}칸` : text;
};

/** 같은 종류의 선끼리 구분할 수 있게 줄 이름 옆에 붙이는 요약: 수평선은 가격, 글자는 내용, 그 밖은 날짜 */
const summaryOf = (drawing: Drawing, timeUnit: TimeUnit, formatPrice: (price: number) => string): string => {
    switch (drawing.type) {
        case 'horizontal':
            return formatPrice(drawing.price);
        case 'vertical':
            return spotText(drawing, timeUnit);
        case 'text': {
            const text = drawing.text.replace(/\s+/g, ' ').trim();
            return text.length > TEXT_PREVIEW_LENGTH ? `${text.slice(0, TEXT_PREVIEW_LENGTH)}…` : text;
        }
        default:
            return `${spotText(drawing.from, timeUnit)} → ${spotText(drawing.to, timeUnit)}`;
    }
};

/**
 * 그린 선 목록 창. 줄마다 선의 종류·요약과 잠금·숨기기·삭제 버튼이 있다.
 * 줄 이름을 누르면 창을 닫고 그 선으로 옮겨 선택한다(숨긴 선이면 다시 보이게 한다).
 */
const ChartDrawingListDialog = ({
    open, onClose, onExited, drawings, timeUnit, formatPrice, onChange, onDelete, onDeleteAll, onShowAll, onSelect,
}: ChartDrawingListDialogProps) => {
    const hiddenCount = drawings.filter(drawing => drawing.hidden).length;
    const rows = [...drawings].reverse();

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            slotProps={{transition: {onExited}}}
        >
            <DialogTitle>그린 선 목록{drawings.length > 0 && ` (${drawings.length}개)`}</DialogTitle>
            <DialogContent>
                {rows.length === 0 ? (
                    <Typography variant="body2" sx={{color: 'text.secondary'}}>그린 선이 없습니다.</Typography>
                ) : (
                    <Box sx={{border: 1, borderColor: 'divider', borderRadius: 1}}>
                        {rows.map((drawing, order) => {
                            const label = DRAWING_LABELS[drawing.type];
                            const summary = summaryOf(drawing, timeUnit, formatPrice);
                            const hidden = drawing.hidden ?? false;
                            const locked = drawing.locked ?? false;
                            return (
                                <Stack
                                    key={drawing.id}
                                    direction="row"
                                    sx={{
                                        alignItems: 'center',
                                        pr: 0.5,
                                        borderTop: order === 0 ? 0 : 1,
                                        borderColor: 'divider',
                                    }}
                                >
                                    <Tooltip title={hidden ? '다시 보이게 하고 이 선으로 이동' : '이 선으로 이동'}>
                                        <ButtonBase
                                            onClick={() => onSelect(drawing)}
                                            sx={{
                                                flex: 1,
                                                minWidth: 0,
                                                justifyContent: 'flex-start',
                                                gap: 1,
                                                px: 1.5,
                                                py: 1,
                                                textAlign: 'left',
                                                color: hidden ? 'text.disabled' : 'text.primary',
                                                '& svg': {fontSize: 18, color: hidden ? 'text.disabled' : 'text.secondary'},
                                                '&:hover': {backgroundColor: 'action.hover'},
                                            }}
                                        >
                                            {DRAWING_ICONS[drawing.type]}
                                            <Typography variant="body2" noWrap>
                                                {label}
                                                {summary && (
                                                    <Box
                                                        component="span"
                                                        sx={{ml: 1, color: hidden ? 'text.disabled' : 'text.secondary'}}
                                                    >
                                                        {summary}
                                                    </Box>
                                                )}
                                            </Typography>
                                        </ButtonBase>
                                    </Tooltip>
                                    <Tooltip title={locked ? '잠금 해제' : '잠금 (옮기거나 고칠 수 없게)'}>
                                        <IconButton
                                            size="small"
                                            aria-label={`${label} ${locked ? '잠금 해제' : '잠금'}`}
                                            aria-pressed={locked}
                                            onClick={() => onChange(drawing.id, {locked: locked ? null : true})}
                                            sx={{color: locked ? 'primary.main' : 'text.secondary'}}
                                        >
                                            {locked ? <LockOutlinedIcon fontSize="small"/> : <LockOpenOutlinedIcon fontSize="small"/>}
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title={hidden ? '보이기' : '숨기기'}>
                                        <IconButton
                                            size="small"
                                            aria-label={`${label} ${hidden ? '보이기' : '숨기기'}`}
                                            aria-pressed={hidden}
                                            onClick={() => onChange(drawing.id, {hidden: hidden ? null : true})}
                                            sx={{color: 'text.secondary'}}
                                        >
                                            {hidden
                                                ? <VisibilityOffOutlinedIcon fontSize="small"/>
                                                : <VisibilityOutlinedIcon fontSize="small"/>}
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="삭제">
                                        <IconButton
                                            size="small"
                                            aria-label={`${label} 삭제`}
                                            onClick={() => onDelete(drawing.id)}
                                            sx={{color: 'text.secondary'}}
                                        >
                                            <DeleteOutlineIcon fontSize="small"/>
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            );
                        })}
                    </Box>
                )}
                {rows.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{mt: 1.5, flexWrap: 'wrap', rowGap: 1}}>
                        <Button variant="outlined" color="error" size="small" onClick={onDeleteAll}>
                            모두 삭제
                        </Button>
                        {hiddenCount > 0 && (
                            <Button variant="outlined" size="small" onClick={onShowAll}>
                                숨긴 선 모두 보이기 ({hiddenCount}개)
                            </Button>
                        )}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>닫기</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ChartDrawingListDialog;
