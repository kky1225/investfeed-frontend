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
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

/** 지표의 설정값 하나 (기간 등) */
export interface ChartIndicatorParam {
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,   // 1 이면 정수만 받는다
}

/** 설정 창의 지표 한 줄 */
export interface ChartIndicatorOption {
    key: string,
    label: string,
    on: boolean,
    params: ChartIndicatorParam[],
    customized: boolean,    // 설정값을 기본값에서 바꿔 둔 상태인지
}

interface ChartSettingsDialogProps {
    open: boolean,
    onClose: () => void,
    indicatorOptions: ChartIndicatorOption[],
    onToggleIndicator: (key: string, on: boolean) => void,
    onParamsChange: (key: string, values: number[]) => void,
    onParamsReset: (key: string) => void,
    drawingToolbar: boolean,                    // 그리기 도구 모음을 보일지
    onDrawingToolbarChange: (visible: boolean) => void,
    flatByPrevClose: boolean,                   // 시가와 종가가 같은 캔들을 전일 종가 기준으로 색칠할지
    onFlatByPrevCloseChange: (enabled: boolean) => void,
    drawingCount: number,                       // 그려 둔 선의 수
    onClearDrawings: () => void,
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

/** 차트 설정 창. 바꾸는 즉시 차트에 반영된다. */
const ChartSettingsDialog = ({
    open, onClose, indicatorOptions, onToggleIndicator, onParamsChange, onParamsReset,
    drawingToolbar, onDrawingToolbarChange,
    flatByPrevClose, onFlatByPrevCloseChange, drawingCount, onClearDrawings,
}: ChartSettingsDialogProps) => (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>차트 설정</DialogTitle>
        <DialogContent>
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
                                <Button size="small" onClick={() => onParamsReset(option.key)}>기본값으로</Button>
                            )}
                        </Stack>
                        <Stack direction="row" spacing={1} useFlexGap sx={{flexWrap: 'wrap', mt: 1}}>
                            {option.params.map((param, order) => (
                                <ParamField
                                    // 값이 바깥에서 바뀌면(기본값으로 되돌리기 등) 칸을 새 값으로 다시 만든다.
                                    key={`${order}-${param.value}`}
                                    param={param}
                                    onCommit={value => onParamsChange(
                                        option.key,
                                        option.params.map((item, index) => index === order ? value : item.value),
                                    )}
                                />
                            ))}
                        </Stack>
                    </Box>
                ))}
            </Stack>

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
                <Button variant="outlined" color="error" size="small" onClick={onClearDrawings} sx={{mt: 1}}>
                    그린 선 모두 삭제 ({drawingCount}개)
                </Button>
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
