import {MouseEvent} from "react";
import ToggleButton from "@mui/material/ToggleButton";
import Tooltip from "@mui/material/Tooltip";
import CandlestickChartIcon from "@mui/icons-material/CandlestickChart";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import type {MiniChartMode} from "../../lib/chart/MiniChart.ts";
import {ChartToolbarGroup} from "./ChartToolbarControls.tsx";

interface MiniChartModeToggleProps {
    mode: MiniChartMode,
    onChange: (mode: MiniChartMode) => void,
}

/** 목록 화면 위쪽의 선/캔들 선택. 그 화면의 카드 차트 전부에 적용된다. */
const MiniChartModeToggle = ({mode, onChange}: MiniChartModeToggleProps) => (
    <ChartToolbarGroup
        size="small"
        value={mode}
        exclusive
        onChange={(_event: MouseEvent<HTMLElement>, next: MiniChartMode | null) => {
            if (next) onChange(next);
        }}
        aria-label="차트 모양"
    >
        <ToggleButton value="line" aria-label="선 차트">
            <Tooltip title="선"><ShowChartIcon/></Tooltip>
        </ToggleButton>
        <ToggleButton value="candle" aria-label="캔들 차트">
            <Tooltip title="캔들"><CandlestickChartIcon/></Tooltip>
        </ToggleButton>
    </ChartToolbarGroup>
);

export default MiniChartModeToggle;
