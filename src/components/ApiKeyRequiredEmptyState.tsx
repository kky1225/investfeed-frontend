import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import VpnKeyOffIcon from '@mui/icons-material/VpnKeyOff';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

interface Props {
    /** 안내 문구에 들어갈 broker 이름 (예: "키움증권", "업비트") */
    brokerName: string;
    /** 컨텍스트 문구. 페이지에 따라 "잔고와 보유 종목" / "잔고" 등 구체화 가능. */
    description?: string;
}

/**
 * 본인이 추가한 type='API' broker 의 API Key 가 미등록 또는 만료되었을 때
 * 화면에 빈 값/에러 대신 표시할 안내 카드. 클릭 시 등록 페이지로 이동.
 */
export default function ApiKeyRequiredEmptyState({ brokerName, description }: Props) {
    const navigate = useNavigate();
    const message = description ?? `${brokerName} 계좌의 잔고와 보유 종목을 보려면 API Key 를 등록해주세요.`;

    return (
        <Paper
            variant="outlined"
            sx={{
                width: '100%',
                maxWidth: 560,
                mx: 'auto',
                px: 4,
                py: 6,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                borderRadius: 3,
                gap: 2,
            }}
        >
            <Box
                sx={(theme) => ({
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.warning.main, 0.12),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                })}
            >
                <VpnKeyOffIcon sx={{ color: 'warning.main', fontSize: 32 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {brokerName} API Key 등록이 필요합니다
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {message}
            </Typography>
            <Button
                variant="contained"
                onClick={() => navigate('/settings/api-keys')}
                sx={{ mt: 1 }}
            >
                API Key 등록하기
            </Button>
        </Paper>
    );
}
