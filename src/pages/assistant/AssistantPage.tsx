import {useNavigate} from 'react-router-dom';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import AssistantPanel from '../../components/assistant/AssistantPanel';

/** /assistant — 모바일·직접 진입용 전체 화면. MainLayout 밖에 등록된다 */
export default function AssistantPage() {
    const navigate = useNavigate();
    const goBack = () => {
        if (window.history.length > 1) navigate(-1); else navigate('/');
    };
    return (
        <>
            <CssBaseline enableColorScheme/>
            <Box sx={{height: '100dvh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column'}}>
                <Box sx={{width: '100%', maxWidth: 860, mx: 'auto', flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column'}}>
                    <AssistantPanel variant="page" onClose={goBack}/>
                </Box>
            </Box>
        </>
    );
}
