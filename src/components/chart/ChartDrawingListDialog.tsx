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
import {alpha} from "@mui/material/styles";
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
 * 줄 안의 잠금·숨기기·삭제 버튼. 테마가 아이콘 버튼마다 테두리·배경을 그려 줄이 답답해 보여서 이 창에서만 걷어낸다.
 * 테마 규칙(다크 모드 hover·라이트 모드 active)이 클래스 두 개 무게까지 있어 '&&'로 무게를 맞춘다(같으면 뒤에 오는 sx가 이긴다)
 */
const ROW_BUTTON_SX = {
    '&&': {border: 0, backgroundColor: 'transparent'},
    '&&:hover': {backgroundColor: 'action.selected'},
} as const;

/** 삭제 버튼(줄·모두 삭제)은 평소엔 회색, 마우스를 올리거나 키보드로 고르면 빨갛게 한다 */
const DELETE_COLOR_SX = {
    '&&': {color: 'text.secondary'},
    '&&:hover, &&.Mui-focusVisible': {color: 'error.main'},
} as const;

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
 * 잠긴 줄은 주황 바탕과 주황 자물쇠로 눈에 띄게 한다(빨강은 상승·삭제 색이라 쓰지 않는다)
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
            <DialogTitle>
                그린 선 목록
                {drawings.length > 0 && (
                    <Box component="span" sx={{ml: 1, color: 'text.secondary', fontWeight: 'fontWeightRegular'}}>
                        {drawings.length}개
                    </Box>
                )}
            </DialogTitle>
            <DialogContent>
                {rows.length === 0 ? (
                    <Typography variant="body2" sx={{color: 'text.secondary'}}>그린 선이 없습니다.</Typography>
                ) : (
                    <Stack spacing={0.5}>
                        {rows.map(drawing => {
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
                                        gap: 0.25,
                                        pr: 0.5,
                                        borderRadius: 1,
                                        bgcolor: locked
                                            ? theme => alpha(theme.palette.warning.main, 0.12)
                                            : 'transparent',
                                        '&:hover': {
                                            bgcolor: locked
                                                ? theme => alpha(theme.palette.warning.main, 0.2)
                                                : 'action.hover',
                                        },
                                    }}
                                >
                                    {/* describeChild: 버튼 이름은 안의 글자(종류·요약)로 읽고, 툴팁 문구는 설명으로 붙인다 */}
                                    <Tooltip describeChild title={hidden ? '다시 보이게 하고 이 선으로 이동' : '이 선으로 이동'}>
                                        <ButtonBase
                                            onClick={() => onSelect(drawing)}
                                            sx={{
                                                flex: 1,
                                                minWidth: 0,
                                                justifyContent: 'flex-start',
                                                gap: 1.25,
                                                pl: 1,
                                                pr: 1,
                                                py: 0.75,
                                                borderRadius: 1,
                                                textAlign: 'left',
                                                color: hidden ? 'text.disabled' : 'text.primary',
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    flexShrink: 0,
                                                    width: 28,
                                                    height: 28,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: 0.75,
                                                    bgcolor: 'action.selected',
                                                    // 잠금은 자물쇠·줄 바탕으로만 알린다. 여기 색을 바꾸면 선 색처럼 읽힌다
                                                    color: hidden ? 'text.disabled' : 'text.secondary',
                                                    '& svg': {fontSize: 18},
                                                }}
                                            >
                                                {DRAWING_ICONS[drawing.type]}
                                            </Box>
                                            <Typography variant="body2" noWrap>
                                                {label}
                                                {summary && (
                                                    <Box
                                                        component="span"
                                                        sx={{
                                                            ml: 1,
                                                            color: hidden ? 'text.disabled' : 'text.secondary',
                                                            fontVariantNumeric: 'tabular-nums',
                                                        }}
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
                                            aria-label={`${label} 잠금`}
                                            aria-pressed={locked}
                                            onClick={() => onChange(drawing.id, {locked: locked ? null : true})}
                                            sx={{
                                                ...ROW_BUTTON_SX,
                                                color: locked ? 'warning.main' : 'text.disabled',
                                                '&&:hover': {
                                                    ...ROW_BUTTON_SX['&&:hover'],
                                                    color: locked ? 'warning.main' : 'text.secondary',
                                                },
                                            }}
                                        >
                                            {locked ? <LockOutlinedIcon fontSize="small"/> : <LockOpenOutlinedIcon fontSize="small"/>}
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title={hidden ? '보이기' : '숨기기'}>
                                        <IconButton
                                            size="small"
                                            aria-label={`${label} 숨기기`}
                                            aria-pressed={hidden}
                                            onClick={() => onChange(drawing.id, {hidden: hidden ? null : true})}
                                            sx={{...ROW_BUTTON_SX, color: hidden ? 'text.disabled' : 'success.main'}}
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
                                            sx={{
                                                ...ROW_BUTTON_SX,
                                                '&&': {...ROW_BUTTON_SX['&&'], ...DELETE_COLOR_SX['&&']},
                                                '&&:hover': {...ROW_BUTTON_SX['&&:hover'], color: 'error.main'},
                                                '&&.Mui-focusVisible': {color: 'error.main'},
                                            }}
                                        >
                                            <DeleteOutlineIcon fontSize="small"/>
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            );
                        })}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions
                sx={{
                    justifyContent: 'space-between',
                    gap: 1,
                    mx: 3,
                    px: 0,
                    borderTop: rows.length > 0 ? 1 : 0,
                    borderColor: 'divider',
                }}
            >
                <Stack direction="row" spacing={0.5} sx={{flexWrap: 'wrap', rowGap: 0.5}}>
                    {rows.length > 0 && (
                        <Button
                            size="small"
                            startIcon={<DeleteOutlineIcon/>}
                            sx={DELETE_COLOR_SX}
                            onClick={onDeleteAll}
                        >
                            모두 삭제
                        </Button>
                    )}
                    {hiddenCount > 0 && (
                        <Button size="small" startIcon={<VisibilityOutlinedIcon/>} onClick={onShowAll}>
                            숨긴 선 모두 보이기 ({hiddenCount}개)
                        </Button>
                    )}
                </Stack>
                <Button onClick={onClose}>닫기</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ChartDrawingListDialog;
