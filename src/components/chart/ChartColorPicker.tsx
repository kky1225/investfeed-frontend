import {useState} from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Divider from "@mui/material/Divider";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import {ChartToolbarButton} from "./ChartToolbarControls.tsx";
import {chartColorVars, LINE_COLOR_VARS} from "./chartColors.ts";
import {SERIES_WIDTHS} from "../../lib/chart/types.ts";

/** 선의 굵기와 점선. 주면 색 아래에 굵기·점선을 고르는 줄이 더 나온다 */
export interface ChartLineStroke {
    width: number,
    dashed: boolean,
    onWidthChange: (width: number) => void,
    onDashedChange: (dashed: boolean) => void,
}

interface ChartColorPickerProps {
    label: string,      // 어느 선의 색인지 (예: "이동평균선 선 1")
    value: number,      // 선 색 목록에서의 순번
    onChange: (value: number) => void,
    stroke?: ChartLineStroke,
}

const SWATCH_SIZE = 16;

const swatchSx = (order: number) => ({
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: '50%',
    // 목록보다 큰 순번은 처음부터 돌려 쓴다(엔진과 같은 규칙).
    backgroundColor: `var(${LINE_COLOR_VARS[order % LINE_COLOR_VARS.length]})`,
});

// 골라 둔 항목의 표시 (도형 꾸미기 패널과 같다)
const selectedSx = {color: 'primary.main', backgroundColor: 'action.selected'};

/**
 * 선 하나의 모양을 고르는 단추. 누르면 차트의 선 색 목록이 뜨고 그 안에서만 고른다.
 * stroke 를 주면 굵기와 점선도 같은 자리에서 고른다. 색을 고르면 닫히고, 굵기·점선은 고르는 동안 열려 있다.
 */
const ChartColorPicker = ({label, value, onChange, stroke}: ChartColorPickerProps) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const selected = value % LINE_COLOR_VARS.length;
    const title = stroke ? `${label} 색·굵기` : `${label} 색`;

    return (
        <>
            <Tooltip title={title}>
                <ButtonBase
                    aria-label={title}
                    aria-haspopup="true"
                    onClick={event => setAnchor(event.currentTarget)}
                    sx={{...swatchSx(value), border: 1, borderColor: 'divider', flexShrink: 0}}
                />
            </Tooltip>
            {/* 메뉴는 화면 다른 곳에 따로 그려지므로 색 변수를 한 번 더 걸어 준다. */}
            <Popover
                open={Boolean(anchor)}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                sx={chartColorVars}
            >
                <Stack direction="row" spacing={1.5} sx={{p: 1.5}}>
                    {LINE_COLOR_VARS.map((_name, order) => (
                        <ButtonBase
                            key={order}
                            aria-label={`색 ${order + 1}`}
                            aria-pressed={order === selected}
                            onClick={() => {
                                setAnchor(null);
                                if (order !== value) onChange(order);
                            }}
                            sx={{
                                ...swatchSx(order),
                                // 고른 색은 바깥에 테두리를 한 겹 둘러 표시한다.
                                outline: order === selected ? '2px solid' : 'none',
                                outlineColor: 'primary.main',
                                outlineOffset: 2,
                            }}
                        />
                    ))}
                </Stack>
                {stroke && (
                    <>
                        <Divider/>
                        <Stack direction="row" spacing={0.5} sx={{px: 1, py: 0.5, alignItems: 'center'}}>
                            {SERIES_WIDTHS.map(width => (
                                <Tooltip key={width} title={`굵기 ${width}`}>
                                    <ChartToolbarButton
                                        aria-label={`굵기 ${width}`}
                                        aria-pressed={width === stroke.width}
                                        onClick={() => {
                                            if (width !== stroke.width) stroke.onWidthChange(width);
                                        }}
                                        sx={width === stroke.width ? selectedSx : undefined}
                                    >
                                        <Box sx={{width: 16, height: width + 1, backgroundColor: 'currentColor', borderRadius: 1}}/>
                                    </ChartToolbarButton>
                                </Tooltip>
                            ))}
                            <Divider orientation="vertical" flexItem sx={{my: 0.5}}/>
                            <Tooltip title={stroke.dashed ? '실선으로' : '점선으로'}>
                                <ChartToolbarButton
                                    aria-label="점선"
                                    aria-pressed={stroke.dashed}
                                    onClick={() => stroke.onDashedChange(!stroke.dashed)}
                                    sx={stroke.dashed ? selectedSx : undefined}
                                >
                                    <Box sx={{width: 16, borderTop: '2px dashed', borderColor: 'currentColor'}}/>
                                </ChartToolbarButton>
                            </Tooltip>
                        </Stack>
                    </>
                )}
            </Popover>
        </>
    );
};

export default ChartColorPicker;
