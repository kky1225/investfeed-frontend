import {JSX, MouseEvent, ReactElement, useEffect, useMemo, useRef, useState} from "react";
import {useParams} from "react-router-dom";
import {Accordion, AccordionDetails, AccordionSummary, Box, Select, SelectChangeEvent, Slider, Tooltip} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CheckIcon from "@mui/icons-material/Check";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import RemoveIcon from "@mui/icons-material/Remove";
import DoNotDisturbIcon from "@mui/icons-material/DoNotDisturb";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import ToggleButton from "@mui/material/ToggleButton";
import MenuItem from "@mui/material/MenuItem";
import {Theme} from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import InvestorBarChart from "../../components/InvestorBarChart.tsx";
import CandleChart from "../../components/chart/CandleChart.tsx";
import {ChartToolbarGroup} from "../../components/chart/ChartToolbarControls.tsx";
import {CandleInterval, TimeUnit} from "../../lib/chart/types.ts";
import {kiwoomCandles as toCandles} from "../detail/chartCandles.ts";
import {
    CommodityChartType,
    CommodityDetailReq,
    CommodityDetailRes,
    CommodityStream,
    CommodityStreamRes
} from "../../type/CommodityType.ts";
import {fetchCommodityDetail, fetchCommodityStream} from "../../api/commodity/CommodityApi.ts";
import {useMarketWebSocket} from "../detail/useMarketWebSocket.ts";
import ErrorIcon from "@mui/icons-material/Error";
import HelpIcon from "@mui/icons-material/Help";
import {CommodityDetailLineChartProps} from "../../components/CommodityDetailLineChart.tsx";
import {MarketType} from "../../type/timeType.ts";
import {renderChangeAmount} from "../../components/CustomRender.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";
import {parseKiwoomStamp} from "../../lib/tradeStamp.ts";

// 날짜 눈금 표기 단위. 주봉은 날짜까지 적는다
const CHART_TIME_UNIT: Record<CommodityChartType, TimeUnit> = {
    [CommodityChartType.MINUTE_1]: 'minute',
    [CommodityChartType.MINUTE_3]: 'minute',
    [CommodityChartType.MINUTE_5]: 'minute',
    [CommodityChartType.MINUTE_10]: 'minute',
    [CommodityChartType.MINUTE_30]: 'minute',
    [CommodityChartType.DAY]: 'day',
    [CommodityChartType.WEEK]: 'day',
    [CommodityChartType.MONTH]: 'month',
};

// 분봉 한 개가 담는 기간. 차트가 캔들 마감까지 남은 시간을 적는 데 쓴다 (일봉 이상은 적지 않는다)
const CHART_INTERVAL: Partial<Record<CommodityChartType, CandleInterval>> = {
    [CommodityChartType.MINUTE_1]: {unit: 'minute', count: 1},
    [CommodityChartType.MINUTE_3]: {unit: 'minute', count: 3},
    [CommodityChartType.MINUTE_5]: {unit: 'minute', count: 5},
    [CommodityChartType.MINUTE_10]: {unit: 'minute', count: 10},
    [CommodityChartType.MINUTE_30]: {unit: 'minute', count: 30},
};

// 그린 선을 저장할 때 종목 코드와 겹치지 않게 원자재 코드 뒤에 붙이는 말
const COMMODITY_ASSET_SUFFIX = '_COMMODITY';

interface CommodityRangeProps {
    value: number;
    label: ReactElement;
}

interface CommodityInfoProps {
    trdeQty: number;
    trdePrica: number;
    openPric: number;
    curPrc: number;
    _250lwst: number;
    _250hgst: number;
}

interface MessageProps {
    icon: JSX.Element,
    title: string,
    message: string
}

// 순수 헬퍼들 — 모듈 레벨로 끌어올려 useMemo 의 TDZ 회피.
const trendColor = (value: string) => {
    return ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';
};

const chartColor = (value: string) => {
    return ["1", "2"].includes(value) ? 'red' : ["4", "5"].includes(value) ? 'blue' : 'grey';
};

