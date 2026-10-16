import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import ErrorIcon from '@mui/icons-material/Error';

/**
 * 경고 문법 `{!|툴팁 문구}` 의 아이콘. 종목 상세의 투자경고 아이콘(ErrorIcon + Tooltip)과 같은 모양.
 * 툴팁 문구의 줄바꿈은 그대로 보여 준다. 예: 서킷브레이커가 발동한 날 브리핑 지수 표의 지수 이름 옆
 */
export const WARN_TOKEN = /\{!\|([^{}|]+)\}/g;

export default function WarnIcon({title}: { title: string }) {
    return (
        <Tooltip title={<Box sx={{whiteSpace: 'pre-line'}}>{title}</Box>} placement="right">
            <ErrorIcon color="error" sx={{fontSize: 'inherit', verticalAlign: 'middle', ml: '2px', mb: '2px'}}/>
        </Tooltip>
    );
}
