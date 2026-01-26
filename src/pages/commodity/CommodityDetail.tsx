import {JSX, MouseEvent, ReactElement, useEffect, useRef, useState} from "react";
import {useParams} from "react-router-dom";
import {Box, Select, SelectChangeEvent, Slider, Tooltip} from "@mui/material";
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
    CommodityDetailReq, CommodityDetailSteamReq,
    CommodityStream,
    CommodityStreamRes
} from "../../type/CommodityType.ts";
import {fetchCommodityDetail, fetchCommodityDetailStream} from "../../api/commodity/CommodityApi.ts";
import ErrorIcon from "@mui/icons-material/Error";
import HelpIcon from "@mui/icons-material/Help";
import CommodityDetailLineChart, {CommodityDetailLineChartProps} from "../../components/CommodityDetailLineChart.tsx";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";

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

const CommodityDetail = () => {
    const { id } = useParams();

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);
    const [req, setReq] = useState<CommodityDetailReq>({
        stkCd: id ?? "",
        chartType: CommodityChartType.DAY
    });

    const [commodityChartData, setCommodityChartData] = useState<CommodityDetailLineChartProps>({
        id: '-',
        title: '-',
        orderWarning: "0",
        value: '-',
        fluRt: '0',
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
    });

    const [dayRange, setDayRange] = useState<CommodityRangeProps[]>([
        {
            value: 0,
            label: <p>1일 최저가 <br />0</p>
        },
        {
            value: 0,
            label: <p>1일 최고가 <br />0</p>,
        }
    ]);

    const [yearRange, setYearRange] = useState<CommodityRangeProps[]>([
        {
            value: 0,
            label: <p>52주 최저가 <br />0</p>,
        },
        {
            value: 0,
            label: <p>52주 최고가 <br />0</p>,
        }
    ]);

    interface CommodityInfoProps {
        trdeQty: number;
        trdePrica: number;
        openPric: number;
        curPrc: number;
        _250lwst: number;
        _250hgst: number;
    }

    const [info, setInfo] = useState<CommodityInfoProps>({
        trdeQty: 0,
        trdePrica: 0,
        openPric: 0,
        curPrc: 0,
        _250hgst: 0,
        _250lwst: 0,
    });

    const [barData, setBarData] = useState<Array<number>>([0, 0, 0]);

    const [message, setMessage] = useState<MessageProps>({
        icon: <RemoveIcon />,
        title: '-',
        message: '-'
    });

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

    useEffect(() => {
        commodityDetail(req);

        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            const marketInfo = await timeNow();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            if (marketInfo.isMarketOpen) {
                await commodityDetailStream(req);
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        await commodityDetailStream(req);
                        socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                commodityDetail(req);
                interval = setInterval(() => {
                    commodityDetail(req);
                }, (60 * 1000));
            }, waitTime + 200);
        })();

        return () => {
            socket?.close();
            clearInterval(socketTimeout);
            clearTimeout(chartTimeout);
            clearInterval(interval);
        }
    }, [req]);

    const commodityDetail = async (req: CommodityDetailReq) => {
        try {
            const data = await fetchCommodityDetail(req);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);

            const {
                commodityInfo, commodityChartList
            } = data.result;

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
            }

            const year = commodityInfo.tm.substring(0, 4);
            const month = commodityInfo.tm.substring(4, 6);
            const day = commodityInfo.tm.substring(6, 8);
            const hour = commodityInfo.tm.substring(8, 10);
            const minute = commodityInfo.tm.substring(10, 12);

            let today;
            if(Number(hour) >= 20 || Number(hour) < 8) {
                today = `${year}.${month}.${day} 장마감`;
            } else {
                today = `${year}.${month}.${day} ${hour}:${minute}`;
            }

            setCommodityChartData({
                id: commodityInfo.stkCd,
                title: commodityInfo.stkNm,
                orderWarning: commodityInfo.orderWarning,
                value: Number(commodityInfo.curPrc.replace(/^[+-]/, '')).toLocaleString(),
                fluRt: commodityInfo.fluRt,
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
            });

            const dayMin = commodityInfo['lowPric'].replace(/^[+-]/, '');
            const dayMax = commodityInfo['highPric'].replace(/^[+-]/, '')

            setDayRange([
                {
                    value: Number(dayMin),
                    label: <p>1일 최저가 <br />{Number(dayMin).toLocaleString()}</p>
                },
                {
                    value: Number(dayMax),
                    label: <p>1일 최고가 <br />{Number(dayMax).toLocaleString()}</p>
                }
            ]);

            const yearMin = Number(commodityInfo._250lwst.replace(/^[+-]/, ''));
            const yearMax = Number(commodityInfo._250hgst.replace(/^[+-]/, ''));

            setYearRange([
                {
                    value: yearMin,
                    label: <p>52주 최저가 <br />{yearMin.toLocaleString()}</p>
                },
                {
                    value: yearMax,
                    label: <p>52주 최고가 <br />{yearMax.toLocaleString()}</p>
                }
            ]);

            setInfo({
                trdeQty: Number(commodityInfo.trdeQty),
                trdePrica: Number(commodityInfo.trdePrica),
                openPric: Number(commodityInfo.openPric.replace(/^[+-]/, '')),
                curPrc: Number(commodityInfo.curPrc.replace(/^[+-]/, '')),
                _250hgst: Number(commodityInfo._250hgst.replace(/^[+-]/, '')),
                _250lwst: Number(commodityInfo._250lwst.replace(/^[+-]/, '')),
            });

            setBarData([commodityInfo.indNetprps, commodityInfo.frgnrNetprps, commodityInfo.orgnNetprps])

            const message = {
                ...checkInvestor(
                    commodityInfo.stkNm,
                    commodityInfo.frgnrNetprps,
                    commodityInfo.orgnNetprps
                )
            };

            setMessage(message);
        } catch (err) {
            console.error(err);
        }
    }

    const timeNow = async () => {
        try {
            const startTime = Date.now();
            const data = await fetchTimeNow({
                marketType: MarketType.COMMODITY
            });

            if(data.code !== "0000") {
                throw new Error(data.msg);
            }

            const { time, isMarketOpen, startMarketTime, marketType } = data.result

            if (marketType !== MarketType.COMMODITY) {
                throw new Error(data.msg);
            }

            const endTime = Date.now();
            const delayTime = endTime - startTime;

            const revisionServerTime = time + delayTime / 2; // startTime과 endTime 사이에 API 응답을 받기 때문에 2를 나눠서 보정

            chartTimer.current = revisionServerTime - endTime;

            if(!isMarketOpen) {
                marketTimer.current = startMarketTime - revisionServerTime;
            }

            return {
                ...data.result
            }
        } catch (error) {
            console.error(error);
        }
    }

    const commodityDetailStream = async (req: CommodityDetailSteamReq) => {
        try {
            const data = await fetchCommodityDetailStream(req);

            console.log(data);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }
        } catch (error) {
            console.log(error);
        }
    }

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.trnm === "REAL" && Array.isArray(data.data)) {
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
                    if(commodity.code === req.stkCd) {
                        setCommodityChartData((prev) => ({
                            ...prev,
                            value: commodity.value.replace(/^[+-]/, '').toLocaleString(),
                            fluRt: commodity.fluRt,
                            trend: trendColor(commodity.trend)
                        }));
                    }
                });
            }
        }

        return socket;
    }

    const trendColor = (value: string) => {
        return ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';
    }

    const chartColor = (value: string) => {
        return ["1", "2"].includes(value) ? 'red' : ["4", "5"].includes(value) ? 'blue' : 'grey';
    }

    interface MessageProps {
        icon: JSX.Element,
        title: string,
        message: string
    }

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

        return {
            message,
            title,
            icon,
        }
    }

    const handleAlignment = (
        _event: MouseEvent<HTMLElement>,
        newAlignment: string,
    ) => {
        if(newAlignment !== null) {
            setToggle(newAlignment);

            if(newAlignment === 'MINUTE') {
                newAlignment = newAlignment + '_' + minute.current;
            }

            console.log(newAlignment);

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
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                원자재 상세
            </Typography>
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
                                    {commodityChartData.title}
                                    {commodityChartData.orderWarning !== '0' &&
                                        <Tooltip title={orderWarningMsg(commodityChartData.orderWarning)} placement="right">
                                            <ErrorIcon color="error" sx={{ fontSize: 'inherit', verticalAlign: 'middle', ml: "1px", mb: "3px" }} />
                                        </Tooltip>
                                    }
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
                                        {commodityChartData.value}
                                    </Typography>
                                    <Chip size="small" color={color} label={trendValues[commodityChartData.trend]} />
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {commodityChartData.interval}
                                </Typography>
                            </Stack>
                        </CardContent>
                        <CommodityDetailLineChart {...commodityChartData} />
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
                                        {info.trdeQty.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        거래대금 (백만원)
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {info.trdePrica.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        시가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {info.openPric.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        현재가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {info.curPrc.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        52주 최저가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {info._250lwst.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        52주 최고가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {info._250hgst.toLocaleString()}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        당일 투자자별 순매수(주)
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card variant="outlined" sx={{ width: '100%' }}>
                                <CardContent>
                                    <InvestorBarChart data={barData} />
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card variant="outlined" sx={{ width: '100%' }}>
                                {message.icon}
                                <CardContent>
                                    <Typography gutterBottom variant="h5" component="div">
                                        {message.title}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                        {message.message}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        일별 시세
                    </Typography>
                    <Card variant="outlined" sx={{ width: '100%', overflow: 'visible' }}>
                        <CardContent sx={{ overflow: 'visible', px: 5, height: 100 }}>
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
                        </CardContent>
                        <CardContent sx={{ overflow: 'visible', px: 5, height: 100 }}>
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
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    )
}

export default CommodityDetail;