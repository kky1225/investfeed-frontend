import {Link as RouterLink} from 'react-router-dom';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import {renderChangeAmount, signedRate} from '../../CustomRender';
import MarkdownBlock from '../MarkdownBlock';
import SummaryTiles from '../SummaryTiles';
import SectionView from '../SectionView';
import AssistantBubble from '../AssistantBubble';
import {streakText} from './cardText';
import dayjs from 'dayjs';
import type {
    BriefingPointerPayload, CalendarItemPayload, GlobalIndexPayload, MarketInvestorFlowPayload, MarketSummaryPayload,
    HoldingAlertPayload, NewsRowPayload, RecommendListPayload, StockChoicePayload, StockInvestorFlowPayload, StockQuotePayload, ChatPick, MarketBriefPayload} from '../../../type/AssistantType';
import {CardFrame, Eok, INVESTOR_LABEL, MiniTable, SignedText, Stat, amount, fmt, price, rateChip} from './CardParts';

interface Meta { asOf?: string | null; source?: string | null; }

/** 보유 종목 급등락 알림 한 종목: 종목 시세 카드 상단과 같은 모양 — 종목명(링크) · 알림 시점 가격 크게 · "+5% 도달" 칩 */
export function HoldingAlertQuote({p}: { p: HoldingAlertPayload }) {
    const usd = p.currency === 'USD';
    return (
        <Box>
            <Link component={RouterLink} to={p.link} underline="hover" color="inherit" sx={{fontSize: 15, fontWeight: 600}}>{p.name}</Link>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{mt: 0.5}}>
                {p.price !== null && <Typography variant="h5" component="p">{usd ? `$${fmt(p.price, 2)}` : fmt(p.price)}</Typography>}
                <Chip size="small" color={p.up ? 'error' : 'info'} label={p.label}/>
            </Stack>
        </Box>
    );
}

/** 시장 카드: 브리핑 카드와 같은 부품 — 지수 타일(SummaryTiles) + 섹션(SectionView). 내용은 서버 브리핑 렌더러가 만든다 (2026-10-01) */
export function MarketBriefCard({p, meta}: { p: MarketBriefPayload; meta: Meta }) {
    return (
        <CardFrame title={p.title} asOf={p.asOf} source={meta.source}>
            {p.summary && <SummaryTiles summary={p.summary}/>}
            {p.sections.map((s) => <SectionView key={s.id} section={s}/>)}
        </CardFrame>
    );
}

/** 이전 형식 (예전 답변) */
export function MarketSummaryCard({p, meta}: { p: MarketSummaryPayload; meta: Meta }) {
    const idx = [p.index, p.secondary].filter((x): x is NonNullable<typeof x> => !!x);
    return (
        <CardFrame title={`시장 요약 · ${p.tradingDay}`} {...meta} link="/stock/index/list">
            {idx.map((i) => (
                <Stack key={i.name} direction="row" alignItems="center" spacing={1} sx={{py: 0.25}}>
                    <Typography variant="body2" sx={{fontWeight: 600, flexGrow: 1}}>{i.name}</Typography>
                    <Typography variant="body2">{fmt(i.close, 2)}</Typography>
                    {amount(i.changeAmount)}
                    {rateChip(i.changeRate)}
                </Stack>
            ))}
            {p.flow && (
                <Box sx={{mt: 0.75}}>
                    <Stat label="외국인"><Eok value={p.flow.foreignEok}/></Stat>
                    <Stat label="기관"><Eok value={p.flow.institutionEok}/></Stat>
                    <Stat label="개인"><Eok value={p.flow.individualEok}/></Stat>
                </Box>
            )}
        </CardFrame>
    );
}

export function MarketFlowCard({p, meta}: { p: MarketInvestorFlowPayload; meta: Meta }) {
    const title = `${INVESTOR_LABEL[p.investor] ?? p.investor} ${p.days}일 ${p.side === 'BUY' ? '순매수' : '순매도'} 상위 · ${p.market}`
        + (p.minStreakDays ? ` · ${p.minStreakDays}일 이상 연속` : '');
    return (
        <CardFrame title={title} {...meta}>
            {p.stocks.length === 0
                ? <Typography variant="body2" color="text.secondary">해당 종목이 없습니다</Typography>
                : <MiniTable
                    // 투자자별 매매 화면(InvestorList)과 같은 순서: 종목명 · 등락률 · 순매수 (연속은 끝에)
                    head={['종목명', '등락률', '순매수', '연속']}
                    rows={p.stocks.map((s) => [
                        <Link component={RouterLink} to={`/stock/detail/${s.code}`} underline="hover">{s.name}</Link>,
                        rateChip(s.periodChangeRate),
                        <Eok value={s.netAmountEok}/>,
                        s.streakDays ? `${s.streakDays}일` : '-',
                    ])}
                />}
        </CardFrame>
    );
}

