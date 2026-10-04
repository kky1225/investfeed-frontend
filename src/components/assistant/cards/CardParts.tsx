import {createContext, useContext, useState, type ReactNode} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import dayjs from 'dayjs';
import {TREND_COLORS, renderChip, renderTradeColor} from '../../CustomRender';

/**
 * 개인 카드의 처음 펼침 상태. 잠금이 풀리며 새로 그려지는 이전 카드는 "보기"를 누른 메시지만 펼친다 (2026-10-01).
 * 처음부터 잠금 없이 그려지는 카드(새 답변 등)는 기본값 true
 */
export const PersonalOpenContext = createContext(true);

/**
 * 카드 공통 틀 (브리핑 카드와 같은 모양): 제목 · 본문 · "HH:mm 기준 · 출처" · 원본 화면 링크.
 * personal: 2차 인증 후 보이는 개인 카드 — 제목 옆 자물쇠 + 접기/펼치기 (브리핑 개인 섹션과 같은 동작, 2026-10-01)
 */
export function CardFrame({title, asOf, source, link, linkLabel = '화면에서 보기', personal = false, children}: {
    title: ReactNode;
    asOf?: string | null;
    source?: string | null;
    link?: string | null;
    linkLabel?: string;
    personal?: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(useContext(PersonalOpenContext));
    const body = (
        <>
            <Box sx={{mt: 1}}>{children}</Box>
            {(asOf || source || link) && (
                <Stack direction="row" alignItems="center" spacing={1} sx={{mt: 0.75}}>
                    <Typography variant="caption" color="text.disabled" sx={{flexGrow: 1}}>
                        {[asOf ? `${dayjs(asOf).format('HH:mm')} 기준` : null, source].filter(Boolean).join(' · ')}
                    </Typography>
                    {link && <Link component={RouterLink} to={link} variant="caption">{linkLabel}</Link>}
                </Stack>
            )}
        </>
    );
    return (
        <Paper variant="outlined" sx={{px: 2.25, py: 1.75, borderRadius: 3, bgcolor: 'background.default'}}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
                <Typography component="div" sx={{fontSize: 15, fontWeight: 600, flexGrow: personal ? 0 : 1}}>{title}</Typography>
                {personal && (
                    <>
                        <LockOutlinedIcon sx={{fontSize: 13, color: 'text.disabled', flexGrow: 0}}/>
                        <Box sx={{flexGrow: 1}}/>
                        <IconButton size="small" onClick={() => setOpen((v) => !v)} sx={{p: 0.25}} aria-label={open ? '접기' : '펼치기'}>
                            {open ? <ExpandLessIcon fontSize="small"/> : <ExpandMoreIcon fontSize="small"/>}
                        </IconButton>
                    </>
                )}
            </Stack>
            {personal ? <Collapse in={open}>{body}</Collapse> : body}
        </Paper>
    );
}

export const fmt = (v: number | null | undefined, digits = 0) =>
    v === null || v === undefined || isNaN(v) ? '-' : v.toLocaleString('ko-KR', {maximumFractionDigits: digits, minimumFractionDigits: digits});

/** 가격 표기: 원화 정수, 달러 소수 2자리 */
export const price = (v: number | null | undefined, currency: string) =>
    v === null || v === undefined ? '-' : currency === 'USD' ? `$${fmt(v, 2)}` : `${fmt(v)}원`;

/** 등락률 칩 (보유 화면과 같은 renderChip). 소수 2자리로 맞춘다 */
export const rateChip = (v: number | null | undefined) => renderChip(v === null || v === undefined ? (null as unknown as number) : Number(v.toFixed(2)));

/** 금액 색 (renderTradeColor) */
export const amount = (v: number | null | undefined, currency: string = 'KRW') =>
    v === null || v === undefined ? '-' : renderTradeColor(v, currency === 'USD' ? 'USD' : 'KRW');

/** 억원 단위 수급 금액. 색은 상승 빨강·하락 파랑 */
export function Eok({value}: { value: number | null | undefined }) {
    if (value === null || value === undefined) return <>-</>;
    const color = value > 0 ? TREND_COLORS.up : value < 0 ? TREND_COLORS.down : undefined;
    return <span style={{color}}>{`${value > 0 ? '+' : ''}${value.toLocaleString()}억`}</span>;
}

/** "+0.53%" 같은 부호 문자열 색 (네이버 지표) */
export function SignedText({text}: { text: string }) {
    const color = text.startsWith('+') ? TREND_COLORS.up : text.startsWith('-') ? TREND_COLORS.down : undefined;
    return <span style={{color}}>{text}</span>;
}

export function MiniTable({head, rows}: { head: ReactNode[]; rows: ReactNode[][] }) {
    return (
        <Box sx={{overflowX: 'auto'}}>
            {/* 첫 열(종목명) 고정: 컬럼이 많아 좌우로 밀어도 종목명이 보이게 */}
            <Table size="small" sx={{
                '& td, & th': {px: 1, py: 0.5, whiteSpace: 'nowrap'},
                '& td:first-of-type, & th:first-of-type': {position: 'sticky', left: 0, zIndex: 1, bgcolor: 'background.default'},
            }}>
                <TableHead>
                    <TableRow>{head.map((h, i) => <TableCell key={i} align={i === 0 ? 'left' : 'right'} sx={{color: 'text.secondary', fontSize: 12}}>{h}</TableCell>)}</TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((r, ri) => (
                        <TableRow key={ri}>{r.map((c, ci) => <TableCell key={ci} align={ci === 0 ? 'left' : 'right'}>{c}</TableCell>)}</TableRow>
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
}

/** 라벨-값 한 줄 목록 */
export function Stat({label, children}: { label: string; children: ReactNode }) {
    return (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{py: 0.25}}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Box sx={{fontSize: 14}}>{children}</Box>
        </Stack>
    );
}

export const INVESTOR_LABEL: Record<string, string> = {FOREIGN: '외국인', INSTITUTION: '기관', PENSION: '연기금', INDIVIDUAL: '개인'};
export const ASSET_CLASS_LABEL: Record<string, string> = {KR: '국내주식', US: '미국주식', CRYPTO: '코인'};