function checkInvestor(name: string, orgn: number, frgnr: number): MessageProps {
    let message: string;
    let title: string;
    let icon: JSX.Element;

    if (orgn == 0) {
        message = '외국인 관망, '
    } else if (orgn > 0) {
        message = '외국인 매수, '
    } else {
        message = '외국인 매도, '
    }

    if (frgnr == 0) {
        message = message + '기관 관망 중입니다.'
    } else if (frgnr > 0) {
        message = message + '기관 매수 중입니다.'
    } else {
        message = message + '기관 매도 중입니다.'
    }

    if (orgn == 0 && frgnr == 0) {
        title = `${name} 투자 중립`
        icon = <RemoveIcon />
    } else if (orgn > 0 && frgnr > 0) {
        title = `${name} 투자 양호`
        icon = <CheckIcon color="success" />;
    } else if(orgn > 0 || frgnr > 0) {
        title = `${name} 투자 주의`
        icon = <PriorityHighIcon color="warning" />
    } else {
        title = `${name} 투자 위험`
        icon = <DoNotDisturbIcon color="error" />
    }

    return { message, title, icon };
}

const INITIAL_CHART_DATA: CommodityDetailLineChartProps = {
    id: '-',
    title: '-',
    orderWarning: "0",
    value: '-',
    fluRt: '0',
    predPre: '0',
    openPric: 0,
    interval: '-',
    trend: 'neutral',
    nxtEnable: 'Y',
    seriesData: [
        {
            id: '',
            showMark: false,
            curve: 'linear',
            area: true,
            stackOrder: 'ascending',
            color: 'grey',
            data: []
        }
    ],
    barDataList: [],
    dateList: []
};

const INITIAL_INFO: CommodityInfoProps = {
    trdeQty: 0,
    trdePrica: 0,
    openPric: 0,
    curPrc: 0,
    _250hgst: 0,
    _250lwst: 0,
};

const INITIAL_DAY_RANGE: CommodityRangeProps[] = [
    {value: 0, label: <p>1일 최저가 <br />0</p>},
    {value: 0, label: <p>1일 최고가 <br />0</p>},
];

const INITIAL_YEAR_RANGE: CommodityRangeProps[] = [
    {value: 0, label: <p>52주 최저가 <br />0</p>},
    {value: 0, label: <p>52주 최고가 <br />0</p>},
];

const INITIAL_BAR_DATA: number[] = [0, 0, 0];

const INITIAL_MESSAGE: MessageProps = {
    icon: <RemoveIcon />,
    title: '-',
    message: '-'
};

