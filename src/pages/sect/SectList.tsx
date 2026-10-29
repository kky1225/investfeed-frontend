import {mergeLive} from "../../lib/streamOverlay.ts";
import {Box, Tab, Tabs} from "@mui/material";
import Typography from "@mui/material/Typography";
import {useEffect, useMemo, useRef, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import * as React from "react";
import {SectListItem, SectListReq, SectListRes, SectListStream, SectListStreamReq, SectListStreamRes} from "../../type/SectType.ts";
import {MarketType} from "../../type/timeType.ts";
import {fetchMarketInfo, getServerNow, getServerOffset} from "../../lib/serverTime.ts";
import {fetchSectList, fetchSectListStream} from "../../api/sect/SectApi.ts";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import SectorHeatmap, {HeatmapLegend, HeatmapTile} from "../../components/SectorHeatmap.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";

interface LiveSectUpdate {
    value: string;
    fluRt: string;
}

// 하위 업종을 포함하는 업종 — 같은 종목이 두 타일에 반영됨을 툴팁으로 알림
const SECT_NOTE: Record<string, string> = {
    '021': '증권·보험 포함',
};

const rateNum = (raw: string | undefined): number => {
    const n = Number(String(raw ?? '').replace(/^\+/, ''));
    return Number.isFinite(n) ? n : 0;
};

const numText = (raw: string | undefined): string => {
    const n = Number(String(raw ?? '').replace(/^[+-]/, ''));
    return Number.isFinite(n) ? n.toLocaleString() : '-';
};

// 거래대금 단위: 백만원 → 억
const amountText = (raw: string | undefined): string => {
    const n = Number(raw);
    return Number.isFinite(n) && raw ? `${Math.round(n / 100).toLocaleString()}억` : '-';
};

const SectList = () => {
    const navigate = useNavigate();
    const {indsCd} = useParams();

    const req: SectListReq = useMemo(() => ({indsCd: indsCd || "001"}), [indsCd]);
    const [value, setValue] = useState(indsCd === "001" ? 0 : 1);
    const [liveOverlay, setLiveOverlay] = useState<Map<string, LiveSectUpdate>>(new Map());

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);
    const subscribedKeyRef = useRef<string>('');

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<SectListRes>(
        ['sectList', req.indsCd],
        (config) => fetchSectList(req, config),
    );

    // 키움 ka20003 응답에 시각 필드가 없어 stamp 비교 불가. 폴링 도착 시 WS overlay 를
    // 비워서 stale 가격이 새 폴링 결과를 덮어쓰지 못하게 한다.
    useEffect(() => {
        if (!result) return;
        setLiveOverlay(new Map());
    }, [result]);

    const sectList: SectListItem[] = useMemo(() => {
        if (!result) return [];
        return [...(result.sectList ?? [])].sort((a, b) => rateNum(b.fluRt) - rateNum(a.fluRt));
    }, [result]);

    const tiles: HeatmapTile[] = useMemo(() => sectList.map((sect) => {
        const live = liveOverlay.get(sect.stkCd);
        return {
            key: sect.stkCd,
            name: sect.stkNm,
            rate: rateNum(live?.fluRt ?? sect.fluRt),
            link: `/stock/sect/${sect.stkCd}/list`,
            tooltip: [
                ['지수', numText(live?.value ?? sect.curPrc.replace(/^[+-]/, ''))],
                ['거래대금', amountText(sect.trdePrica)],
                ['상승 / 보합 / 하락', `${sect.rising ?? '-'} / ${sect.stdns ?? '-'} / ${sect.fall ?? '-'}`],
                ['종목수', sect.floStkNum ?? '-'],
            ],
            note: SECT_NOTE[sect.stkCd],
        };
    }), [sectList, liveOverlay]);

    const timeNow = async () => {
        const info = await fetchMarketInfo(MarketType.INDEX);
        if (!info) return;
        if (info.marketType !== MarketType.INDEX) return;

        chartTimer.current = getServerOffset();
        if (!info.isMarketOpen) marketTimer.current = info.startMarketTime - getServerNow();

        return {...info};
    };

    const sectListStream = async (req: SectListStreamReq) => {
        try {
            const data = await fetchSectListStream(req);
            if (data.code !== "0000") throw new Error(data.message);
        } catch (error) {
            console.error(error);
        }
    };

    const streamBufferRef = useRef<Map<string, SectListStream>>(new Map());

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                data.data.forEach((entry: SectListStreamRes) => {
                    const values = entry.values;
                    if (values?.["10"] == null) return;
                    streamBufferRef.current.set(entry.item, {
                        code: entry.item,
                        value: values["10"],
                        fluRt: values["12"],
                        trend: values["25"],
                    });
                });
            }
        };
        return socket;
    };

    // WebSocket 라이프사이클 — sectList 결과의 stkCd 들로 stream 등록.
    useEffect(() => {
        if (!result) return;
        const items = (result.sectList ?? []).map((s: SectListItem) => s.stkCd);
        if (items.length === 0) return;

        const key = `${req.indsCd}|${items.join(',')}`;
        if (subscribedKeyRef.current === key) return;
        subscribedKeyRef.current = key;

        // indsCd 가 변하면 overlay reset (이전 인덱스 stream 데이터가 새 탭 데이터에 섞이지 않도록)
        setLiveOverlay(new Map());

        let socketTimeout: ReturnType<typeof setTimeout>;
        let displayInterval: ReturnType<typeof setInterval> | undefined;
        let socket: WebSocket | undefined;

        const startDisplayLoop = () => {
            displayInterval = setInterval(() => {
                if (streamBufferRef.current.size === 0) return;
                setLiveOverlay((prev) => mergeLive(prev, streamBufferRef.current, (u) => ({
                    value: u.value.replace(/^[+-]/, ''),
                    fluRt: u.fluRt,
                })));
                streamBufferRef.current.clear();
            }, 200);
        };

        (async () => {
            const marketInfo = await timeNow();

            if (marketInfo?.isMarketOpen) {
                await sectListStream({items});
                socket = openSocket();
                startDisplayLoop();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();
                    const again = await timeNow();
                    if (again?.isMarketOpen) {
                        await sectListStream({items});
                        socket = openSocket();
                        startDisplayLoop();
                    }
                }, marketTimer.current + 200);
            }
        })();

        return () => {
            socket?.close();
            clearTimeout(socketTimeout);
            if (displayInterval) clearInterval(displayInterval);
            streamBufferRef.current.clear();
        };
    }, [result, req.indsCd]);

    const handleChange = (_event: React.SyntheticEvent, index: number) => {
        const newValue = index === 1 ? "101" : "001";
        setValue(index);
        navigate(`/stock/sect/list/${newValue}`);
    };

    function a11yProps(indsCd: string) {
        return {
            id: `simple-tab-${indsCd}`,
            'aria-controls': `simple-tabpanel-${indsCd}`,
        };
    }

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2, gap: 2}}>
                <Typography component="h2" variant="h6">
                    업종 목록
                </Typography>
                <Box sx={{flex: 1}}/>
                <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
            </Box>
            <Box sx={{borderBottom: 1, borderColor: 'divider', mb: 2}}>
                <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
                    <Tab label="종합(KOSPI)" {...a11yProps("001")} />
                    <Tab label="종합(KOSDAQ)" {...a11yProps("101")} />
                </Tabs>
            </Box>
            <Box sx={{mb: 2}}>
                <HeatmapLegend palette="kr"/>
            </Box>
            <SectorHeatmap tiles={tiles} palette="kr" loading={isLoading}/>
        </Box>
    );
};

export default SectList;
