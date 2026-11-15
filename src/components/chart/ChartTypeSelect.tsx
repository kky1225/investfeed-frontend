import {ReactNode, useState} from "react";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import AreaChartIcon from "@mui/icons-material/AreaChart";
import BarChartIcon from "@mui/icons-material/BarChart";
import CandlestickChartIcon from "@mui/icons-material/CandlestickChart";
import CandlestickChartOutlinedIcon from "@mui/icons-material/CandlestickChartOutlined";
import SsidChartIcon from "@mui/icons-material/SsidChart";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";
import WaterfallChartIcon from "@mui/icons-material/WaterfallChart";
import {ChartToolbarButton} from "./ChartToolbarControls.tsx";
import {CHART_TYPES, ChartType} from "../../lib/chart/types.ts";

interface ChartTypeSelectProps {
    value: ChartType,
    onChange: (type: ChartType) => void,
}

const LABELS: Record<ChartType, string> = {
    candle: '캔들',
    hollow: '속 빈 캔들',
    bar: '봉',
    line: '선',
    area: '영역',
    baseline: '기준선',
    heikinAshi: '하이킨아시',
};

const ICONS: Record<ChartType, ReactNode> = {
    candle: <CandlestickChartIcon/>,
    hollow: <CandlestickChartOutlinedIcon/>,
    bar: <BarChartIcon/>,
    line: <StackedLineChartIcon/>,
    area: <AreaChartIcon/>,
    baseline: <SsidChartIcon/>,
    heikinAshi: <WaterfallChartIcon/>,
};

/** 차트 종류를 고르는 버튼. 지금 종류의 아이콘을 보여 주고, 누르면 목록이 펼쳐진다. */
const ChartTypeSelect = ({value, onChange}: ChartTypeSelectProps) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);

    return (
        <>
            <Tooltip title={`차트 종류: ${LABELS[value]}`}>
                <ChartToolbarButton
                    aria-label="차트 종류"
                    aria-haspopup="menu"
                    onClick={event => setAnchor(event.currentTarget)}
                >
                    {ICONS[value]}
                </ChartToolbarButton>
            </Tooltip>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
                {CHART_TYPES.map(type => (
                    <MenuItem
                        key={type}
                        selected={type === value}
                        onClick={() => {
                            setAnchor(null);
                            onChange(type);
                        }}
                    >
                        <ListItemIcon>{ICONS[type]}</ListItemIcon>
                        <ListItemText>{LABELS[type]}</ListItemText>
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};

export default ChartTypeSelect;
