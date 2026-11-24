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
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
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
    hint?: string,  // 칸 아래에 적을 짧은 안내
}

/** 모양(색·굵기·점선)을 바꿀 수 있는 선 하나 */
export interface ChartIndicatorColor {
    label: string,
    value: number,  // 차트의 선 색 목록에서의 순번
    width: number,  // 굵기 단계
    dashed: boolean,
}

/** 차트 아래에 따로 영역을 차지하는 지표 하나 (켜 둔 것). 순서를 바꿀 때 쓴다 */
export interface ChartPaneItem {
    key: string,
    label: string,
}

/** 설정 창의 지표 한 줄 */
export interface ChartIndicatorOption {
    key: string,
    label: string,
    on: boolean,
    below: boolean,         // 차트 아래에 따로 영역을 차지하는 지표인지. 아니면 가격이나 거래량 위에 겹쳐 그린다
    canDuplicate: boolean,// 같은 지표를 하나 더 추가할 수 있는지 (차트 아래에 따로 영역을 차지하는 지표, 둘까지)
    duplicate: boolean,     // 하나 더 추가해 둔 둘째인지. 켜고 끄는 대신 지운다
    params: ChartIndicatorParam[],
    colors: ChartIndicatorColor[],
    // 설정값 하나가 선 하나인 지표(이동평균선 등)면 선을 더하고 뺄 수 있는지. 그런 지표는 params 와 colors 가 같은 순서의 선들이다
    lines: { canAdd: boolean, canRemove: boolean } | null,
    customized: boolean,    // 설정값·선 모양·선 개수를 기본에서 바꿔 둔 상태인지
}

/** 지표에서 바꾼 것. 준 항목만 바뀐다 */
export interface ChartIndicatorChange {
    params?: number[],
    colors?: number[],
    widths?: number[],
    dashes?: boolean[],
}

