import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import {JSX, MouseEvent, ReactElement, useEffect, useRef, useState} from "react";
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup, {toggleButtonGroupClasses,} from '@mui/material/ToggleButtonGroup';
import {styled} from "@mui/material/styles";
import {Select, SelectChangeEvent, Slider} from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import IndexDetailLineChart, {CustomIndexDetailLineChartProps} from "../../components/IndexDetailLineChart.tsx";
import InvestorBarChart from "../../components/InvestorBarChart.tsx";
import {fetchIndexDetail, fetchIndexDetailStream, fetchIndexListStream} from "../../api/index/IndexApi.ts";
import {ChartType, indexDetailReq, indexDetailSteamReq} from "../../type/IndexType.ts";
import {GridColDef} from "@mui/x-data-grid";
import RemoveIcon from "@mui/icons-material/Remove";
import CheckIcon from "@mui/icons-material/Check";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import DoNotDisturbIcon from "@mui/icons-material/DoNotDisturb";
import {useParams} from "react-router-dom";
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

interface IndexRangeProps {
    value: number;
    label: ReactElement;
}

const IndexDetail = () => {
    const { id } = useParams();

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);
    const [req, setReq] = useState<indexDetailReq>({
        inds_cd: id,
        chart_type: ChartType.DAY
    });

    const [sectChartData, setSectChartData] = useState<CustomIndexDetailLineChartProps>({
        id: '-',
        title: '-',
        value: '-',
        fluRt: '0',
        openPric: 0,
        interval: '-',
        trend: 'neutral',
        seriesData: [
            {
                id: 'KOSPI',
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

    const [barData, setBarData] = useState<Array<number>>([0, 0, 0]);

    const [info, setInfo] = useState<object>({
        trde_qty: 0,
        trde_prica: 0,
        open_pric: 0,
        cur_prc: 0,
        _52wk_lwst_pric: 0,
        _52wk_hgst_pric: 0
    });

    const [dayRange, setDayRange] = useState<IndexRangeProps[]>([
        {
            value: 0.0,
            label: <p>1일 최저가 <br />0</p>
        },
        {
            value: 0.0,
            label: <p>1일 최고가 <br />0</p>,
        }
    ]);

    const [yearRange, setYearRange] = useState<IndexRangeProps[]>([
        {
            value: 0.0,
            label: <p>52주 최저가 <br />0</p>,
        },
        {
            value: 0.0,
            label: <p>52주 최고가 <br />0</p>,
        }
    ]);

    useEffect(() => {
        indexDetail(req);

        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            const marketInfo = await timeNow();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            if (marketInfo.isMarketOpen) {
                await indexDetailStream(req);
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        await indexDetailStream(req);
                        socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                indexDetail(req);
                interval = setInterval(() => {
                    indexDetail(req);
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

    const indexDetail = async (req: indexDetailReq) => {
        try {
            const data = await fetchIndexDetail(req);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);

            const {
                sectPriceRes, chartListRes, sectInvestor
            } = data.result;

            let year, month, day, minute, second;
            let dateList;
            let lineData, barDataList;

            switch (req.chart_type) {
                case ChartType.MINUTE_1:
                case ChartType.MINUTE_3:
                case ChartType.MINUTE_5:
                case ChartType.MINUTE_10:
                case ChartType.MINUTE_30: {
                    year = chartListRes.inds_min_pole_qry[0].cntr_tm.substring(0, 4);
                    month = chartListRes.inds_min_pole_qry[0].cntr_tm.substring(4, 6);
                    day = chartListRes.inds_min_pole_qry[0].cntr_tm.substring(6, 8);
                    minute = sectPriceRes.inds_cur_prc_tm[0].tm_n.substring(0, 2);
                    second = sectPriceRes.inds_cur_prc_tm[0].tm_n.substring(2, 4);

                    dateList = chartListRes.inds_min_pole_qry.map(item => {
                        return `${item.cntr_tm.slice(0, 4)}.${item.cntr_tm.slice(4, 6)}.${item.cntr_tm.slice(6, 8)} ${item.cntr_tm.slice(8, 10)}:${item.cntr_tm.slice(10, 12)}`
                    }).reverse();

                    lineData = chartListRes.inds_min_pole_qry.map(item => parsePrice(item.cur_prc.replace(/^[+-]/, ''))).reverse();
                    barDataList = chartListRes.inds_min_pole_qry.map(item => item.trde_qty).reverse();

                    break;
                }
                case ChartType.DAY: {
                    year = chartListRes.inds_dt_pole_qry[0].dt.substring(0, 4);
                    month = chartListRes.inds_dt_pole_qry[0].dt.substring(4, 6);
                    day = chartListRes.inds_dt_pole_qry[0].dt.substring(6, 8);
                    minute = sectPriceRes.inds_cur_prc_tm[0].tm_n.substring(0, 2);
                    second = sectPriceRes.inds_cur_prc_tm[0].tm_n.substring(2, 4);

                    dateList = chartListRes.inds_dt_pole_qry.map(item => {
                        return `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                    }).reverse();

                    lineData = chartListRes.inds_dt_pole_qry.map(item => parsePrice(item.cur_prc)).reverse();
                    barDataList = chartListRes.inds_dt_pole_qry.map(item => item.trde_qty.slice(0, 3)).reverse();

                    break;
                }
                case ChartType.WEEK: {
                    year = chartListRes.inds_stk_pole_qry[0].dt.substring(0, 4);
                    month = chartListRes.inds_stk_pole_qry[0].dt.substring(4, 6);
                    day = chartListRes.inds_stk_pole_qry[0].dt.substring(6, 8);
                    minute = sectPriceRes.inds_cur_prc_tm[0].tm_n.substring(0, 2);
                    second = sectPriceRes.inds_cur_prc_tm[0].tm_n.substring(2, 4);

                    dateList = chartListRes.inds_stk_pole_qry.map(item => {
                        return `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                    }).reverse();

                    lineData = chartListRes.inds_stk_pole_qry.map(item => parsePrice(item.cur_prc)).reverse();
                    barDataList = chartListRes.inds_stk_pole_qry.map(item => item.trde_qty.slice(0, 3)).reverse();

                    break;
                }
                case ChartType.MONTH: {
                    year = chartListRes.inds_mth_pole_qry[0].dt.substring(0, 4);
                    month = chartListRes.inds_mth_pole_qry[0].dt.substring(4, 6);
                    day = chartListRes.inds_mth_pole_qry[0].dt.substring(6, 8);
                    minute = sectPriceRes.inds_cur_prc_tm[0].tm_n.substring(0, 2);
                    second = sectPriceRes.inds_cur_prc_tm[0].tm_n.substring(2, 4);

                    dateList = chartListRes.inds_mth_pole_qry.map(item => {
                        return `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                    }).reverse();

                    lineData = chartListRes.inds_mth_pole_qry.map(item => parsePrice(item.cur_prc)).reverse();
                    barDataList = chartListRes.inds_mth_pole_qry.map(item => item.trde_qty.slice(0, 3)).reverse();

                    break;
                }
                case ChartType.YEAR: {
                    year = chartListRes.inds_yr_pole_qry[0].dt.substring(0, 4);
                    month = chartListRes.inds_yr_pole_qry[0].dt.substring(4, 6);
                    day = chartListRes.inds_yr_pole_qry[0].dt.substring(6, 8);
                    minute = sectPriceRes.inds_cur_prc_tm[0].tm_n.substring(0, 2);
                    second = sectPriceRes.inds_cur_prc_tm[0].tm_n.substring(2, 4);

                    dateList = chartListRes.inds_yr_pole_qry.map(item => {
                        return `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                    }).reverse();

                    lineData = chartListRes.inds_yr_pole_qry.map(item => parsePrice(item.cur_prc)).reverse();
                    barDataList = chartListRes.inds_yr_pole_qry.map(item => item.trde_qty.slice(0, 3)).reverse();

                    break;
                }
            }

            let id = chartListRes.inds_cd;
            let title = id === '201' ? 'KOSPI 200' : sectInvestor.inds_netprps.find(it => it.inds_cd == id).inds_nm

            let today;

            if(minute === '88' && second === '88') {
                today = `${year}.${month}.${day} 장마감`;
            }else {
                today = `${year}.${month}.${day} ${minute}:${second}`;
            }

            setSectChartData({
                id: id,
                title: title,
                value: sectPriceRes.cur_prc.replace(/^[+-]/, ''),
                fluRt: sectPriceRes.flu_rt,
                openPric: parseFloat(sectPriceRes.open_pric.replace(/^[+-]/, '')),
                interval: today,
                trend: sectPriceRes.pred_pre_sig === '5' ? 'down' : sectPriceRes.pred_pre_sig === '2' ? 'up' : 'neutral',
                seriesData: [
                    {
                        id: id,
                        showMark: false,
                        curve: 'linear',
                        area: true,
                        stackOrder: 'ascending',
                        color: sectPriceRes.pred_pre_sig === '2' ? 'red' : 'blue',
                        data: lineData,
                    }
                ],
                barDataList: barDataList,
                dateList: dateList
            });

            const dayMin = sectPriceRes['low_pric'].replace(/^[+-]/, '');
            const dayMax = sectPriceRes['high_pric'].replace(/^[+-]/, '')

            setDayRange([
                {
                    value: parseFloat(dayMin),
                    label: <p>1일 최저가 <br />{dayMin}</p>
                },
                {
                    value: parseFloat(dayMax),
                    label: <p>1일 최고가 <br />{dayMax}</p>
                }
            ]);

            const yearMin = sectPriceRes['52wk_lwst_pric'].replace(/^[+-]/, '');
            const yearMax = sectPriceRes['52wk_hgst_pric'].replace(/^[+-]/, '')

            setYearRange([
                {
                    value: parseFloat(yearMin),
                    label: <p>52주 최저가 <br />{yearMin}</p>
                },
                {
                    value: parseFloat(yearMax),
                    label: <p>52주 최고가 <br />{yearMax}</p>
                }
            ]);

            setInfo({
                trde_qty: `${sectPriceRes.trde_qty.substring(0, 1)}억 ${sectPriceRes.trde_qty.substring(1, 5)}만주`,
                trde_prica: `${Number(sectPriceRes.trde_prica).toLocaleString()}`,
                open_pric: parseFloat(sectPriceRes.open_pric.replace(/^[+-]/, '')),
                cur_prc: sectPriceRes.cur_prc.replace(/^[+-]/, ''),
                _52wk_lwst_pric: yearMin,
                _52wk_hgst_pric: yearMax
            })

            setBarData([sectInvestor.inds_netprps[0].ind_netprps, sectInvestor.inds_netprps[0].orgn_netprps, sectInvestor.inds_netprps[0].frgnr_netprps])

            let message = {
                ...checkInvestor(
                    title,
                    sectInvestor.inds_netprps[0].orgn_netprps,
                    sectInvestor.inds_netprps[0].frgnr_netprps
                )
            };

            setMessage(message);
        }catch(error) {
            console.error(error);
        }
    }

    const timeNow = async () => {
        try {
            const startTime = Date.now();
            const data = await fetchTimeNow({
                marketType: MarketType.INDEX
            });

            if(data.code !== "0000") {
                throw new Error(data.msg);
            }

            const { time, isMarketOpen, startMarketTime, marketType } = data.result

            if(marketType !== MarketType.INDEX) {
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
        }catch (error) {
            console.error(error);
        }
    }

    const indexDetailStream = async (req: indexDetailSteamReq) => {
        try {
            const data = await fetchIndexDetailStream(req);

            console.log(data);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }
        }catch (error) {
            console.error(error);
        }
    }

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                let item;

                const parsed = data.data.map((entry) => {
                    const values = entry.values;
                    item = entry.item;
                    return {
                        code: entry.item, // ex: "001"
                        value: values["10"], // 현재가
                        change: values["11"], // 전일 대비
                        fluRt: values["12"],   // 등락률
                        trend: values["25"],   // 등락기호
                    };
                });

                parsed.map((data) => {
                    if(item === req.inds_cd) {
                        setSectChartData((prev) => ({
                            ...prev,
                            value: data.value.replace(/^[+-]/, ''),
                            fluRt: data.fluRt,
                            trend: data.trend === '5' ? 'down' : data.trend === '2' ? 'up' : 'neutral',
                        }));
                    }
                });
            }
        };

        return socket;
    }

    const parsePrice = (raw: string)  => {
        if (!raw) return null;
        return (parseInt(raw, 10) / 100).toFixed(2);
    }

    const [toggle, setToggle] = useState('DAY');
    const [formats, setFormats] = useState('line');
    const minute = useRef('1');

    const columns: GridColDef[] = [
        {
            field: 'rank',
            headerName: '날짜',
            flex: 1,
            minWidth: 80,
            maxWidth: 80
        },
        { field: 'stkNm', headerName: '종가', flex: 1, minWidth: 150 },
        {
            field: 'pridStkpcFluRt',
            headerName: '상승',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderStatus(params.value as any),
        },
        {
            field: 'pridStkpcFluRt',
            headerName: '상승률',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderStatus(params.value as any),
        },
        {
            field: 'nettrdeAmt',
            headerName: '합계 순매수',
            flex: 1,
            minWidth: 100,
            valueFormatter: (value: any) => `${value.slice(0, -2).toLocaleString()}억`,
        }
    ];

    const handleFormat = (
        _event: MouseEvent<HTMLElement>,
        newFormats: string,
    ) => {
        if(newFormats !== null) {
            setFormats(newFormats);
        }
    };

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
                chart_type: newAlignment as ChartType
            })
        }
    };

    function handleOptionChange(event: SelectChangeEvent) {
        minute.current = event.target.value as string

        const value = 'MINUTE_' + event.target.value;

        setReq({
            ...req,
            chart_type: value as ChartType
        })
    }

    const labelColors = {
        up: 'error' as const,
        down: 'info' as const,
        neutral: 'default' as const,
    };

    const color = labelColors[sectChartData.trend];
    const trendValues = { up: `${sectChartData.fluRt}%`, down: `${sectChartData.fluRt}%`, neutral: `${sectChartData.fluRt}%` };

    const [message, setMessage] = useState<object>({
        icon: <RemoveIcon />,
        title: '-',
        message: '-'
    });

    function checkInvestor(name: string, orgn: number, frgnr: number): object {
        let message: string;
        let title: string;
        let icon: JSX.Element;

        if(orgn > 0 && frgnr > 0) {
            message = '기관과 외국인이 매수 중입니다.'
            title = `${name} 투자 양호`
            icon = <CheckIcon color="success" />;
        }else if(orgn > 0 && frgnr < 0) {
            message = '기관 매수, 외국인 매도 중입니다.'
            title = `${name} 투자 주의`
            icon = <PriorityHighIcon color="warning" />
        }else if(orgn < 0 && frgnr > 0) {
            message = '기관 매도, 외국인 매수 중입니다.'
            title = `${name} 투자 주의`
            icon = <PriorityHighIcon color="warning" />
        }else {
            message = '기관과 외국인이 매도 중입니다.'
            title = `${name} 투자 위험`
            icon = <DoNotDisturbIcon color="error" />
        }

        return {
            message,
            title,
            icon,
        }
    }

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                지수 상세
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
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                {sectChartData.title}
                            </Typography>
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
                                        {sectChartData.value}
                                    </Typography>
                                    <Chip size="small" color={color} label={trendValues[sectChartData.trend]} />
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {sectChartData.interval}
                                </Typography>
                            </Stack>
                        </CardContent>
                        <IndexDetailLineChart {...sectChartData} />
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
                                <ToggleButton value="YEAR" key="YEAR" aria-label="YEAR">년</ToggleButton>
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
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        거래량
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {info.trde_qty}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        거래대금 (백만원)
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {info.trde_prica}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        시가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {info.open_pric}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        현재가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {info.cur_prc}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        52주 최저가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {info._52wk_lwst_pric}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        52주 최고가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {info._52wk_hgst_pric}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        당일 투자자별 순매수(억)
                    </Typography>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <InvestorBarChart data={barData} />
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        요약
                    </Typography>
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
                <Grid size={{ xs: 12, md: 4 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        일별 시세
                    </Typography>
                    <Card variant="outlined" sx={{ width: '100%', overflow: 'visible' }}>
                        <CardContent sx={{ overflow: 'visible', px: 5, height: 100 }}>
                            <Slider
                                aria-label="Custom marks"
                                track={false}
                                value={parseFloat(info.cur_prc)}
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
                                value={parseFloat(info.cur_prc)}
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

export default IndexDetail;