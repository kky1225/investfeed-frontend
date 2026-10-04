import {useState, type ReactNode} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import type {HoldingPayload, HoldingRowPayload, PnlPayload, PortfolioPayload, PriceAlertPreviewPayload} from '../../../type/AssistantType';
import {renderChangeAmount} from '../../CustomRender';
import AccountSummary from '../AccountSummary';
import {confirmAssistantPriceAlert} from '../../../api/assistant/AssistantApi';
import {requireOk} from '../../../lib/apiResponse';
import {ASSET_CLASS_LABEL, CardFrame, MiniTable, Stat, amount, fmt, price, rateChip} from './CardParts';

function holdingRows(rows: HoldingRowPayload[]) {
    return rows.map((r) => [
        r.link ? <Link component={RouterLink} to={r.link} underline="hover">{r.name}</Link> : r.name,
        rateChip(r.dayRate),
        rateChip(r.totalRate),
        amount(r.evalProfit, r.currency),
        r.broker,
    ]);
}

const FILTER_LABEL = (f: NonNullable<PortfolioPayload['filter']>) => [
    f.dayRateLt !== null ? `오늘 ${f.dayRateLt}% 미만` : null,
    f.dayRateGt !== null ? `오늘 ${f.dayRateGt}% 초과` : null,
    f.totalRateLt !== null ? `수익률 ${f.totalRateLt}% 미만` : null,
    f.totalRateGt !== null ? `수익률 ${f.totalRateGt}% 초과` : null,
].filter(Boolean).join(' · ');

/** 이전 형식 (accounts 없는 예전 답변) */
function LegacyPortfolioCard({p}: { p: PortfolioPayload }) {
    return (
        <CardFrame personal title="내 계좌 요약" asOf={p.asOf} link="/stock/holding/list" linkLabel="보유 화면">
            <Stat label="총 평가금액 (원화 환산)"><b>{p.totalEvalKrw !== null ? `${fmt(p.totalEvalKrw)}원` : '-'}</b></Stat>
            {p.realizedMonthWon !== null && <Stat label="이달 실현손익">{amount(p.realizedMonthWon)}</Stat>}
            <MiniTable
                head={['자산', '평가금액', '오늘', '오늘 손익', '수익률']}
                rows={p.classes.map((c) => [
                    ASSET_CLASS_LABEL[c.assetClass] ?? c.assetClass,
                    price(c.eval, c.currency),
                    rateChip(c.dayRate),
                    amount(c.dayChange, c.currency),
                    rateChip(c.totalRate),
                ])}
            />
            {p.classes.some((c) => c.failedBrokers.length > 0) && (
                <Typography variant="caption" color="warning.main" display="block" sx={{mt: 0.5}}>
                    조회 실패: {p.classes.flatMap((c) => c.failedBrokers).join(', ')}
                </Typography>
            )}
            {p.filter && p.filtered ? (
                <Box sx={{mt: 1}}>
                    <Typography variant="caption" color="text.secondary">{FILTER_LABEL(p.filter)} · {p.filtered.length}종목</Typography>
                    {p.filtered.length > 0 && <MiniTable head={['종목', '오늘', '수익률', '평가손익', '증권사']} rows={holdingRows(p.filtered)}/>}
                </Box>
            ) : (
                <>
                    {p.topGainers.length > 0 && (
                        <Box sx={{mt: 1}}>
                            <Typography variant="caption" color="text.secondary">오늘 상위</Typography>
                            <MiniTable head={['종목', '오늘', '수익률', '평가손익', '증권사']} rows={holdingRows(p.topGainers)}/>
                        </Box>
                    )}
                    {p.topLosers.length > 0 && (
                        <Box sx={{mt: 1}}>
                            <Typography variant="caption" color="text.secondary">오늘 하위</Typography>
                            <MiniTable head={['종목', '오늘', '수익률', '평가손익', '증권사']} rows={holdingRows(p.topLosers)}/>
                        </Box>
                    )}
                </>
            )}
        </CardFrame>
    );
}

