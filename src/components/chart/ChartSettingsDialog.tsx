import {useState} from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import ChartColorPicker from "./ChartColorPicker.tsx";
import ChartComparisonField, {ChartComparisonFieldProps} from "./ChartComparisonField.tsx";
import {chartColorVars} from "./chartColors.ts";

/** 지표의 설정값 하나 (기간 등) */
export interface ChartIndicatorParam {
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,   // 1 이면 정수만 받는다
}

/** 색을 바꿀 수 있는 선 하나 */
export interface ChartIndicatorColor {
    label: string,
    value: number,  // 차트의 선 색 목록에서의 순번
}

/** 설정 창의 지표 한 줄 */
export interface ChartIndicatorOption {
    key: string,
    label: string,
    on: boolean,
    params: ChartIndicatorParam[],
    colors: ChartIndicatorColor[],
    // 설정값 하나가 선 하나인 지표(이동평균선 등)면 선을 더하고 뺄 수 있는지. 그런 지표는 params 와 colors 가 같은 순서의 선들이다
    lines: { canAdd: boolean, canRemove: boolean } | null,
    customized: boolean,    // 설정값·색·선 개수를 기본에서 바꿔 둔 상태인지
}

/** 지표에서 바꾼 것. 준 항목만 바뀐다 */
export interface ChartIndicatorChange {
    params?: number[],
    colors?: number[],
}

interface ChartSettingsDialogProps {
    open: boolean,
    onClose: () => void,
    indicatorOptions: ChartIndicatorOption[],
    onToggleIndicator: (key: string, on: boolean) => void,
    onIndicatorChange: (key: string, change: ChartIndicatorChange) => void,
    onIndicatorReset: (key: string) => void,
    drawingToolbar: boolean,                    // 그리기 도구 모음을 보일지
    onDrawingToolbarChange: (visible: boolean) => void,
    logScale: boolean,                          // 가격축을 로그로 할지
    onLogScaleChange: (enabled: boolean) => void,
    percentScale: boolean,                      // 가격축에 가격 대신 등락률을 적을지
    onPercentScaleChange: (enabled: boolean) => void,
    flatByPrevClose: boolean,                  // 시가와 종가가 같은 캔들을 전일 종가 기준으로 색칠할지
    onFlatByPrevCloseChange: (enabled: boolean) => void,
    drawingCount: number,                       // 그려 둔 선의 수
    onClearDrawings: () => void,
    hiddenDrawingCount: number,                 // 그중 숨겨 둔 선의 수
    onShowDrawings: () => void,                 // 숨겨 둔 선을 모두 다시 보이게 한다
    comparison?: ChartComparisonFieldProps,     // 종목 비교. 비교를 쓸 수 있는 화면에서만 준다
}

interface ParamFieldProps {
    param: ChartIndicatorParam,
    onCommit: (value: number) => void,
}

/**
 * 숫자 하나를 고치는 칸. 입력하는 동안에는 반영하지 않고, 칸을 벗어나거나 Enter 를 누를 때
 * 범위 안의 숫자면 반영하고 아니면 원래 값으로 되돌린다. (입력 도중의 값으로 지표가 흔들리지 않게 한다)
 */
const ParamField = ({param, onCommit}: ParamFieldProps) => {
    const [text, setText] = useState(String(param.value));

    const commit = () => {
        const value = Number(text);
        const valid = text.trim() !== '' && Number.isFinite(value)
            && value >= param.min && value <= param.max
            && (param.step !== 1 || Number.isInteger(value));
        if (!valid) {
            setText(String(param.value));
            return;
        }
        if (value !== param.value) onCommit(value);
    };

    return (
        <TextField
            size="small"
            type="number"
            label={param.label}
            value={text}
            onChange={event => setText(event.target.value)}
            onBlur={commit}
            onKeyDown={event => {
                if (event.key === 'Enter') commit();
            }}
            slotProps={{htmlInput: {min: param.min, max: param.max, step: param.step, 'aria-label': param.label}}}
            sx={{width: 84}}
        />
    );
};

interface IndicatorFieldsProps {
    option: ChartIndicatorOption,
    onChange: (change: ChartIndicatorChange) => void,
}