interface ChartSettingsDialogProps {
    open: boolean,
    onClose: () => void,
    indicatorOptions: ChartIndicatorOption[],
    onToggleIndicator: (key: string, on: boolean) => void,
    onIndicatorDuplicate: (key: string) => void,    // 그 지표를 하나 더 추가한다
    onIndicatorRemove: (key: string) => void,       // 하나 더 추가해 둔 지표를 지운다
    onIndicatorChange: (key: string, change: ChartIndicatorChange) => void,
    onIndicatorReset: (key: string) => void,
    paneItems: ChartPaneItem[],                 // 켜 둔 별도 영역 지표. 차트에 놓인 순서(위에서 아래)
    onPaneMove: (key: string, step: -1 | 1) => void,   // 그 지표의 영역을 한 칸 위(-1)나 아래(1)로 옮긴다
    drawingToolbar: boolean,                   // 그리기 도구 모음을 보일지
    onDrawingToolbarChange: (visible: boolean) => void,
    logScale: boolean,                          // 가격축을 로그로 할지
    onLogScaleChange: (enabled: boolean) => void,
    percentScale: boolean,                      // 가격축에 가격 대신 등락률을 적을지
    onPercentScaleChange: (enabled: boolean) => void,
    flatByPrevClose: boolean,                  // 시가와 종가가 같은 캔들을 전일 종가 기준으로 색칠할지
    onFlatByPrevCloseChange: (enabled: boolean) => void,
    grid: boolean,                              // 격자선을 그을지
    onGridChange: (visible: boolean) => void,
    // 내 매매(매수·매도 지점, 평단가 선) 표시. 내 매매를 보여 줄 수 있는 화면에서만 준다
    // notice: 스위치 아래에 적을 알림 (일부 증권사의 조회 실패 등)
    trades?: { visible: boolean, onChange: (visible: boolean) => void, notice?: string },
    onSaveImage: () => void,                   // 지금 보이는 차트를 이미지 파일로 내려받는다
    comparison?: ChartComparisonFieldProps,     // 종목 비교. 비교를 쓸 수 있는 화면에서만 준다
    fullscreen: boolean,                        // 차트를 화면 가득 띄워 둔 상태인지
    onFullscreenChange: (fullscreen: boolean) => void,
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
            helperText={param.hint}
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

/**
 * 지표 한 줄의 설정값 칸과 선 모양 단추(누르면 색·굵기·점선을 고른다).
 * 선을 더하고 뺄 수 있는 지표는 선마다 "기간 · 모양 · 지우기"를 한 묶음으로 놓는다.
 */
const IndicatorFields = ({option, onChange}: IndicatorFieldsProps) => {
    const values = option.params.map(param => param.value);
    const colors = option.colors.map(color => color.value);
    const widths = option.colors.map(color => color.width);
    const dashes = option.colors.map(color => color.dashed);
    const replaced = <T,>(list: T[], order: number, value: T) => list.map((item, index) => index === order ? value : item);
    const without = <T,>(list: T[], order: number) => list.filter((_item, index) => index !== order);
    const colorPicker = (color: ChartIndicatorColor, order: number) => (
        <ChartColorPicker
            label={`${option.label} ${color.label}`}
            value={color.value}
            onChange={value => onChange({colors: replaced(colors, order, value)})}
            stroke={{
                width: color.width,
                dashed: color.dashed,
                onWidthChange: width => onChange({widths: replaced(widths, order, width)}),
                onDashedChange: dashed => onChange({dashes: replaced(dashes, order, dashed)}),
            }}
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
                                        params: without(values, order),
                                        colors: without(colors, order),
                                        widths: without(widths, order),
                                        dashes: without(dashes, order),
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
                        // 새 선의 기간은 마지막 선의 2배, 색은 다음 순번, 굵기·점선은 마지막 선과 같게
                        onClick={() => onChange({
                            params: [...values, Math.min(last.max, last.value * 2)],
                            colors: [...colors, colors.length],
                            widths: [...widths, widths[widths.length - 1]],
                            dashes: [...dashes, dashes[dashes.length - 1]],
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

// 지표를 그리는 자리에 따라 둘로 묶어 보인다.
const INDICATOR_GROUPS = [
    {below: false, title: '차트 지표', description: '가격이나 거래량 위에 겹쳐 그립니다.'},
    {below: true, title: '하단 지표', description: '차트 아래에 따로 영역을 차지합니다.'},
];

/** 차트 설정 창. 바꾸는 즉시 차트에 반영된다. */
const ChartSettingsDialog = ({
    open, onClose, indicatorOptions, onToggleIndicator, onIndicatorDuplicate, onIndicatorRemove,
    onIndicatorChange, onIndicatorReset, paneItems, onPaneMove,
    drawingToolbar, onDrawingToolbarChange,
    logScale, onLogScaleChange, percentScale, onPercentScaleChange,
    flatByPrevClose, onFlatByPrevCloseChange, grid, onGridChange, trades, onSaveImage,
    comparison, fullscreen, onFullscreenChange,
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
            {INDICATOR_GROUPS
                .map(group => ({...group, options: indicatorOptions.filter(option => option.below === group.below)}))
                .filter(group => group.options.length > 0)
                .map((group, order) => (
                    <Box key={group.title}>
                        {order > 0 && <Divider sx={{my: 2}}/>}
                        <Typography variant="subtitle2" sx={{color: 'text.secondary'}}>{group.title}</Typography>
                        <Typography variant="body2" sx={{color: 'text.secondary', mb: 1}}>{group.description}</Typography>
                        <Stack spacing={1.5}>
                            {group.options.map(option => (
                                <Box key={option.key}>
                                    <Stack direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                                        {option.duplicate ? (
                                            // 하나 더 추가한 지표는 켜고 끄지 않고 지운다. 스위치가 없는 만큼 들여 써서 위 지표에 딸린 것으로 보이게 한다.
                                            <Typography sx={{pl: 6, py: 1}}>{option.label}</Typography>
                                        ) : (
                                            <FormControlLabel
                                                label={option.label}
                                                control={
                                                    <Switch
                                                        checked={option.on}
                                                        onChange={(_event, checked) => onToggleIndicator(option.key, checked)}
                                                    />
                                                }
                                            />
                                        )}
                                        <Stack direction="row">
                                            {option.customized && (
                                                <Button size="small" onClick={() => onIndicatorReset(option.key)}>
                                                    기본값으로
                                                </Button>
                                            )}
                                            {option.canDuplicate && (
                                                <Button
                                                    size="small"
                                                    startIcon={<AddIcon/>}
                                                    onClick={() => onIndicatorDuplicate(option.key)}
                                                >
                                                    하나 더
                                                </Button>
                                            )}
                                            {option.duplicate && (
                                                <Button
                                                    size="small"
                                                    color="error"
                                                    onClick={() => onIndicatorRemove(option.key)}
                                                >
                                                    지우기
                                                </Button>
                                            )}
                                        </Stack>
                                    </Stack>
                                    <Box sx={option.duplicate ? {pl: 6} : undefined}>
                                        <IndicatorFields
                                            option={option}
                                            onChange={change => onIndicatorChange(option.key, change)}
                                        />
                                    </Box>
                                </Box>
                            ))}
                        </Stack>
                    </Box>
                ))}

            {/* 영역이 둘 이상일 때만 순서를 바꿀 것이 있다. */}
            {paneItems.length > 1 && (
                <>
                    <Divider sx={{my: 2}}/>
                    <Typography variant="subtitle2" sx={{color: 'text.secondary', mb: 1}}>지표 영역 순서</Typography>
                    <Typography variant="body2" sx={{color: 'text.secondary', mb: 1}}>
                        차트 아래에 놓이는 순서입니다. 위에 적힌 지표가 차트에서도 위에 놓입니다.
                    </Typography>
                    <Stack>
                        {paneItems.map((item, order) => (
                            <Stack key={item.key} direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                                <Typography variant="body2">{order + 1}. {item.label}</Typography>
                                <Stack direction="row">
                                    <Tooltip title="위로">
                                        {/* 끝에 있는 단추는 누를 수 없지만 말풍선은 뜨도록 한 겹 감싼다. */}
                                        <span>
                                            <IconButton
                                                size="small"
                                                aria-label={`${item.label} 영역을 위로`}
                                                disabled={order === 0}
                                                onClick={() => onPaneMove(item.key, -1)}
                                            >
                                                <ArrowUpwardIcon fontSize="inherit"/>
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title="아래로">
                                        <span>
                                            <IconButton
                                                size="small"
                                                aria-label={`${item.label} 영역을 아래로`}
                                                disabled={order === paneItems.length - 1}
                                                onClick={() => onPaneMove(item.key, 1)}
                                            >
                                                <ArrowDownwardIcon fontSize="inherit"/>
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </Stack>
                        ))}
                    </Stack>
                </>
            )}

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
                오른쪽 가격축을 위아래로 끌면 세로 크기를 바꿀 수 있고, 그 뒤에는 차트를 위아래로도 끌 수 있습니다.
                가격축을 더블클릭하면 원래대로 돌아옵니다.
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

            <Typography variant="subtitle2" sx={{color: 'text.secondary', mb: 1}}>격자</Typography>
            <FormGroup>
                <FormControlLabel
                    label="격자선 표시"
                    control={<Switch checked={grid} onChange={(_event, checked) => onGridChange(checked)}/>}
                />
            </FormGroup>
            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                끄면 가격과 날짜 눈금에서 뻗는 가로·세로 선을 긋지 않습니다. 눈금 글자와 지표의 기준선은 그대로입니다.
            </Typography>

            <Divider sx={{my: 2}}/>

            {trades && (
                <>
                    <Typography variant="subtitle2" sx={{color: 'text.secondary', mb: 1}}>내 매매</Typography>
                    <FormGroup>
                        <FormControlLabel
                            label="내 매매 표시"
                            control={
                                <Switch checked={trades.visible} onChange={(_event, checked) => trades.onChange(checked)}/>
                            }
                        />
                    </FormGroup>
                    <Typography variant="body2" sx={{color: 'text.secondary'}}>
                        켜면 연동한 증권사의 최근 1년 매수·매도를 캔들에 세모로 표시하고, 보유 중이면 평단가에 선을 긋습니다.
                        2차 인증을 한 동안에만 보입니다. 체결 시각을 주지 않는 증권사(키움)의 매매는 일봉 이상에서만 표시됩니다.
                    </Typography>
                    {trades.notice && (
                        <Typography variant="body2" sx={{color: 'warning.main', mt: 1}}>{trades.notice}</Typography>
                    )}

                    <Divider sx={{my: 2}}/>
                </>
            )}

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
            {/* 그린 선의 숨기기·삭제는 도구 줄의 "그린 선 목록" 창에서 한다. */}
        </DialogContent>
        <DialogActions>
            {/* 전체 화면은 차트를 봐야 하므로 누르면 창도 닫는다. */}
            <Button
                onClick={() => {
                    onFullscreenChange(!fullscreen);
                    onClose();
                }}
                sx={{mr: 'auto'}}
            >
                {fullscreen ? '전체 화면 끝내기' : '전체 화면으로 보기'}
            </Button>
            <Button onClick={onSaveImage}>이미지로 저장</Button>
            <Button onClick={onClose}>닫기</Button>
        </DialogActions>
    </Dialog>
);

export default ChartSettingsDialog;
