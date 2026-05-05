import {JSX, MouseEvent, ReactElement, useMemo, useRef, useState} from "react";
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
import {styled} from "@mui/material/styles";
import ToggleButtonGroup, {toggleButtonGroupClasses} from "@mui/material/ToggleButtonGroup";
import CandlestickChartIcon from "@mui/icons-material/CandlestickChart";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";
import InvestorBarChart from "../../components/InvestorBarChart.tsx";
import {
    CommodityChart,
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
import CommodityDetailLineChart, {CommodityDetailLineChartProps} from "../../components/CommodityDetailLineChart.tsx";
import {MarketType} from "../../type/timeType.ts";
import {renderChangeAmount} from "../../components/CustomRender.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
    border: 'none',
    boxShadow: 'none',
    [`& .${toggleButtonGroupClasses.grouped}`]: {
        border: 0,
        borderRadius: theme.shape.borderRadius,
        [`&.${toggleButtonGroupClasses.disabled}`]: {
            border: 0,
        },
    },
    [`& .${toggleButtonGroupClasses.middleButton},& .${toggleButtonGroupClasses.lastButton}`]:
        {
            marginLeft: -1,
            borderLeft: '1px solid transparent',
        },
}));

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

    // WebSocket 으로 들어오는 실시간 부분 갱신을 보관하는 overlay state.
    const [liveChartOverlay, setLiveChartOverlay] = useState<Partial<CommodityDetailLineChartProps>>({});

    // stkCd 변경 시 overlay reset
    const [prevStkCd, setPrevStkCd] = useState(stkCd);
    if (stkCd !== prevStkCd) {
        setPrevStkCd(stkCd);
        setLiveChartOverlay({});
    }

    // 폴링 결과 → base chartData
    const baseCommodityChartData = useMemo<CommodityDetailLineChartProps>(() => {
        if (!result) return INITIAL_CHART_DATA;
        try {
            const {commodityInfo, commodityChartList} = result;

            let dateList;
            let lineData, barDataList;

            switch (req.chartType) {
                case CommodityChartType.MINUTE_1:
                case CommodityChartType.MINUTE_3:
                case CommodityChartType.MINUTE_5:
                case CommodityChartType.MINUTE_10:
                case CommodityChartType.MINUTE_30: {
                    dateList = commodityChartList.map((item: CommodityChart) => {
                        return `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)} ${item.dt.slice(8, 10)}:${item.dt.slice(10, 12)}`
                    }).reverse();
                    lineData = commodityChartList.map((item: CommodityChart) => item.curPrc.replace(/^[+-]/, '')).reverse();
                    barDataList = commodityChartList.map((item: CommodityChart) => Number(item.trdeQty)).reverse();
                    break;
                }
                case CommodityChartType.DAY:
                case CommodityChartType.WEEK:
                case CommodityChartType.MONTH: {
                    dateList = commodityChartList.map((item: CommodityChart) => {
                        return `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                    }).reverse();
                    lineData = commodityChartList.map((item: CommodityChart) => item.curPrc).reverse();
                    barDataList = commodityChartList.map((item: CommodityChart) => Number(item.trdeQty)).reverse();
                    break;
                }
                default:
                    return INITIAL_CHART_DATA;
            }

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
                        data: lineData,
                    }
                ],
                barDataList: barDataList,
                dateList: dateList
            } as unknown as CommodityDetailLineChartProps;
        } catch (err) {
            console.error(err);
            return INITIAL_CHART_DATA;
        }
    }, [result, req.chartType, id]);

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

    // 최종 commodityChartData = base + WS overlay 머지
    const commodityChartData = useMemo<CommodityDetailLineChartProps>(() => ({
        ...baseCommodityChartData,
        ...liveChartOverlay,
    }), [baseCommodityChartData, liveChartOverlay]);

    const [toggle, setToggle] = useState('DAY');
    const [formats, setFormats] = useState('line');
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

            const commodityList = data.data.map((res: CommodityStreamRes) => {
                const values = res.values;
                return {
                    code: res.item,
                    value: values["10"],
                    change: values["11"],
                    fluRt: values["12"],
                    trend: values["25"]
                };
            });

            commodityList.forEach((commodity: CommodityStream) => {
                if (commodity.code === stkCd) {
                    setLiveChartOverlay({
                        value: commodity.value.replace(/^[+-]/, '').toLocaleString(),
                        predPre: commodity.change || '0',
                        fluRt: commodity.fluRt,
                        trend: trendColor(commodity.trend)
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

    const handleFormat = (
        _event: MouseEvent<HTMLElement>,
        newFormats: string,
    ) => {
        if(newFormats !== null) {
            setFormats(newFormats);
        }
    };

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
                <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
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
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {loading ? <Skeleton width={140}/> : commodityChartData.interval}
                                </Typography>
                            </Stack>
                        </CardContent>
                        <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                            <Box sx={{ minWidth: 1200 }}>
                                {loading ? (
                                    <Skeleton variant="rectangular" height={400} sx={{mx: 2, mb: 2, borderRadius: 1}}/>
                                ) : (
                                    <CommodityDetailLineChart {...commodityChartData} />
                                )}
                            </Box>
                        </Box>
                        <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            flexWrap="wrap"
                        >
                            <StyledToggleButtonGroup
                                size="small"
                                value={toggle}
                                exclusive
                                onChange={handleAlignment}
                                aria-label="text alignment"
                            >
                                <ToggleButton
                                    value="MINUTE"
                                    key="MINUTE"
                                    aria-label="MINUTE"
                                    sx={{
                                        padding: 1
                                    }}
                                >
                                    <Select
                                        size="small"
                                        value={minute.current}
                                        onChange={handleOptionChange}
                                        variant="standard"
                                        disableUnderline
                                        sx={{
                                            boxShadow: 'none',
                                            width: 55,
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            padding: '0 8px',
                                            justifyContent: 'center',
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
                            </StyledToggleButtonGroup>

                            <StyledToggleButtonGroup
                                size="small"
                                value={formats}
                                exclusive
                                onChange={handleFormat}
                                aria-label="text formatting"
                            >
                                <ToggleButton value="candle" key="candle" aria-label="candle" disabled>
                                    <CandlestickChartIcon />
                                </ToggleButton>
                                <ToggleButton value="line" key="line" aria-label="line">
                                    <StackedLineChartIcon />
                                </ToggleButton>
                            </StyledToggleButtonGroup>
                        </Box>
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