/** 종목 상세 페이지 상단과 같은 모양: 큰 현재가 + 등락 금액(renderChangeAmount) + 등락률 칩 */
function QuoteHeader({q}: { q: StockQuotePayload }) {
    const usd = q.currency === 'USD';
    const rate = q.changeRate === null ? null : Number(q.changeRate.toFixed(2));
    const chipColor = rate === null || rate === 0 ? 'default' : rate > 0 ? 'error' : 'info';
    const sub = (label: string, v: string) => (
        <Typography component="span" variant="caption" color="text.secondary" sx={{mr: 1.5, whiteSpace: 'nowrap'}}>{label} {v}</Typography>
    );
    return (
        <Box>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Typography variant="h5" component="p">{usd ? `$${fmt(q.price, 2)}` : fmt(q.price, q.market === 'CRYPTO' && q.price < 100 ? 4 : 0)}</Typography>
                {q.changeAmount !== null && renderChangeAmount(q.changeAmount, usd ? '달러' : '원')}
                <Chip size="small" color={chipColor} label={signedRate(rate)}/>
            </Stack>
            <Box sx={{mt: 0.75}}>
                {sub('고가', price(q.high, q.currency))}
                {sub('저가', price(q.low, q.currency))}
                {sub('거래량', fmt(q.volume, q.market === 'CRYPTO' ? 4 : 0))}
            </Box>
            <Box>{sub('52주', `${price(q.low52w, q.currency)} ~ ${price(q.high52w, q.currency)}`)}</Box>
        </Box>
    );
}

/** 종목 1~3개. 1개면 종목명이 제목, 여러 개면 종목별 블록을 쌓는다 (비교) */
export function StockQuoteCard({p, meta}: { p: StockQuotePayload[]; meta: Meta }) {
    const nameLink = (q: StockQuotePayload) => <Link component={RouterLink} to={q.link} underline="hover" color="inherit">{q.name}</Link>;
    if (p.length === 1) {
        return <CardFrame title={nameLink(p[0])} {...meta}><QuoteHeader q={p[0]}/></CardFrame>;
    }
    return (
        <CardFrame title="종목 비교" {...meta}>
            <Stack divider={<Divider/>} spacing={1.25}>
                {p.map((q) => (
                    <Box key={q.code}>
                        <Typography sx={{fontWeight: 600, mb: 0.5}}>{nameLink(q)}</Typography>
                        <QuoteHeader q={q}/>
                    </Box>
                ))}
            </Stack>
        </CardFrame>
    );
}

/** 키움 일자 20261001 → 2026-10-01 (이미 하이픈 형식이면 그대로) */
const isoDate = (d: string) => (/^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d);

/** 종목마다 "연속 순매수·순매도 말풍선 → 수급 카드" 순서로 (채팅처럼, 2026-10-01) */
export function StockFlowCard({p, meta}: { p: StockInvestorFlowPayload[]; meta: Meta }) {
    return (
        <Stack spacing={1}>
            {p.map((f) => (
                <Stack key={f.code} spacing={1}>
                    {streakText(f) && <AssistantBubble text={streakText(f)!}/>}
                    <CardFrame title={`${f.name} 투자자 수급`} {...meta} link={f.link} linkLabel="종목 상세">
                        <MiniTable
                            // 종목 상세 투자자 탭과 같은 순서: 날짜 · 개인 · 외국인 · 기관
                            head={['날짜', '개인', '외국인', '기관']}
                            rows={f.days.map((d) => [
                                isoDate(d.date),
                                <Eok value={d.individualEok}/>,
                                <Eok value={d.foreignEok}/>,
                                <Eok value={d.institutionEok}/>,
                            ])}
                        />
                    </CardFrame>
                </Stack>
            ))}
        </Stack>
    );
}

