import {useRef, useState} from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import CheckIcon from "@mui/icons-material/Check";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {ChartToolbarButton} from "./ChartToolbarControls.tsx";
import InputBase from "@mui/material/InputBase";
import {DrawingStyle, FIBONACCI_LEVEL_CHOICES, FIBONACCI_LEVEL_LIMIT, MAX_FIBONACCI_LEVELS} from "../../lib/chart/types.ts";

const LEVEL_STEPS = 1000;   // 직접 입력한 비율은 소수 셋째 자리까지만 받는다

interface ChartDrawingStylePanelProps {
    style: DrawingStyle,        // 선택한 도형의 꾸미기
    colorCount: number,         // 고를 수 있는 색의 수. 색은 차트의 --chart-line-N 변수에서 온다
    onChange: (change: DrawingStyle) => void,
    onDelete: () => void,
    locked: boolean,            // 잠근 도형인지. 잠그면 끌어 옮기거나 점을 고칠 수 없다
    onLockChange: (locked: boolean) => void,
    // 글자 도형일 때만 준다. 주면 굵기는 글자 크기로 쓰이고, 점선 대신 글자 수정 버튼이 나온다
    onEditText?: () => void,
    // 피보나치 되돌림일 때만 준다. 켜 둔 비율이고, 주면 비율을 켜고 끄는 버튼이 나온다
    levels?: number[],
    onLevelsChange?: (levels: number[]) => void,
    // 수평선일 때만 준다. 주면 맨 앞에 가격 입력 칸이 나온다. text 는 차트 라벨과 같은 자릿수로 적은 지금 가격이고,
    // onCommit 은 입력한 가격(0보다 큰 수)을 받아 선을 옮긴다(잠긴 선이면 받는 쪽이 거절하고 알린다)
    price?: { value: number, text: string, onCommit: (price: number) => void },
}

const PRICE_PATTERN = /^\d+(\.\d+)?$/;   // 가격 입력으로 받는 글자 (쉼표를 뺀 뒤). 1e3·0x10 같은 표기는 받지 않는다

interface PriceFieldProps {
    value: number,
    text: string,
    onCommit: (price: number) => void,
}

/**
 * 수평선의 가격 입력 칸. Enter 나 칸 밖을 누르면 반영하고, Esc 는 반영하지 않고 원래 값으로 되돌린다.
 * 숫자가 아니거나 0 이하이거나 지금 가격과 같으면 반영하지 않는다. 어느 쪽이든 칸은 지금 선의 가격으로 돌아간다
 * (옮겨지면 바깥에서 새 가격으로 칸을 다시 만든다).
 */
const PriceField = ({value, text, onCommit}: PriceFieldProps) => {
    const [input, setInput] = useState(text);
    const cancelled = useRef(false);    // Esc 로 벗어나는 중인지. 그때의 blur 는 반영하지 않는다
    const commit = () => {
        const skip = cancelled.current;
        cancelled.current = false;
        setInput(text);
        // 칸의 글자를 고치지 않았으면 반영하지 않는다(칸에는 반올림한 값이 보이므로, 저장된 값과 비교하면 들어갔다 나오기만 해도 옮겨진다)
        const plain = input.replace(/,/g, '').trim();
        if (skip || input === text || !PRICE_PATTERN.test(plain)) return;
        const price = Number(plain);
        if (price > 0 && price !== value) onCommit(price);
    };
    return (
        <Tooltip title="가격 (입력 후 Enter)">
            <InputBase
                value={input}
                onChange={event => setInput(event.target.value)}
                onFocus={event => event.target.select()}
                onBlur={commit}
                onKeyDown={event => {
                    if (event.nativeEvent.isComposing) return;     // 한글 조합 중의 Enter 는 확정이 아니다
                    if (event.key === 'Enter' || event.key === 'Escape') {
                        // 자세히 보기 창 안에서도 Esc 가 창을 닫지 않고 입력만 되돌리게 한다
                        event.stopPropagation();
                        cancelled.current = event.key === 'Escape';
                        (event.target as HTMLInputElement).blur();
                    }
                }}
                inputProps={{'aria-label': '수평선 가격', inputMode: 'decimal'}}
                sx={{width: 104, px: 1, typography: 'body2', border: 1, borderColor: 'divider', borderRadius: 1}}
            />
        </Tooltip>
    );
};

export const DEFAULT_DRAWING_COLOR = 4;     // 꾸미기를 정하지 않은 도형의 색 순번 (엔진의 기본값과 같다)
const LINE_WIDTHS = [1, 2, 3];
const SWATCH_SIZE = 16;

// 골라 둔 항목의 표시
const selectedSx = {color: 'primary.main', backgroundColor: 'action.selected'};

