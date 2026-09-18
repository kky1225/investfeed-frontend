import {useEffect, useState} from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import Chip from '@mui/material/Chip';
import dayjs from 'dayjs';
import type {Section, TimelineMessage} from '../../type/AssistantType';
import MarkdownBlock from './MarkdownBlock';
import SummaryTiles from './SummaryTiles';
import AccountSummary from './AccountSummary';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const asOfLabel = (iso: string) => { const d = dayjs(iso); return `${d.format('M/D')}(${WEEKDAY[d.day()]}) ${d.format('HH:mm')} 기준`; };

const SUBTYPE_LABEL: Record<string, string> = {
    US_CLOSE: '미국 장 마감',
    KR_PRE: '국내 장 전',
    KR_CLOSE: '국내 장 마감',
    KR_ACCOUNT: '국내 계좌 마감',
    COIN_DAILY: '코인 마감',
    INDEX_WARN: '지수 경고',
    INDEX_CB: '서킷브레이커',
    RELEASE: '지표 발표',
};

/**
 * 알림 종류별 아이콘. 헤드라인 문자열에는 이모지를 넣지 않고 화면이 색과 함께 그린다 (2026-09-17).
 * 이모지는 색을 폰트가 정해 통제가 안 되고, 색 문법은 상승 빨강·하락 파랑뿐이라 경고색이 없다.
 */
const ALERT_ICON: Record<string, { Icon: typeof WarningAmberIcon; color: 'warning' | 'error' | 'info' }> = {
    INDEX_WARN: {Icon: WarningAmberIcon, color: 'warning'},
    INDEX_CB: {Icon: ReportProblemIcon, color: 'error'},
    RELEASE: {Icon: CampaignOutlinedIcon, color: 'info'},
};

/**
 * 평면 섹션: 얇은 구분선 + 작은 회색 제목. 개인 파트만 접을 수 있다.
 * LOCKED(2차 인증 전 껍데기)는 접힌 채로 보이고, 펼침 버튼이 2차 인증을 요청한다. 인증되어 본문이 오면 자동으로 펼친다
 */
function SectionView({section, onUnlock}: { section: Section; onUnlock?: () => void }) {
    const locked = section.status === 'LOCKED';
    const [open, setOpen] = useState(!locked);
    useEffect(() => { if (!locked) setOpen(true); }, [locked]);
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

export default function AssistantMessageView({message, onUnlock}: { message: TimelineMessage; onUnlock?: () => void }) {
    const {body} = message;
    const label = body.subtype ? SUBTYPE_LABEL[body.subtype] ?? body.subtype : body.type;
    const isBriefing = body.type === 'BRIEFING' || body.type === 'ALERT';
    const alertIcon = body.subtype ? ALERT_ICON[body.subtype] : undefined;
    return (
        <Paper variant="outlined" sx={{px: 2.25, py: 1.75, borderRadius: 3, bgcolor: 'background.default'}}>
            <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={label} color={isBriefing ? 'primary' : 'default'} variant="outlined" sx={{height: 22}}/>
                {body.asOf && (
                    <Typography variant="caption" color="text.secondary">
                        {asOfLabel(body.asOf)}
                    </Typography>
                )}
            </Stack>
            <Stack direction="row" alignItems="flex-start" spacing={0.75} sx={{mt: 1}}>
                {alertIcon && <alertIcon.Icon color={alertIcon.color} sx={{fontSize: 21, mt: '2px', flexShrink: 0}}/>}
                <Typography sx={{fontSize: 17, fontWeight: 600, lineHeight: 1.4}}>
                    {body.headline.text}
                </Typography>
            </Stack>
            {body.summary && <SummaryTiles summary={body.summary}/>}
            {body.sections.length > 0 && (
                <Box sx={{mt: 0.5}}>
                    {body.sections.map((s) => <SectionView key={s.id} section={s} onUnlock={onUnlock}/>)}
                </Box>
            )}
        </Paper>
    );
}