export function GlobalIndexCard({p, meta}: { p: GlobalIndexPayload[]; meta: Meta }) {
    return (
        <CardFrame title="해외 지수 · 금리 · 환율" {...meta}>
            <MiniTable
                head={['지표', '값', '등락', '등락률']}
                rows={p.map((i) => [i.name, i.price, <SignedText text={i.changeAmount}/>, <SignedText text={i.changeRate}/>])}
            />
        </CardFrame>
    );
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const FLAG: Record<string, string> = {KR: '🇰🇷', US: '🇺🇸'};

/**
 * 일정: 캘린더 화면(EconomicCalendarPage)의 표기 규칙을 따른 날짜 목록 (2026-10-01).
 * 월 격자는 비서 창에서 너무 커서 목록으로 두고, 국기·라벨 모양만 캘린더와 맞춘다.
 * 글자는 전부 검정 — 나라가 섞이는 목록에서 휴일 빨강은 "어느 나라 휴일인지" 오해를 불러 뺐다. 휴장은 "🇺🇸 휴장 · 추수감사절" 글로,
 * 지표는 작은 라벨(미래 일정 노란 바탕), 오늘은 굵게
 */
const MARKET_NAME: Record<string, string> = {KR: '국내 증시', US: '미국 증시'};

/** "미국 증시 휴장 (추수감사절)" → "휴장 · 추수감사절", "개천절" → "휴장 · 개천절". 어느 나라가 쉬는지는 앞의 국기로 */
const holidayLabel = (name: string) => {
    const m = name.match(/^미국 증시 (휴장|조기폐장) \((.+)\)$/);
    return m ? `${m[1]} · ${m[2]}` : `휴장 · ${name}`;
};

export function CalendarCard({p, meta, args}: { p: CalendarItemPayload[]; meta: Meta; args?: Record<string, unknown> | null }) {
    const today = dayjs().format('YYYY-MM-DD');
    const dates = [...new Set(p.map((e) => e.date))];
    // 휴장일 조회면 조회한 나라 중 결과가 없는 나라를 "휴장일 없음"으로 밝힌다 (조건은 카드에 저장된 도구 인자. 예전 답변엔 없음)
    const holidayQuery = args?.type === 'HOLIDAY';
    const queried = typeof args?.country === 'string' ? [args.country] : ['KR', 'US'];
    const noHoliday = holidayQuery ? queried.filter((c) => !p.some((e) => e.country === c && e.type === 'HOLIDAY')) : [];
    return (
        <CardFrame title="일정" {...meta} link="/calendar" linkLabel="캘린더">
            {p.length === 0 && !holidayQuery && <Typography variant="body2" color="text.secondary">해당 기간에 일정이 없습니다</Typography>}
            <Stack spacing={1}>
                {dates.map((date) => {
                    const events = p.filter((e) => e.date === date);
                    const d = dayjs(date);
                    const isToday = date === today;
                    return (
                        <Stack key={date} direction="row" spacing={1.5} alignItems="flex-start">
                            <Typography variant="body2" sx={{
                                minWidth: 76, flexShrink: 0, fontWeight: isToday ? 700 : 500,
                            }}>
                                {`${d.format('M/D')} (${WEEKDAY[d.day()]})`}
                            </Typography>
                            <Stack spacing={0.5} sx={{minWidth: 0}}>
                                {events.map((e, i) => e.type === 'HOLIDAY'
                                    ? <Typography key={i} variant="body2">{FLAG[e.country] ?? e.country} {holidayLabel(e.name)}</Typography>
                                    : (
                                        <Box key={i} sx={{
                                            px: 0.75, py: 0.25, borderRadius: 0.5, fontSize: 13, alignSelf: 'flex-start',
                                            bgcolor: date > today ? 'warning.light' : 'action.hover',
                                            color: 'text.primary',
                                        }}>
                                            {FLAG[e.country] ?? e.country} {e.name}{e.value ? ` ${e.value}` : ''}
                                        </Box>
                                    ))}
                            </Stack>
                        </Stack>
                    );
                })}
            </Stack>
            {noHoliday.length > 0 && (
                // 표의 한 줄이 아니라 안내 문구로 (국기 없이 작은 회색 글씨, 2026-10-01)
                <Typography variant="caption" color="text.secondary" display="block" sx={{mt: p.length > 0 ? 1.25 : 0}}>
                    {noHoliday.length === 2
                        ? '이 기간에는 국내·미국 증시 모두 휴장일이 없습니다.'
                        : `이 기간에는 ${MARKET_NAME[noHoliday[0]] ?? noHoliday[0]} 휴장일이 없습니다.`}
                </Typography>
            )}
        </CardFrame>
    );
}

const GRADE_ORDER = ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'];

/**
 * 추천 종목: 브리핑 "오늘 추천" 섹션과 같은 표·색 (등급 · 종목 수 · 종목, 매수 쪽 빨강·매도 쪽 파랑 — 서버 coloredGrade 와 같은 색 문법).
 * 같은 MarkdownBlock 으로 그린다 (2026-10-01)
 */
export function RecommendCard({p, meta}: { p: RecommendListPayload; meta: Meta }) {
    const grades = GRADE_ORDER.filter((g) => p.items.some((i) => i.grade === g));
    const colored = (g: string) => (g === 'STRONG_BUY' || g === 'BUY' ? `{${g}|up}` : g === 'SELL' || g === 'STRONG_SELL' ? `{${g}|down}` : g);
    const table = ['| 등급 | 종목 수 | 종목 |', '|:---|---:|:---|', ...grades.map((g) => {
        const names = p.items.filter((i) => i.grade === g).map((i) => i.name);
        return `| ${colored(g)} | ${names.length} | ${names.join(', ')} |`;
    })].join('\n');
    return (
        <CardFrame title={`추천 종목${p.pickDate ? ` (${dayjs(p.pickDate).format('M/D')} 기준)` : ''}`} {...meta} link="/stock/recommend/list" linkLabel="추천 화면">
            {p.items.length === 0
                ? <Typography variant="body2" color="text.secondary">해당 종목이 없습니다</Typography>
                : <MarkdownBlock text={table}/>}
        </CardFrame>
    );
}

export function NewsCard({p, meta}: { p: NewsRowPayload[]; meta: Meta }) {
    return (
        <CardFrame title="뉴스" {...meta}>
            {p.length === 0 && <Typography variant="body2" color="text.secondary">검색된 뉴스가 없습니다</Typography>}
            {/* 종목 상세 뉴스 탭과 같은 줄 모양: 굵은 제목 · 날짜, 줄 구분선, 줄 전체 클릭 (요약은 넣지 않음) */}
            <Box>
                {p.map((n) => (
                    <Box key={n.link} onClick={() => window.open(n.link, '_blank', 'noopener,noreferrer')}
                         sx={{py: 1.25, borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer', '&:hover': {bgcolor: 'action.hover'}, '&:last-of-type': {borderBottom: 'none'}}}>
                        <Typography variant="body2" sx={{fontWeight: 600, mb: 0.5}}>{n.title}</Typography>
                        <Typography variant="caption" color="text.disabled" sx={{display: 'block'}}>{n.pubDate}</Typography>
                    </Box>
                ))}
            </Box>
        </CardFrame>
    );
}

/** 타임라인의 브리핑 메시지로 스크롤. 아직 안 불러온 메시지면 안내만 */
export function BriefingLinkCard({p, meta}: { p: BriefingPointerPayload; meta: Meta }) {
    const go = () => document.getElementById(`assistant-msg-${p.messageId}`)?.scrollIntoView({block: 'start', behavior: 'smooth'});
    const loaded = typeof document !== 'undefined' && !!document.getElementById(`assistant-msg-${p.messageId}`);
    return (
        <CardFrame personal title={`브리핑 · ${dayjs(p.createdAt).format('M/D HH:mm')}`} {...meta}>
            <Typography variant="body2" sx={{mb: 0.75}}>{p.headline}</Typography>
            {loaded
                ? <Button size="small" variant="outlined" onClick={go}>브리핑으로 이동</Button>
                : <Typography variant="caption" color="text.secondary">위의 &quot;이전 메시지 더 보기&quot;로 해당 날짜까지 불러와 확인해 주세요.</Typography>}
        </CardFrame>
    );
}

export function StockChoiceCard({p, onPick}: { p: StockChoicePayload; onPick?: (pick: ChatPick) => void }) {
    const MARKET: Record<string, string> = {KR: '국내', US: '미국', CRYPTO: '코인'};
    return (
        <CardFrame title="어떤 종목인가요?">
            <Typography variant="caption" color="text.secondary" display="block" sx={{mb: 0.75}}>&quot;{p.query}&quot; 검색 결과</Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {p.candidates.map((c) => (
                    <Button key={`${c.market}-${c.code}`} size="small" variant="outlined"
                            onClick={() => onPick?.({code: c.code, market: c.market, name: c.name})}>
                        {c.name} <Typography component="span" variant="caption" color="text.secondary" sx={{ml: 0.5}}>{MARKET[c.market]} {c.code}</Typography>
                    </Button>
                ))}
            </Stack>
        </CardFrame>
    );
}
