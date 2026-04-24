import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import SyncProblemIcon from "@mui/icons-material/SyncProblem";

interface FreshnessIndicatorProps {
    lastUpdated: Date | null;
    error?: boolean;
}

export default function FreshnessIndicator({lastUpdated, error}: FreshnessIndicatorProps) {
    if (!lastUpdated) return null;

    const timeStr = lastUpdated.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'});

    return (
        <Stack direction="row" spacing={0.5} sx={{alignItems: 'center'}}>
            <Typography variant="caption" color="text.secondary">
                {timeStr} 기준
            </Typography>
            {error && (
                <Tooltip title="연결이 불안정합니다. 최신 데이터가 아닐 수 있습니다.">
                    <SyncProblemIcon sx={{fontSize: 16, color: 'error.main'}}/>
                </Tooltip>
            )}
        </Stack>
    );
}