/** 수량: 정수면 그대로, 소수(미국 소수점 주식·코인)는 필요한 자리까지 */
const qtyText = (v: number | null) => (v === null ? '-' : v.toLocaleString('ko-KR', {maximumFractionDigits: 8}));
/** 금액: 원화는 단위 없이, 달러는 $ */
const money = (v: number | null, currency: string) =>
    v === null ? '-' : currency === 'USD' ? `$${fmt(v, 2)}` : v.toLocaleString('ko-KR', {maximumFractionDigits: v < 100 ? 4 : 0});

/** 내 계좌: 계좌(증권사)별 섹션. 각 섹션은 브리핑 계좌 섹션과 같은 모양(AccountSummary) — 하위 카드는 국내·해외·코인 (2026-10-01) */
export function PortfolioCard({p}: { p: PortfolioPayload }) {
    if (!p.sections) return <LegacyPortfolioCard p={p}/>;
    return (
        <CardFrame personal title="내 계좌" asOf={p.asOf} link="/stock/holding/list" linkLabel="보유 화면">
            {p.filter && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{mb: 1}}>조건: {FILTER_LABEL(p.filter)}</Typography>
            )}
            {p.sections.length === 0 && <Typography variant="body2" color="text.secondary">해당하는 종목이 없습니다</Typography>}
            <Stack spacing={2}>
                {p.sections.map((sec) => (
                    <Box key={sec.id}>
                        <Typography sx={{fontSize: 15, fontWeight: 600, mb: 0.75}}>{sec.title}</Typography>
                        {sec.status === 'FAILED' || !sec.account
                            ? <Typography variant="body2" color="text.secondary">데이터 없음 (조회 실패)</Typography>
                            : <AccountSummary account={sec.account} groupLabel={null}/>}
                    </Box>
                ))}
            </Stack>
        </CardFrame>
    );
}

/** 값 칸 하나 (브리핑 증권사 카드의 칸처럼 라벨 위, 값 아래) */
function Cell({label, children}: { label: string; children: ReactNode }) {
    return (
        <Box>
            <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
            <Box sx={{fontSize: 14, fontVariantNumeric: 'tabular-nums'}}>{children}</Box>
        </Box>
    );
}

/**
 * 보유 종목: 현재가는 위에 한 번, 증권사마다 구역을 나눠 그 계좌의 값을 칸으로 (브리핑 증권사 카드처럼, 2026-10-01).
 * 칸 순서는 보유 목록 컬럼 순서(수익률·보유수량·매입가·평가금액·평가손익)
 */
export function HoldingCard({p}: { p: HoldingPayload }) {
    return (
        // 상단은 종목 시세 카드와 같은 모양 (제목 = 종목명 링크, 큰 현재가 · 등락 금액 · 등락률 칩). "보유" 접두는 뺐다 (2026-10-01)
        <CardFrame personal title={<Link component={RouterLink} to={p.link} underline="hover" color="inherit">{p.name}</Link>} asOf={p.asOf}>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Typography variant="h5" component="p">{money(p.curPrc, p.currency)}</Typography>
                {p.dayChange !== null && renderChangeAmount(p.dayChange, p.currency === 'USD' ? '달러' : '원')}
                {rateChip(p.dayRate)}
            </Stack>
            <Stack spacing={1.25} sx={{mt: 1.25}}>
                {p.brokers.map((b) => (
                    <Box key={b.broker} sx={{borderTop: '1px solid', borderColor: 'divider', pt: 1}}>
                        <Typography variant="body2" sx={{fontWeight: 600, mb: 0.75}}>{b.broker}</Typography>
                        <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 1}}>
                            <Cell label="수익률">{rateChip(b.totalRate)}</Cell>
                            <Cell label="보유수량">{qtyText(b.qty)}</Cell>
                            <Cell label="매입가">{money(b.purPrice, p.currency)}</Cell>
                            <Cell label="평가금액">{money(b.eval, p.currency)}</Cell>
                            <Cell label="평가손익">{amount(b.evalProfit, p.currency)}</Cell>
                        </Box>
                    </Box>
                ))}
            </Stack>
        </CardFrame>
    );
}

const PERIOD_LABEL = (p: PnlPayload) =>
    p.period === 'THIS_YEAR' ? `${p.year}년` : `${p.year}년 ${p.month}월`;

