import {ReactNode, useState} from "react";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import NearMeOutlinedIcon from "@mui/icons-material/NearMeOutlined";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import {ChartToolbarButton} from "./ChartToolbarControls.tsx";
import {DRAWING_TOOLS, DrawingTool} from "../../lib/chart/types.ts";

interface ChartDrawingToolbarProps {
    tool: DrawingTool | null,   // 고른 도구. null 이면 선택·이동 상태
    lastTool: DrawingTool,      // 마지막에 쓴 도형. 도형 버튼이 이 도형을 보여 준다
    onSelectTool: (tool: DrawingTool | null) => void,
}

const LABELS: Record<DrawingTool, string> = {
    trend: '추세선',
    ray: '반직선',
    horizontal: '수평선',
    vertical: '수직선',
    rectangle: '사각형',
    channel: '평행 채널',
};

// 단축키가 있는 도형만 (Alt 와 함께 누른다)
const SHORTCUTS: Partial<Record<DrawingTool, string>> = {
    trend: 'Alt+T',
    horizontal: 'Alt+H',
    vertical: 'Alt+V',
    rectangle: 'Alt+R',
};

const ICONS: Record<DrawingTool, ReactNode> = {
    trend: <ShowChartIcon/>,
    ray: <NorthEastIcon/>,
    horizontal: <HorizontalRuleIcon/>,
    vertical: <HorizontalRuleIcon sx={{transform: 'rotate(90deg)'}}/>,
    rectangle: <CropSquareIcon/>,
    channel: <DragHandleIcon sx={{transform: 'rotate(-30deg)'}}/>,
};

const withShortcut = (tool: DrawingTool) => SHORTCUTS[tool] ? `${LABELS[tool]} (${SHORTCUTS[tool]})` : LABELS[tool];

// 골라 둔 버튼의 표시: 옅은 배경과 강조색
const selectedSx = {color: 'primary.main', backgroundColor: 'action.selected'};

/**
 * 그리기 도구 모음. 버튼은 셋뿐이다: 선택 · 마지막에 쓴 도형 · 도형 목록.
 * 도형을 고르면 차트에서 하나를 그린 뒤 다시 선택 상태로 돌아온다.
 */
const ChartDrawingToolbar = ({tool, lastTool, onSelectTool}: ChartDrawingToolbarProps) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    // 그리는 중이면 그 도형을, 아니면 마지막에 쓴 도형을 보여 준다.
    const shown = tool ?? lastTool;

    return (
        <Stack direction="row" sx={{alignItems: 'center'}}>
            <Tooltip title="선택 · 이동 (Esc)">
                <ChartToolbarButton aria-label="선택" onClick={() => onSelectTool(null)} sx={tool ? undefined : selectedSx}>
                    <NearMeOutlinedIcon/>
                </ChartToolbarButton>
            </Tooltip>
            <Tooltip title={withShortcut(shown)}>
                <ChartToolbarButton
                    aria-label={LABELS[shown]}
                    onClick={() => onSelectTool(tool === shown ? null : shown)}
                    sx={tool ? selectedSx : undefined}
                >
                    {ICONS[shown]}
                </ChartToolbarButton>
            </Tooltip>
            <Tooltip title="다른 도형">
                <ChartToolbarButton
                    aria-label="다른 도형"
                    aria-haspopup="menu"
                    onClick={event => setAnchor(event.currentTarget)}
                    sx={{width: 20, minWidth: 20}}
                >
                    <ArrowDropDownIcon/>
                </ChartToolbarButton>
            </Tooltip>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
                {DRAWING_TOOLS.map(item => (
                    <MenuItem
                        key={item}
                        selected={item === shown}
                        onClick={() => {
                            setAnchor(null);
                            onSelectTool(item);
                        }}
                    >
                        <ListItemIcon>{ICONS[item]}</ListItemIcon>
                        <ListItemText>{LABELS[item]}</ListItemText>
                        {SHORTCUTS[item] && (
                            <Typography variant="body2" sx={{color: 'text.secondary', ml: 2}}>{SHORTCUTS[item]}</Typography>
                        )}
                    </MenuItem>
                ))}
            </Menu>
        </Stack>
    );
};

export default ChartDrawingToolbar;
