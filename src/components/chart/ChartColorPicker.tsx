import {useState} from "react";
import ButtonBase from "@mui/material/ButtonBase";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import {chartColorVars, LINE_COLOR_VARS} from "./chartColors.ts";

interface ChartColorPickerProps {
    label: string,      // 어느 선의 색인지 (예: "이동평균선 선 1")
    value: number,      // 선 색 목록에서의 순번
    onChange: (value: number) => void,
}

const SWATCH_SIZE = 16;

const swatchSx = (order: number) => ({
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: '50%',
    // 목록보다 큰 순번은 처음부터 돌려 쓴다(엔진과 같은 규칙).
    backgroundColor: `var(${LINE_COLOR_VARS[order % LINE_COLOR_VARS.length]})`,
});

/** 선 색 하나를 고르는 단추. 누르면 차트의 선 색 목록이 뜨고 그 안에서만 고른다. */
const ChartColorPicker = ({label, value, onChange}: ChartColorPickerProps) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const selected = value % LINE_COLOR_VARS.length;

    return (
        <>
            <Tooltip title={`${label} 색`}>
                <ButtonBase
                    aria-label={`${label} 색`}
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
            </Popover>
        </>
    );
};

export default ChartColorPicker;