/**
 * 도형을 선택하면 차트 위쪽 가운데에 뜨는 패널: 색 · 굵기 · 점선 · 잠금 · 삭제. (글자 도형은 색 · 크기 · 글자 수정 · 잠금 · 삭제)
 * 수평선은 맨 앞에 가격 입력 칸이 더 나온다.
 * 피보나치 되돌림은 점선 뒤에 비율을 켜고 끄는 버튼이 더 나온다.
 * 색은 테마에서 온 선 색 목록 안에서만 고른다.
 */
const ChartDrawingStylePanel = ({
    style, colorCount, onChange, onDelete, locked, onLockChange, onEditText, levels, onLevelsChange, price,
}: ChartDrawingStylePanelProps) => {
    const [levelsAnchor, setLevelsAnchor] = useState<HTMLElement | null>(null);
    /** 비율 하나를 켜거나 끈다. 마지막 남은 하나는 끌 수 없다(선이 하나도 없는 도형이 되므로). */
    const toggleLevel = (level: number) => {
        if (!levels || !onLevelsChange) return;
        const next = levels.includes(level) ? levels.filter(item => item !== level) : [...levels, level];
        if (next.length > 0 && next.length <= MAX_FIBONACCI_LEVELS) onLevelsChange([...next].sort((a, b) => a - b));
    };
    // 목록에 보일 비율: 정해 둔 것 + 직접 입력해 켜 둔 것. 직접 입력한 비율은 끄면 목록에서 사라진다.
    const levelChoices = [...new Set([...FIBONACCI_LEVEL_CHOICES, ...(levels ?? [])])].sort((a, b) => a - b);
    const [customLevel, setCustomLevel] = useState('');
    const parsedLevel = Math.round(Number(customLevel) * LEVEL_STEPS) / LEVEL_STEPS;
    const customValid = customLevel.trim() !== '' && Number.isFinite(parsedLevel)
        && parsedLevel >= FIBONACCI_LEVEL_LIMIT.min && parsedLevel <= FIBONACCI_LEVEL_LIMIT.max;
    /** 직접 입력한 비율을 켠다. 이미 켜져 있으면 그대로 둔다. */
    const addCustomLevel = () => {
        if (!customValid || !levels) return;
        if (!levels.includes(parsedLevel)) toggleLevel(parsedLevel);
        setCustomLevel('');
    };
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
                {price && (
                    <>
                        {/* 선이 바깥에서 옮겨지면(끌기, 되돌리기) 새 가격으로 칸을 다시 만든다 */}
                        <PriceField key={price.text} value={price.value} text={price.text} onCommit={price.onCommit}/>
                        <Divider orientation="vertical" flexItem sx={{my: 0.5}}/>
                    </>
                )}
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
                {levels && (
                    <>
                        <Button
                            size="small"
                            aria-haspopup="menu"
                            onClick={event => setLevelsAnchor(event.currentTarget)}
                            sx={{minWidth: 0, color: 'text.secondary', whiteSpace: 'nowrap', flexShrink: 0}}
                        >
                            비율
                        </Button>
                        {/* 고르는 동안 닫지 않고, 바깥을 누르면 닫는다. */}
                        <Menu
                            anchorEl={levelsAnchor}
                            open={Boolean(levelsAnchor)}
                            onClose={() => setLevelsAnchor(null)}
                            slotProps={{list: {dense: true}}}
                        >
                            {levelChoices.map(level => (
                                <MenuItem
                                    key={level}
                                    role="menuitemcheckbox"
                                    aria-checked={levels.includes(level)}
                                    onClick={() => toggleLevel(level)}
                                >
                                    <ListItemIcon>{levels.includes(level) && <CheckIcon fontSize="small"/>}</ListItemIcon>
                                    <ListItemText>{level}</ListItemText>
                                </MenuItem>
                            ))}
                            <Divider/>
                            {/* 목록에 없는 비율을 직접 넣는다. 메뉴가 글자 키를 항목 찾기로 쓰지 않게 키 입력을 여기서 멈춘다. */}
                            <Stack
                                direction="row"
                                spacing={1}
                                sx={{px: 2, py: 0.5, alignItems: 'center'}}
                                onKeyDown={event => event.stopPropagation()}
                            >
                                <InputBase
                                    value={customLevel}
                                    onChange={event => setCustomLevel(event.target.value)}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter') addCustomLevel();
                                        else if (event.key === 'Escape') setLevelsAnchor(null);
                                    }}
                                    placeholder="직접 입력"
                                    inputProps={{
                                        'aria-label': '비율 직접 입력',
                                        inputMode: 'decimal',
                                    }}
                                    sx={{width: 88, px: 1, typography: 'body2', border: 1, borderColor: 'divider', borderRadius: 1}}
                                />
                                <Button size="small" disabled={!customValid} onClick={addCustomLevel} sx={{minWidth: 0}}>
                                    추가
                                </Button>
                            </Stack>
                        </Menu>
                    </>
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