/** 실현손익 탭(RealizedPnlTab)과 같은 색: 이익 빨강 · 손실 파랑, "+1,234원" */
function PnlText({value, variant = 'body2'}: { value: number; variant?: 'body2' | 'h5' }) {
    const color = value > 0 ? 'error.main' : value < 0 ? 'info.main' : 'text.primary';
    return <Typography component="span" variant={variant} sx={{color, fontWeight: variant === 'h5' ? 700 : 600}}>{value > 0 ? '+' : ''}{value.toLocaleString()}원</Typography>;
}

/**
 * 실현손익: 실현손익 탭의 요약 카드 모양("2026년 10월 실현손익" + 큰 색 숫자) + 증권사별 구역 (2026-10-01).
 * 월 단위면 증권사마다 금액 한 줄, 올해면 증권사마다 월별 표(기간 · 실현손익)
 */
export function PnlCard({p}: { p: PnlPayload }) {
    const brokers = [...new Set(p.rows.map((r) => r.broker))];
    const monthly = p.period !== 'THIS_YEAR';
    return (
        <CardFrame personal title="실현손익" link="/stock/holding/list" linkLabel="보유 화면">
            <Typography variant="body2" color="text.secondary" sx={{mb: 0.5}}>{PERIOD_LABEL(p)} 실현손익</Typography>
            <PnlText value={p.totalWon} variant="h5"/>
            {brokers.length > 0 && (
                <Stack spacing={1.25} sx={{mt: 1.5}}>
                    {brokers.map((b) => {
                        const rows = p.rows.filter((r) => r.broker === b);
                        const sum = rows.reduce((n, r) => n + r.realizedPnl, 0);
                        return (
                            <Box key={b} sx={{borderTop: '1px solid', borderColor: 'divider', pt: 1}}>
                                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                                    <Typography variant="body2" sx={{fontWeight: 600}}>{b}</Typography>
                                    <PnlText value={sum}/>
                                </Stack>
                                {!monthly && rows.length > 0 && (
                                    <Box sx={{mt: 0.5}}>
                                        <MiniTable
                                            head={['기간', '실현손익']}
                                            rows={rows.map((r) => [`${r.year}년 ${r.month}월`, <PnlText value={r.realizedPnl}/>])}
                                        />
                                    </Box>
                                )}
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </CardFrame>
    );
}

/** 목표가 확인 카드. 버튼은 cardRef 만 보내고 서버가 Redis 원본으로 등록한다 */
export function ConfirmPriceAlertCard({p, cardRef}: { p: PriceAlertPreviewPayload; cardRef?: string | null }) {
    const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const submit = async () => {
        if (!cardRef || state === 'sending' || state === 'done') return;
        setState('sending');
        try {
            requireOk(await confirmAssistantPriceAlert(cardRef), '목표가 알림 등록');
            setState('done');
        } catch (e) {
            const msg = (e as {response?: {data?: {message?: string}}}).response?.data?.message ?? (e as Error).message;
            setMessage(msg || '등록하지 못했습니다');
            setState('error');
        }
    };
    return (
        <CardFrame personal title="목표가 알림 등록">
            <Stat label="종목">{p.name} <Typography component="span" variant="caption" color="text.secondary">{p.code}</Typography></Stat>
            <Stat label="조건">{`${fmt(p.price)}원 ${p.direction === 'ABOVE' ? '이상' : '이하'} 도달 시`}</Stat>
            {state === 'error' && <Alert severity="error" sx={{py: 0, mt: 1}}>{message}</Alert>}
            {/* 카드 안 실행 버튼이라 색 있는 버튼 (관리자 등록 버튼과 같은 contained), 오른쪽 아래 */}
            <Stack direction="row" alignItems="center" sx={{mt: 1}}>
                {/* 링크에 flexGrow 를 주면 링크 폭이 줄 전체로 늘어나 밑줄이 길어진다 → 여백은 별도 Box */}
                <Link component={RouterLink} to="/notification/settings" variant="caption">알림 설정</Link>
                <Box sx={{flexGrow: 1}}/>
                {state === 'done'
                    ? <Typography variant="body2" color="success.main">등록되었습니다</Typography>
                    : <Button variant="contained" size="small" onClick={submit}>{state === 'sending' ? '등록 중…' : '등록'}</Button>}
            </Stack>
        </CardFrame>
    );
}
