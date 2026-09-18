import {useState} from 'react';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import type {TimelineMessage} from '../../type/AssistantType';
import AssistantTimeline from './AssistantTimeline';
import AssistantSettings from './AssistantSettings';

interface AssistantPanelProps {
    /** 드로어면 닫기(X), 전체 화면이면 뒤로가기 */
    onClose: () => void;
    variant: 'drawer' | 'page';
}

const NOT_READY_TEXT = '질문 기능은 준비 중입니다. 지금은 브리핑·알림만 제공됩니다.';

/** 드로어와 전체 화면이 공유하는 본체: 헤더 · 타임라인 또는 설정 · 입력창 */
export default function AssistantPanel({onClose, variant}: AssistantPanelProps) {
    const [view, setView] = useState<'timeline' | 'settings'>('timeline');
    const [draft, setDraft] = useState('');
    const [localItems, setLocalItems] = useState<TimelineMessage[]>([]);

    // 1단계: 서버 미호출. 입력 시 로컬 안내 항목만 추가한다 (Q&A 는 5단계)
    const handleSend = () => {
        const text = draft.trim();
        if (!text) return;
        const now = new Date().toISOString();
        const base = -Date.now();
        setLocalItems((prev) => [
            ...prev,
            {id: base, createdAt: now, body: {schemaVersion: 1, type: 'USER', headline: {text, scope: 'MARKET'}, summary: '', sections: [], cards: [], refs: {}}},
            {id: base - 1, createdAt: now, body: {schemaVersion: 1, type: 'SYSTEM', headline: {text: NOT_READY_TEXT, scope: 'MARKET'}, summary: '', sections: [], cards: [], refs: {}}},
        ]);
        setDraft('');
    };

    return (
        <Stack sx={{height: '100%', minHeight: 0}}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider'}}>
                {variant === 'page' && (
                    <IconButton size="small" onClick={onClose} aria-label="뒤로"><ArrowBackIcon fontSize="small"/></IconButton>
                )}
                <SmartToyOutlinedIcon fontSize="small" color="primary"/>
                <Typography variant="subtitle1" sx={{fontWeight: 600, flexGrow: 1}}>
                    {view === 'timeline' ? 'AI 비서' : '비서 설정'}
                </Typography>
                <Tooltip title={view === 'timeline' ? '설정' : '타임라인으로'}>
                    <IconButton size="small" onClick={() => setView((v) => (v === 'timeline' ? 'settings' : 'timeline'))}>
                        {view === 'timeline' ? <SettingsOutlinedIcon fontSize="small"/> : <ArrowBackIcon fontSize="small"/>}
                    </IconButton>
                </Tooltip>
                {variant === 'drawer' && (
                    <IconButton size="small" onClick={onClose} aria-label="닫기"><CloseIcon fontSize="small"/></IconButton>
                )}
            </Stack>

            <Box sx={{flexGrow: 1, overflowY: 'auto', minHeight: 0}}>
                {view === 'timeline' ? <AssistantTimeline localItems={localItems}/> : <AssistantSettings/>}
            </Box>

            {view === 'timeline' && (
                <Stack direction="row" spacing={1} sx={{p: 1.5, borderTop: '1px solid', borderColor: 'divider'}}>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="질문 기능 준비 중"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); } }}
                    />
                    <IconButton color="primary" onClick={handleSend} aria-label="보내기"><SendRoundedIcon/></IconButton>
                </Stack>
            )}
        </Stack>
    );
}