const CommodityDetail = () => {
    const { id } = useParams();
    const stkCd = id ?? "";

    const [req, setReq] = useState<CommodityDetailReq>({
        chartType: CommodityChartType.DAY
    });

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<CommodityDetailRes>(
        ['commodityDetail', stkCd, req.chartType],
        (config) => fetchCommodityDetail(stkCd, req, config),
    );
    const loading = isLoading;

    type LivePrice = {
        value: string;
        fluRt: string;
        predPre: string;
        trend: 'up' | 'down' | 'neutral';
        stamp: number;
    };
    const [livePrice, setLivePrice] = useState<LivePrice | null>(null);
    const updateIfNewer = (incoming: LivePrice) =>
        setLivePrice(prev => (!prev || incoming.stamp > prev.stamp) ? incoming : prev);

    // stkCd 변경 시 reset
    const [prevStkCd, setPrevStkCd] = useState(stkCd);
    if (stkCd !== prevStkCd) {
        setPrevStkCd(stkCd);
        setLivePrice(null);
    }

    // 폴링 결과 → base chartData
    const baseCommodityChartData = useMemo<CommodityDetailLineChartProps>(() => {
        if (!result) return INITIAL_CHART_DATA;
        try {
            const {commodityInfo} = result;

            // 차트는 캔들 차트가 따로 그린다. 여기서는 머리의 가격·등락·시각만 만든다.
            const year = commodityInfo.tm.substring(0, 4);
            const month = commodityInfo.tm.substring(4, 6);
            const day = commodityInfo.tm.substring(6, 8);
            const hour = commodityInfo.tm.substring(8, 10);
            const mm = commodityInfo.tm.substring(10, 12);

            const today = (Number(hour) >= 20 || Number(hour) < 8)
                ? `${year}.${month}.${day} 장마감`
                : `${year}.${month}.${day} ${hour}:${mm}`;

            return {
                id: commodityInfo.stkCd,
                title: commodityInfo.stkNm,
                orderWarning: commodityInfo.orderWarning,
                value: Number(commodityInfo.curPrc.replace(/^[+-]/, '')).toLocaleString(),
                fluRt: commodityInfo.fluRt,
                predPre: commodityInfo.predPre || '0',
                openPric: parseFloat(commodityInfo.openPric.replace(/^[+-]/, '')),
                interval: today,
                trend: trendColor(commodityInfo.predPreSig),
                nxtEnable: commodityInfo.nxtEnable,
                seriesData: [
                    {
                        id: id,
                        showMark: false,
                        curve: 'linear',
                        area: true,
                        stackOrder: 'ascending',
                        color: chartColor(commodityInfo.predPreSig),
                        data: [],
                    }
                ],
                barDataList: [],
                dateList: []
            } as unknown as CommodityDetailLineChartProps;
        } catch (err) {
            console.error(err);
            return INITIAL_CHART_DATA;
        }
    }, [result, id]);

    // 차트 캔들. 실시간 가격은 마지막 캔들의 종가·고가·저가에만 반영하고, 새 캔들은 주기적 조회로 받는다.
    const candleList = useMemo(() => toCandles(result?.commodityChartList ?? []), [result]);
    const candles = useMemo(() => {
        const last = candleList[candleList.length - 1];
        const price = livePrice ? Number(livePrice.value.replace(/,/g, '')) : NaN;
        if (!last || !livePrice || !Number.isFinite(price) || price <= 0 || livePrice.stamp < last.time) return candleList;
        return [
            ...candleList.slice(0, -1),
            {...last, close: price, high: Math.max(last.high, price), low: Math.min(last.low, price)},
        ];
    }, [candleList, livePrice]);

    // dayRange — WS 갱신 없음
    const dayRange = useMemo<CommodityRangeProps[]>(() => {
        if (!result) return INITIAL_DAY_RANGE;
        const {commodityInfo} = result;
        const dayMin = commodityInfo['lowPric'].replace(/^[+-]/, '');
        const dayMax = commodityInfo['highPric'].replace(/^[+-]/, '');
        return [
            {value: Number(dayMin), label: <p>1일 최저가 <br />{Number(dayMin).toLocaleString()}</p>},
            {value: Number(dayMax), label: <p>1일 최고가 <br />{Number(dayMax).toLocaleString()}</p>},
        ];
    }, [result]);

    // yearRange — WS 갱신 없음
    const yearRange = useMemo<CommodityRangeProps[]>(() => {
        if (!result) return INITIAL_YEAR_RANGE;
        const {commodityInfo} = result;
        const yearMin = Number(commodityInfo._250lwst.replace(/^[+-]/, ''));
        const yearMax = Number(commodityInfo._250hgst.replace(/^[+-]/, ''));
        return [
            {value: yearMin, label: <p>52주 최저가 <br />{yearMin.toLocaleString()}</p>},
            {value: yearMax, label: <p>52주 최고가 <br />{yearMax.toLocaleString()}</p>},
        ];
    }, [result]);

    // info — WS 갱신 없음
    const info = useMemo<CommodityInfoProps>(() => {
        if (!result) return INITIAL_INFO;
        const {commodityInfo} = result;
        return {
            trdeQty: Number(commodityInfo.trdeQty),
            trdePrica: Number(commodityInfo.trdePrica),
            openPric: Number(commodityInfo.openPric.replace(/^[+-]/, '')),
            curPrc: Number(commodityInfo.curPrc.replace(/^[+-]/, '')),
            _250hgst: Number(commodityInfo._250hgst.replace(/^[+-]/, '')),
            _250lwst: Number(commodityInfo._250lwst.replace(/^[+-]/, '')),
        };
    }, [result]);

    // barData — WS 갱신 없음
    const barData = useMemo<number[]>(() => {
        if (!result) return INITIAL_BAR_DATA;
        const {commodityInfo} = result;
        return [commodityInfo.indNetprps, commodityInfo.frgnrNetprps, commodityInfo.orgnNetprps];
    }, [result]);

    // message — WS 갱신 없음
    const message = useMemo<MessageProps>(() => {
        if (!result) return INITIAL_MESSAGE;
        const {commodityInfo} = result;
        return checkInvestor(commodityInfo.stkNm, commodityInfo.frgnrNetprps, commodityInfo.orgnNetprps);
    }, [result]);

    // 폴링 결과 → livePrice (stamp 비교)
    useEffect(() => {
        if (!result?.commodityInfo) return;
        const c = result.commodityInfo;
        updateIfNewer({
            value: Number(c.curPrc.replace(/^[+-]/, '')).toLocaleString(),
            fluRt: c.fluRt,
            predPre: c.predPre || '0',
            trend: trendColor(c.predPreSig),
            stamp: parseKiwoomStamp(c.tm),
        });
    }, [result]);

    // 최종 commodityChartData = base (chart series 등) + livePrice (실시간 헤더)
    const commodityChartData = useMemo<CommodityDetailLineChartProps>(() => {
        if (!livePrice) return baseCommodityChartData;
        return {
            ...baseCommodityChartData,
            value: livePrice.value,
            fluRt: livePrice.fluRt,
            predPre: livePrice.predPre,
            trend: livePrice.trend,
        };
    }, [baseCommodityChartData, livePrice]);

    const [toggle, setToggle] = useState('DAY');
    const minute = useRef('1');

    const labelColors = {
        up: 'error' as const,
        down: 'info' as const,
        neutral: 'default' as const,
    };

    const color = labelColors[commodityChartData.trend];
    const trendValues = { up: `${commodityChartData.fluRt}%`, down: `${commodityChartData.fluRt}%`, neutral: `${commodityChartData.fluRt}%` };

    // WebSocket 라이프사이클 — useMarketWebSocket 훅이 시장 시각/연결/정리 모두 처리.
    useMarketWebSocket({
        marketType: MarketType.COMMODITY,
        subscriptionKey: stkCd,
        streamFn: () => fetchCommodityStream([stkCd]),
        onMessage: (event) => {
            const data = JSON.parse(event.data);
            if (data.trnm !== "REAL" || !Array.isArray(data.data)) return;

            const commodityList = data.data.filter((res: CommodityStreamRes) => res.item === stkCd && res.values?.["10"] != null).map((res: CommodityStreamRes) => {
                const values = res.values;
                return {
                    code: res.item,
                    value: values["10"],
                    change: values["11"],
                    fluRt: values["12"],
                    trend: values["25"],
                    tradeTime: values["20"],
                };
            });

            commodityList.forEach((commodity: CommodityStream & {tradeTime?: string}) => {
                if (commodity.code === stkCd) {
                    updateIfNewer({
                        value: commodity.value.replace(/^[+-]/, '').toLocaleString(),
                        predPre: commodity.change || '0',
                        fluRt: commodity.fluRt,
                        trend: trendColor(commodity.trend),
                        stamp: parseKiwoomStamp(commodity.tradeTime),
                    });
                }
            });
        },
    });

    const handleAlignment = (
        _event: MouseEvent<HTMLElement>,
        newAlignment: string,
    ) => {
        if(newAlignment !== null) {
            setToggle(newAlignment);

            if(newAlignment === 'MINUTE') {
                newAlignment = newAlignment + '_' + minute.current;
            }

            setReq({
                ...req,
                chartType: newAlignment as CommodityChartType
            })
        }
    };

    function handleOptionChange(event: SelectChangeEvent) {
        minute.current = event.target.value as string

        const value = 'MINUTE_' + event.target.value;

        setReq({
            ...req,
            chartType: value as CommodityChartType
        })
    }

    // 주기(분·일·주·월) 버튼. 넓은 화면에서는 차트 위쪽 줄에, 좁은 화면(md 미만)에서는 차트 아래에 놓는다.
    const isNarrow = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));
    const chartControls = (
        <ChartToolbarGroup
            size="small"
            value={toggle}
            exclusive
            onChange={handleAlignment}
            aria-label="차트 주기"
        >
            <ToggleButton value="MINUTE" key="MINUTE" aria-label="MINUTE">
                {/* 버튼 안의 선택 상자는 글자 크기·색을 버튼에서 물려받고, 화살표는 작은 아래 화살표 하나만 둔다. */}
                <Select
                    size="small"
                    value={minute.current}
                    onChange={handleOptionChange}
                    variant="standard"
                    disableUnderline
                    IconComponent={ArrowDropDownIcon}
                    sx={{
                        boxShadow: 'none',
                        backgroundColor: 'transparent',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        color: 'inherit',
                        '& .MuiSelect-select': {py: 0, pl: 0, minHeight: 0},
                        '& .MuiSelect-icon': {color: 'inherit'},
                    }}
                >
                    <MenuItem value="1">1분</MenuItem>
                    <MenuItem value="3">3분</MenuItem>
                    <MenuItem value="5">5분</MenuItem>
                    <MenuItem value="30">30분</MenuItem>
                </Select>
            </ToggleButton>
            <ToggleButton value="DAY" key="DAY" aria-label="DAY">일</ToggleButton>
            <ToggleButton value="WEEK" key="WEEK" aria-label="WEEK">주</ToggleButton>
            <ToggleButton value="MONTH" key="MONTH" aria-label="MONTH">월</ToggleButton>
        </ChartToolbarGroup>
    );

    function orderWarningMsg(type: string): string {
        let message = "";
        switch (type) {
            case "1":
                message = "ETF 투자주의 요망";
                break;
            case "2":
                message = "정리매매 종목 지정";
                break;
            case "3":
                message = "단기과열 종목 지정";
                break;
            case "4":
                message = "투자위험 종목 지정";
                break;
            case "5":
                message = "투자경고 종목 지정";
                break;
        }

        return message;
    }

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                <Typography component="h2" variant="h6">
                    원자재 상세
                </Typography>
                <Box sx={{ flex: 1 }}/>
                {/* 날짜·시각은 여기 한 곳에만 표시한다. 예: "2026.11.13 09:42 기준", 장 마감 후 "2026.11.13 장마감 기준" */}
                <FreshnessIndicator
                    lastUpdated={lastUpdated}
                    error={pollError}
                    label={loading || commodityChartData.interval === '-' ? undefined : commodityChartData.interval}
                />
            </Box>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb: (theme) => theme.spacing(2) }}
            >
                <Grid size={{ xs: 12, md: 12 }}>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                                <Typography component="h2" variant="subtitle2" gutterBottom>
                                    {loading ? <Skeleton width={140}/> : (
                                        <>
                                            {commodityChartData.title}
                                            {commodityChartData.orderWarning !== '0' &&
                                                <Tooltip title={orderWarningMsg(commodityChartData.orderWarning)} placement="right">
                                                    <ErrorIcon color="error" sx={{ fontSize: 'inherit', verticalAlign: 'middle', ml: "1px", mb: "3px" }} />
                                                </Tooltip>
                                            }
                                        </>
                                    )}
                                </Typography>
                                {commodityChartData.nxtEnable === 'Y' &&
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        NXT
                                        <Tooltip title="넥스트 트레이드는 오전 8시부터 오후 8시까지 거래할 수 있는 대체 거래소입니다.">
                                            <HelpIcon sx={{ fontSize: 'inherit', verticalAlign: 'middle', ml: "1px", mb: "3px" }} />
                                        </Tooltip>
                                    </Typography>
                                }
                            </Box>
                            <Stack sx={{ justifyContent: 'space-between' }}>
                                <Stack
                                    direction="row"
                                    sx={{
                                        alignContent: { xs: 'center', sm: 'flex-start' },
                                        alignItems: 'center',
                                        gap: 1,
                                    }}
                                >
                                    <Typography variant="h4" component="p">
                                        {loading ? <Skeleton width={160}/> : commodityChartData.value}
                                    </Typography>
                                    {loading ? <Skeleton width={80}/> : renderChangeAmount(commodityChartData.predPre, '')}
                                    {loading
                                        ? <Skeleton variant="rounded" width={60} height={24}/>
                                        : <Chip size="small" color={color} label={trendValues[commodityChartData.trend]} />}
                                </Stack>
                            </Stack>
                        </CardContent>
                        {!isNarrow && loading && (
                            <Stack direction="row" spacing={1} sx={{px: 2, pb: 1, alignItems: 'center', minHeight: 40}}>
                                {chartControls}
                            </Stack>
                        )}
                        {/* 차트는 스스로 이동·확대하므로 화면 너비에 맞춘다. 선·영역 등 차트 종류는 차트 안에서 고른다. */}
                        {loading ? (
                            <Skeleton variant="rectangular" height={400} sx={{mx: 2, mb: 2, borderRadius: 1}}/>
                        ) : (
                            <CandleChart
                                candles={candles}
                                timeUnit={CHART_TIME_UNIT[req.chartType]}
                                interval={CHART_INTERVAL[req.chartType]}
                                seriesKey={`${stkCd}-${req.chartType}`}
                                assetType="STOCK"
                                assetCode={`${stkCd}${COMMODITY_ASSET_SUFFIX}`}
                                toolbarStart={isNarrow ? undefined : chartControls}
                            />
                        )}
                        {isNarrow && (
                            <Box
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                flexWrap="wrap"
                            >
                                {chartControls}
                            </Box>
                        )}
                    </Card>
                </Grid>
            </Grid>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb: (theme) => theme.spacing(2) }}
            >
                <Grid size={{ xs: 12, md: 12 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        상세 정보
                    </Typography>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Grid container spacing={2}>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        거래량
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.trdeQty.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        거래대금 (백만원)
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.trdePrica.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        시가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.openPric.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        현재가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.curPrc.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        52주 최저가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info._250lwst.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        52주 최고가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info._250hgst.toLocaleString()}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                    <Accordion variant="outlined" defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography component="h2" variant="h6">
                                당일 투자자별 순매수(주)
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Card variant="outlined" sx={{ width: '100%' }}>
                                        <CardContent>
                                            {loading ? (
                                                <Skeleton variant="rectangular" height={300} sx={{borderRadius: 1}}/>
                                            ) : (
                                                <InvestorBarChart data={barData} />
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Card variant="outlined" sx={{ width: '100%' }}>
                                        {!loading && message.icon}
                                        <CardContent>
                                            <Typography gutterBottom variant="h5" component="div">
                                                {loading ? <Skeleton width={180}/> : message.title}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                {loading ? <Skeleton width="80%"/> : message.message}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Accordion variant="outlined" defaultExpanded sx={{ overflow: 'visible' }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography component="h2" variant="h6">
                                일별 시세
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ overflow: 'visible' }}>
                            {loading ? (
                                <>
                                    <Box sx={{ px: 3, height: 100 }}>
                                        <Skeleton variant="rectangular" height={40} sx={{mt: 3, borderRadius: 1}}/>
                                    </Box>
                                    <Box sx={{ px: 3, height: 100 }}>
                                        <Skeleton variant="rectangular" height={40} sx={{mt: 3, borderRadius: 1}}/>
                                    </Box>
                                </>
                            ) : (
                                <>
                                    <Box sx={{ px: 3, height: 100, overflow: 'visible' }}>
                                        <Slider
                                            aria-label="Custom marks"
                                            track={false}
                                            value={info.curPrc}
                                            valueLabelDisplay="auto"
                                            disabled
                                            max={dayRange[1].value}
                                            min={dayRange[0].value}
                                            marks={dayRange}
                                        />
                                    </Box>
                                    <Box sx={{ px: 3, height: 100, overflow: 'visible' }}>
                                        <Slider
                                            aria-label="Custom marks"
                                            track={false}
                                            value={info.curPrc}
                                            valueLabelDisplay="auto"
                                            disabled
                                            max={yearRange[1].value}
                                            min={yearRange[0].value}
                                            marks={yearRange}
                                        />
                                    </Box>
                                </>
                            )}
                        </AccordionDetails>
                    </Accordion>
                </Grid>
            </Grid>
        </Box>
    )
}

export default CommodityDetail;