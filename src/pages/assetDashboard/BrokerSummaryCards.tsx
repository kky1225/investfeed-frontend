import {useCallback, useMemo, useState} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import LinkIcon from "@mui/icons-material/Link";
import type {BrokerSummaryItem, BrokerHoldingItem} from "../../type/AssetDashboardType.ts";
import type {BrokerRealizedPnlItem} from "../../type/RealizedPnlType.ts";
import {useHoldingStream, HoldingBuffer} from "../holding/useHoldingStream.ts";
import {useCryptoHoldingStream, CryptoHoldingBuffer} from "../cryptoHolding/useCryptoHoldingStream.ts";
import BlindText from "../../components/BlindText.tsx";

interface BrokerSummaryCardsProps {
    brokerSummaries: BrokerSummaryItem[];
    brokerPnlList?: BrokerRealizedPnlItem[];
}

interface BrokerState {
    holdings: BrokerHoldingItem[];
    evltAmt: number;
    evltPl: number;
    prftRt: string;
}

export default function BrokerSummaryCards({brokerSummaries, brokerPnlList}: BrokerSummaryCardsProps) {
    const [brokerStates, setBrokerStates] = useState<Map<string, BrokerState>>(() => {
        const map = new Map<string, BrokerState>();
        brokerSummaries.forEach(b => {
            map.set(b.brokerName, {
                holdings: b.holdings,
                evltAmt: b.evltAmt,
                evltPl: b.evltPl,
                prftRt: b.prftRt,
            });
        });
        return map;
    });

    // 전체 주식 종목 코드 합산
    const allStockCodes = useMemo(() => {
        const codes: string[] = [];
        brokerSummaries.filter(b => b.market === 'STOCK').forEach(b => {
            b.holdings.forEach(h => codes.push(h.stkCd));
        });
        return codes;
    }, [brokerSummaries.map(b => b.holdings.map(h => h.stkCd).join(',')).join('|')]);

    // 전체 코인 종목 코드 합산
    const allCryptoCodes = useMemo(() => {
        const codes: string[] = [];
        brokerSummaries.filter(b => b.market === 'CRYPTO').forEach(b => {
            b.holdings.forEach(h => codes.push(h.stkCd));
        });
        return codes;
    }, [brokerSummaries.map(b => b.holdings.map(h => h.stkCd).join(',')).join('|')]);

    const updateBrokerStates = useCallback((curPrcMap: Map<string, string>) => {
        setBrokerStates(prev => {
            const next = new Map(prev);
            brokerSummaries.forEach(broker => {
                const state = next.get(broker.brokerName);
                if (!state) return;

                let hasUpdate = false;
                const updatedHoldings = state.holdings.map(h => {
                    const newPrc = curPrcMap.get(h.stkCd);
                    if (newPrc) {
                        hasUpdate = true;
                        return {...h, curPrc: newPrc};
                    }
                    return h;
                });

                if (!hasUpdate) return;

                let newEvltAmt = 0;
                updatedHoldings.forEach(h => {
                    newEvltAmt += Math.round(Number(h.curPrc) * h.quantity);
                });
                const totalPurAmt = updatedHoldings.reduce((sum, h) => sum + h.purAmt, 0);
                const newEvltPl = newEvltAmt - totalPurAmt;
                const newPrftRt = totalPurAmt > 0 ? (newEvltPl / totalPurAmt * 100) : 0;

                next.set(broker.brokerName, {
                    holdings: updatedHoldings,
                    evltAmt: newEvltAmt,
                    evltPl: newEvltPl,
                    prftRt: newPrftRt.toFixed(2),
                });
            });
            return next;
        });
    }, [brokerSummaries]);

    const handleStockUpdate = useCallback((bufferMap: Map<string, HoldingBuffer>) => {
        const curPrcMap = new Map<string, string>();
        bufferMap.forEach((buffer, stkCd) => {
            if (buffer.curPrc) curPrcMap.set(stkCd, buffer.curPrc);
        });
        if (curPrcMap.size > 0) updateBrokerStates(curPrcMap);
    }, [updateBrokerStates]);

    const handleCryptoUpdate = useCallback((bufferMap: Map<string, CryptoHoldingBuffer>) => {
        const curPrcMap = new Map<string, string>();
        bufferMap.forEach((buffer, market) => {
            if (buffer.curPrc) curPrcMap.set(market, buffer.curPrc);
        });
        if (curPrcMap.size > 0) updateBrokerStates(curPrcMap);
    }, [updateBrokerStates]);

    // 주식/코인 각각 한 번만 스트림 호출
    useHoldingStream(allStockCodes, handleStockUpdate);
    useCryptoHoldingStream(allCryptoCodes, handleCryptoUpdate);

    if (brokerSummaries.length === 0) return null;

    return (
        <Box sx={{mb: 3}}>
            <Typography component="h2" variant="subtitle2" sx={{mb: 1.5}}>
                증권사 / 거래소별 현황
            </Typography>
            <Grid container spacing={2}>
                {brokerSummaries.map((broker, index) => {
                    const state = brokerStates.get(broker.brokerName);
                    const evltAmt = state?.evltAmt ?? broker.evltAmt;
                    const evltPl = state?.evltPl ?? broker.evltPl;
                    const prftRt = state?.prftRt ?? broker.prftRt;
                    const profitColor = evltPl > 0 ? 'error.main' : evltPl < 0 ? 'info.main' : 'text.primary';
                    const totalAsset = evltAmt + broker.cash;
                    const marketLabel = broker.market === 'STOCK' ? '주식' : '코인';

                    return (
                        <Grid key={index} size={{xs: 12, sm: 6, md: 4}}>
                            <Card variant="outlined" sx={{height: '100%'}}>
                                <CardContent sx={{pb: '16px !important'}}>
                                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5}}>
                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                            <Typography variant="subtitle2" sx={{fontWeight: 600}}>
                                                {broker.brokerName}
                                            </Typography>
                                            {broker.type === 'API' && <LinkIcon sx={{fontSize: 14, color: 'text.secondary'}}/>}
                                        </Box>
                                        <Chip label={marketLabel} size="small" variant="outlined"/>
                                    </Box>

                                    <Typography variant="body2" sx={{color: 'text.secondary', mb: 0.5}}>
                                        총 자산
                                    </Typography>
                                    <Typography variant="h6" sx={{fontWeight: 700, mb: 1.5}}>
                                        <BlindText>{totalAsset.toLocaleString()}원</BlindText>
                                    </Typography>

                                    <Divider sx={{mb: 1.5}}/>

                                    <Box sx={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1}}>
                                        <Box>
                                            <Typography variant="caption" sx={{color: 'text.secondary'}}>평가금액</Typography>
                                            <Typography variant="body2" sx={{fontWeight: 600}}>
                                                <BlindText>{evltAmt.toLocaleString()}원</BlindText>
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" sx={{color: 'text.secondary'}}>예수금</Typography>
                                            <Typography variant="body2" sx={{fontWeight: 600}}>
                                                <BlindText>{broker.cash.toLocaleString()}원</BlindText>
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" sx={{color: 'text.secondary'}}>수익</Typography>
                                            <Typography variant="body2" sx={{fontWeight: 600, color: profitColor}}>
                                                <BlindText>{evltPl > 0 ? '+' : ''}{evltPl.toLocaleString()}원</BlindText>
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" sx={{color: 'text.secondary'}}>수익률</Typography>
                                            <Typography variant="body2" sx={{fontWeight: 600, color: profitColor}}>
                                                <BlindText>{Number(prftRt) > 0 ? '+' : ''}{prftRt}%</BlindText>
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {(() => {
                                        const pnl = brokerPnlList?.find(p => p.brokerName === broker.brokerName);
                                        if (!pnl) return null;
                                        return (
                                            <>
                                                <Box sx={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1}}>
                                                    <Box>
                                                        <Typography variant="caption" sx={{color: 'text.secondary'}}>당월 실현손익</Typography>
                                                        <Typography variant="body2" sx={{fontWeight: 600, color: pnl.currentMonthPnl > 0 ? 'error.main' : pnl.currentMonthPnl < 0 ? 'info.main' : 'text.primary'}}>
                                                            <BlindText>{pnl.currentMonthPnl > 0 ? '+' : ''}{pnl.currentMonthPnl.toLocaleString()}원</BlindText>
                                                        </Typography>
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="caption" sx={{color: 'text.secondary'}}>올해 실현손익</Typography>
                                                        <Typography variant="body2" sx={{fontWeight: 600, color: pnl.ytdPnl > 0 ? 'error.main' : pnl.ytdPnl < 0 ? 'info.main' : 'text.primary'}}>
                                                            <BlindText>{pnl.ytdPnl > 0 ? '+' : ''}{pnl.ytdPnl.toLocaleString()}원</BlindText>
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </>
                                        );
                                    })()}

                                    <Divider sx={{my: 1.5}}/>

                                    <Typography variant="caption" sx={{color: 'text.secondary'}}>
                                        보유 종목 {broker.holdingCount}개
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>
        </Box>
    );
}
