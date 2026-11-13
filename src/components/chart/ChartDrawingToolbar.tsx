import ToggleButton from "@mui/material/ToggleButton";
import {ChartToolbarGroup} from "./ChartToolbarControls.tsx";
import Tooltip from "@mui/material/Tooltip";
import NearMeOutlinedIcon from "@mui/icons-material/NearMeOutlined";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import {DrawingTool} from "../../lib/chart/types.ts";

interface ChartDrawingToolbarProps {
    tool: DrawingTool | null,   // 고른 도구. null 이면 선택·이동 상태
    onSelectTool: (tool: DrawingTool | null) => void,
}

const CURSOR = 'cursor';

/**
 * 그리기 도구 모음. 차트 위쪽 줄에 아이콘만 가로로 놓아 차트 너비를 차지하지 않는다.
 * 도구를 고르면 차트에서 하나를 그린 뒤 다시 선택 상태로 돌아온다.
 */
const ChartDrawingToolbar = ({tool, onSelectTool}: ChartDrawingToolbarProps) => (
    <ChartToolbarGroup
        size="small"
        exclusive
        value={tool ?? CURSOR}
        onChange={(_event, next: string | null) => {
            onSelectTool(next === null || next === CURSOR ? null : next as DrawingTool);
        }}
        aria-label="그리기 도구"
    >
        <ToggleButton value={CURSOR} aria-label="선택">
            <Tooltip title="선택 · 이동 (Esc)">
                <NearMeOutlinedIcon fontSize="small"/>
            </Tooltip>
        </ToggleButton>
        <ToggleButton value="trend" aria-label="추세선">
            <Tooltip title="추세선 (Alt+T)">
                <ShowChartIcon fontSize="small"/>
            </Tooltip>
        </ToggleButton>
        <ToggleButton value="horizontal" aria-label="수평선">
            <Tooltip title="수평선 (Alt+H)">
                <HorizontalRuleIcon fontSize="small"/>
            </Tooltip>
        </ToggleButton>
    </ChartToolbarGroup>
);

export default ChartDrawingToolbar;