/** 지표 한 줄의 설정값 칸과 색 단추. 선을 더하고 뺄 수 있는 지표는 선마다 "기간 · 색 · 지우기"를 한 묶음으로 놓는다. */
const IndicatorFields = ({option, onChange}: IndicatorFieldsProps) => {
    const values = option.params.map(param => param.value);
    const colors = option.colors.map(color => color.value);
    const replaced = (list: number[], order: number, value: number) => list.map((item, index) => index === order ? value : item);
    const colorPicker = (color: ChartIndicatorColor, order: number) => (
        <ChartColorPicker
            label={`${option.label} ${color.label}`}
            value={color.value}
            onChange={value => onChange({colors: replaced(colors, order, value)})}
        />
    );
    const paramField = (param: ChartIndicatorParam, order: number) => (
        <ParamField
            // 값이 바깥에서 바뀌면(기본값으로 되돌리기, 선 지우기 등) 칸을 새 값으로 다시 만든다.
            key={`${order}-${param.value}`}
            param={param}
            onCommit={value => onChange({params: replaced(values, order, value)})}
        />
    );

    if (option.lines) {
        const last = option.params[option.params.length - 1];
        return (
            <Stack direction="row" spacing={1.5} useFlexGap sx={{flexWrap: 'wrap', alignItems: 'center', mt: 1}}>
                {option.params.map((param, order) => (
                    <Stack key={`${order}-${param.value}`} direction="row" spacing={0.5} sx={{alignItems: 'center'}}>
                        {paramField(param, order)}
                        {colorPicker(option.colors[order], order)}
                        {option.lines?.canRemove && (
                            <Tooltip title="선 지우기">
                                <IconButton
                                    size="small"
                                    aria-label={`${option.label} ${param.label} 지우기`}
                                    onClick={() => onChange({
                                        params: values.filter((_value, index) => index !== order),
                                        colors: colors.filter((_color, index) => index !== order),
                                    })}
                                >
                                    <CloseIcon fontSize="inherit"/>
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>
                ))}
                {option.lines.canAdd && (
                    <Button
                        size="small"
                        startIcon={<AddIcon/>}
                        // 새 선의 기간은 마지막 선의 2배, 색은 다음 순번
                        onClick={() => onChange({
                            params: [...values, Math.min(last.max, last.value * 2)],
                            colors: [...colors, colors.length],
                        })}
                    >
                        선 추가
                    </Button>
                )}
            </Stack>
        );
    }

    if (option.params.length === 0 && option.colors.length === 0) return null;
    return (
        <Stack direction="row" spacing={1} useFlexGap sx={{flexWrap: 'wrap', alignItems: 'center', mt: 1}}>
            {option.params.map(paramField)}
            {option.colors.map((color, order) => (
                <Stack key={color.label} direction="row" spacing={0.5} sx={{alignItems: 'center', pl: 0.5}}>
                    <Typography variant="caption" sx={{color: 'text.secondary'}}>{color.label}</Typography>
                    {colorPicker(color, order)}
                </Stack>
            ))}
        </Stack>
    );
};

/** 차트 설정 창. 바꾸는 즉시 차트에 반영된다. */
const ChartSettingsDialog = ({
    open, onClose, indicatorOptions, onToggleIndicator, onIndicatorChange, onIndicatorReset,
    drawingToolbar, onDrawingToolbarChange,
    logScale, onLogScaleChange, percentScale, onPercentScaleChange,
    flatByPrevClose, onFlatByPrevCloseChange, drawingCount, onClearDrawings, hiddenDrawingCount, onShowDrawings,
    comparison,
}: ChartSettingsDialogProps) => (
    // 창은 화면 다른 곳에 따로 그려지므로, 색 단추가 차트의 색을 쓸 수 있게 색 변수를 걸어 준다.
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth sx={chartColorVars}>
        <DialogTitle>차트 설정</DialogTitle>
        <DialogContent>
            {comparison && (
                <>
                    <Typography variant="subtitle2" sx={{color: 'text.secondary', mb: 1}}>종목 비교</Typography>
                    {/* 검색 칸의 이름표가 잘리지 않게 위에 여백을 둔다. */}
                    <Box sx={{pt: 1}}>
                        <ChartComparisonField {...comparison}/>
                    </Box>
                    <Divider sx={{my: 2}}/>
                </>
            )}
            <Typography variant="subtitle2" sx={{color: 'text.secondary', mb: 1}}>지표</Typography>
            <Stack spacing={1.5}>
                {indicatorOptions.map(option => (
                    <Box key={option.key}>
                        <Stack direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                            <FormControlLabel
                                label={option.label}
                                control={
                                    <Switch
                                        checked={option.on}
                                        onChange={(_event, checked) => onToggleIndicator(option.key, checked)}
                                    />
                                }
                            />
                            {option.customized && (
                                <Button size="small" onClick={() => onIndicatorReset(option.key)}>기본값으로</Button>
                            )}
                        </Stack>
                        <IndicatorFields option={option} onChange={change => onIndicatorChange(option.key, change)}/>
                    </Box>
                ))}
            </Stack>

            <Divider sx={{my: 2}}/>

            <Typography variant="subtitle2" sx={{color: 'text.secondary', mb: 1}}>축</Typography>
            <FormGroup>
                <FormControlLabel
                    label="로그 축"
                    control={<Switch checked={logScale} onChange={(_event, checked) => onLogScaleChange(checked)}/>}
                />
            </FormGroup>
            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                켜면 같은 등락률이 같은 높이로 그려집니다. 가격이 크게 오르내린 긴 구간을 볼 때 초반 움직임이 잘 보입니다.
                오른쪽 가격축을 위아래로 끌면 세로 크기를 바꿀 수 있고, 더블클릭하면 원래대로 돌아옵니다.
            </Typography>
            <FormGroup sx={{mt: 1}}>
                <FormControlLabel
                    label="퍼센트 축"
                    control={
                        <Switch checked={percentScale} onChange={(_event, checked) => onPercentScaleChange(checked)}/>
                    }
                />
            </FormGroup>
            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                켜면 가격축에 가격 대신 등락률(%)을 적습니다. 기준(0%)은 화면에 보이는 첫 캔들의 종가라서,
                차트를 움직이거나 확대하면 기준도 따라 바뀝니다. 위쪽의 시가·고가·저가·종가는 가격 그대로입니다.
            </Typography>

            <Divider sx={{my: 2}}/>

            <Typography variant="subtitle2" sx={{color: 'text.secondary', mb: 1}}>캔들</Typography>
            <FormGroup>
                <FormControlLabel
                    label="보합 캔들을 전일 종가 기준으로 색칠"
                    control={
                        <Switch
                            checked={flatByPrevClose}
                            onChange={(_event, checked) => onFlatByPrevCloseChange(checked)}
                        />
                    }
                />
            </FormGroup>
            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                시가와 종가가 같은 날에만 적용됩니다.
                끄면 트레이딩뷰 방식(상승색), 켜면 국내 HTS 방식(전일 종가보다 오르면 상승색, 내리면 하락색)입니다.
            </Typography>

            <Divider sx={{my: 2}}/>

            <Typography variant="subtitle2" sx={{color: 'text.secondary', mb: 1}}>그리기</Typography>
            <FormGroup>
                <FormControlLabel
                    label="그리기 도구 모음 표시"
                    control={
                        <Switch
                            checked={drawingToolbar}
                            onChange={(_event, checked) => onDrawingToolbarChange(checked)}
                        />
                    }
                />
            </FormGroup>
            {drawingCount > 0 ? (
                <Stack direction="row" spacing={1} sx={{mt: 1, flexWrap: 'wrap', rowGap: 1}}>
                    <Button variant="outlined" color="error" size="small" onClick={onClearDrawings}>
                        그린 선 모두 삭제 ({drawingCount}개)
                    </Button>
                    {/* 숨긴 선은 차트에서 고를 수 없으므로 여기서 한꺼번에 다시 보이게 한다. */}
                    {hiddenDrawingCount > 0 && (
                        <Button variant="outlined" size="small" onClick={onShowDrawings}>
                            숨긴 선 모두 보이기 ({hiddenDrawingCount}개)
                        </Button>
                    )}
                </Stack>
            ) : (
                <Typography variant="body2" sx={{color: 'text.secondary', mt: 1}}>그린 선이 없습니다.</Typography>
            )}
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>닫기</Button>
        </DialogActions>
    </Dialog>
);

export default ChartSettingsDialog;
