import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import SyncProblemIcon from "@mui/icons-material/SyncProblem";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

interface FreshnessIndicatorProps {
    lastUpdated: Date | null;
    error?: boolean;
    /** 받아 온 시각 대신 표시할 기준 (하루 한 번 산출하는 데이터의 기준일 등) */
    label?: string;
    /** 데이터가 예정보다 오래됐을 때 경고 아이콘에 띄울 문구 */
    staleMessage?: string;
}

export default function FreshnessIndicator({lastUpdated, error, label, staleMessage}: FreshnessIndicatorProps) {
    if (!lastUpdated) return null;

    const timeStr = label ?? lastUpdated.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'});

    return (
        <Stack direction="row" spacing={0.5} sx={{alignItems: 'center'}}>
            <Typography variant="caption" color="text.secondary">
                {timeStr} 기준
            </Typography>
            {staleMessage && (
                <Tooltip title={staleMessage}>
                    <WarningAmberIcon sx={{fontSize: 16, color: 'warning.main'}}/>
                </Tooltip>
            )}
            {error && (
                <Tooltip title="연결이 불안정합니다. 최신 데이터가 아닐 수 있습니다.">
                    <SyncProblemIcon sx={{fontSize: 16, color: 'error.main'}}/>
                </Tooltip>
            )}
        </Stack>
    );
}
