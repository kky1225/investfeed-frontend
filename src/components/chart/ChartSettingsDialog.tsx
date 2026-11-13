import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

export interface ChartSettingOption {
    key: string,
    label: string,
}

interface ChartSettingsDialogProps {
    open: boolean,
    onClose: () => void,
    indicatorOptions: ChartSettingOption[],     // 켜고 끌 수 있는 지표
    layoutOptions: ChartSettingOption[],        // 켜고 끌 수 있는 화면 요소 (그리기 도구 모음 등)
    hidden: string[],                           // 꺼 둔 항목의 key
    onToggle: (key: string, visible: boolean) => void,
    flatByPrevClose: boolean,                   // 시가와 종가가 같은 캔들을 전일 종가 기준으로 색칠할지
    onFlatByPrevCloseChange: (enabled: boolean) => void,
    drawingCount: number,                       // 그려 둔 선의 수
    onClearDrawings: () => void,
}

/** 차트 설정 창. 바꾸는 즉시 차트에 반영된다. */
const ChartSettingsDialog = ({
    open, onClose, indicatorOptions, layoutOptions, hidden, onToggle,
    flatByPrevClose, onFlatByPrevCloseChange, drawingCount, onClearDrawings,
}: ChartSettingsDialogProps) => {
    const renderSwitches = (options: ChartSettingOption[]) => (
        <FormGroup>
            {options.map(option => (
                <FormControlLabel
                    key={option.key}
                    label={option.label}
                    control={
                        <Switch
                            checked={!hidden.includes(option.key)}
                            onChange={(_event, checked) => onToggle(option.key, checked)}
                        />
                    }
                />
            ))}
        </FormGroup>
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>차트 설정</DialogTitle>
            <DialogContent>
                <Typography variant="subtitle2" sx={{color: 'text.secondary', mb: 1}}>지표</Typography>
                {renderSwitches(indicatorOptions)}

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
                {renderSwitches(layoutOptions)}
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
};

export default ChartSettingsDialog;
