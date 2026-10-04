import {useEffect, useRef, useState} from 'react';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import dayjs from 'dayjs';
import type {Section} from '../../type/AssistantType';
import MarkdownBlock from './MarkdownBlock';
import SummaryTiles from './SummaryTiles';
import AccountSummary from './AccountSummary';

/**
 * 평면 섹션: 얇은 구분선 + 작은 회색 제목. 개인 파트만 접을 수 있다.
 * LOCKED(2차 인증 전 껍데기)는 접힌 채로 보이고, 펼침 버튼이 2차 인증을 요청한다. 인증되어 본문이 오면 자동으로 펼친다
 */
export default function SectionView({section, onUnlock, autoOpen = true}: { section: Section; onUnlock?: () => void; autoOpen?: boolean }) {
    const locked = section.status === 'LOCKED';
    // 처음: 잠겨 있으면 닫힘, 열려 있으면 autoOpen(비서를 열 때 이미 있던 개인 내용은 접힌 채)
    const [open, setOpen] = useState(!locked && autoOpen);
    // 잠금이 풀리는 순간: "보기"를 누른 메시지만 펼치고 나머지는 접힌 채 (2026-10-01)
    const prevLocked = useRef(locked);
    useEffect(() => {
        if (prevLocked.current && !locked) setOpen(autoOpen);
        prevLocked.current = locked;
    }, [locked, autoOpen]);
    const failed = section.status === 'FAILED';
    const empty = section.status === 'EMPTY';
    const body = (
        <Box sx={{pt: 0.5}}>
            {failed && <Typography variant="body2" color="text.secondary">데이터 없음 (조회 실패)</Typography>}
            {empty && <Typography variant="body2" color="text.secondary">데이터 없음</Typography>}
            {!failed && !empty && section.summary && <Box sx={{mb: 1}}><SummaryTiles summary={section.summary}/></Box>}
            {!failed && !empty && section.account && <AccountSummary account={section.account}/>}
            {!failed && !empty && <MarkdownBlock text={section.text}/>}
            {section.asOf && (
                <Typography variant="caption" color="text.disabled" display="block" sx={{mt: 0.5}}>
                    {dayjs(section.asOf).format('HH:mm')} 기준
                </Typography>
            )}
        </Box>
    );
    return (
        <Box sx={{borderTop: '1px solid', borderColor: 'divider', pt: 1.25, mt: 1.5}}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
                <Typography variant="caption" sx={{color: 'text.secondary', fontWeight: 600, letterSpacing: 0.2}}>{section.title}</Typography>
                {section.personal && <LockOutlinedIcon sx={{fontSize: 13, color: 'text.disabled'}}/>}
                {failed && <WarningAmberIcon color="warning" sx={{fontSize: 15}}/>}
                {section.personal && (
                    <IconButton
                        size="small"
                        onClick={() => (locked ? onUnlock?.() : setOpen((v) => !v))}
                        sx={{ml: 'auto', p: 0.25}}
                        aria-label={locked ? '2차 인증 후 보기' : open ? '접기' : '펼치기'}
                    >
                        {open && !locked ? <ExpandLessIcon fontSize="small"/> : <ExpandMoreIcon fontSize="small"/>}
                    </IconButton>
                )}
            </Stack>
            {section.personal ? <Collapse in={open && !locked}>{body}</Collapse> : body}
        </Box>
    );
}

