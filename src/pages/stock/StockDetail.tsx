import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import {useState, MouseEvent, useRef, useEffect, ReactElement, JSX} from "react";
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import HelpIcon from '@mui/icons-material/Help';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup, {
    toggleButtonGroupClasses,
} from '@mui/material/ToggleButtonGroup';
import {Select, SelectChangeEvent, Slider, Tooltip} from "@mui/material";
import {styled} from "@mui/material/styles";
import MenuItem from "@mui/material/MenuItem";
import {useParams} from "react-router-dom";
import {
    StockChartType,
    StockDetailReq,
    StockStream,
    StockStreamReq,
    StockStreamRes,
} from "../../type/StockType.ts";
import StockDetailLineChart, {CustomStockDetailLineChartProps} from "../../components/StockDetailLineChart.tsx";
import {fetchStockDetail, fetchStockStream} from "../../api/stock/StockApi.ts";
import InvestorBarChart from "../../components/InvestorBarChart.tsx";
import RemoveIcon from "@mui/icons-material/Remove";
import CheckIcon from "@mui/icons-material/Check";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import DoNotDisturbIcon from "@mui/icons-material/DoNotDisturb";
import CustomDataTable from "../../components/CustomDataTable.tsx";
import {GridColDef, GridRowsProp} from "@mui/x-data-grid";
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

interface StockRangeProps {
    value: number;
    label: ReactElement;
}

const StockDetail = () => {
    const { id } = useParams();
    const [req, setReq] = useState<StockDetailReq>({
        stk_cd: id || "",
        chart_type: StockChartType.DAY
    });

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    const [toggle, setToggle] = useState('DAY');
    const [formats, setFormats] = useState('line');
    const minute = useRef('1');

    const [stockChartData, setStockChartData] = useState<CustomStockDetailLineChartProps>({
        id: '-',
        title: '-',
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

    useEffect(() => {
        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async() => {
            const items = await stockDetail(req);
            const stockStreamReq: StockStreamReq = {
                items: items,
            }

            const marketInfo = await timeNow();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            if (marketInfo.isMarketOpen) {
                await stockStream(stockStreamReq);
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        await stockStream(stockStreamReq);
                        socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                stockDetail(req);
                interval = setInterval(() => {
                    stockDetail(req);
                }, (60 * 1000));
            }, waitTime + 200);
        })();

        return () => {
            socket?.close();
            clearInterval(socketTimeout);
            clearTimeout(chartTimeout);
            clearInterval(interval);
        }
    }, [req])

    const stockDetail = async (req: StockDetailReq): Promise<Array<string>> => {
        try {
            const data = await fetchStockDetail(req);

            console.log(data);

            const { stockInfo, stockChartList, stockInvestorList } = data.result;

            let dateList;
            let lineData, barDataList;

            switch (req.chart_type) {
                case StockChartType.MINUTE_1:
                case StockChartType.MINUTE_3:
                case StockChartType.MINUTE_5:
                case StockChartType.MINUTE_10:
                case StockChartType.MINUTE_30: {
                    dateList = stockChartList.map((item: { dt: string }) => {
                        return `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)} ${item.dt.slice(8, 10)}:${item.dt.slice(10, 12)}`
                    }).reverse();

                    lineData = stockChartList.map((item: { cur_prc: string }) => item.cur_prc.replace(/^[+-]/, '')).reverse();
                    barDataList = stockChartList.map((item: { trde_qty: string }) => item.trde_qty).reverse();

                    break;
                }
                case StockChartType.DAY:
                case StockChartType.WEEK:
                case StockChartType.MONTH:
                case StockChartType.YEAR: {
                    dateList = stockChartList.map((item: { dt: string }) => {
                        return `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                    }).reverse();

                    lineData = stockChartList.map((item: { cur_prc: string }) => item.cur_prc).reverse();
                    barDataList = stockChartList.map((item: { trde_qty: string }) => item.trde_qty.slice(0, 3)).reverse();

                    break;
                }
            }

            const year = stockInfo.tm.substring(0, 4);
            const month = stockInfo.tm.substring(4, 6);
            const day = stockInfo.tm.substring(6, 8);
            const hour = stockInfo.tm.substring(8, 10);
            const minute = stockInfo.tm.substring(10, 12);
            let today;
            if(Number(hour) >= 20 || Number(hour) < 8) {
                today = `${year}.${month}.${day} 장마감`;
            } else {
                today = `${year}.${month}.${day} ${hour}:${minute}`;
            }

            setStockChartData({
                id: stockInfo.stk_cd,
                title: stockInfo.stk_nm,
                value: Number(stockInfo.cur_prc.replace(/^[+-]/, '')).toLocaleString(),
                fluRt: stockInfo.flu_rt,
                openPric: parseFloat(stockInfo.open_pric),
                interval: today,
                trend: stockInfo.pre_sig === '5' ? 'down' : stockInfo.pre_sig === '2' ? 'up' : 'neutral',
                nxtEnable: stockInfo.nxtEnable,
                seriesData: [
                    {
                        id: id,
                        showMark: false,
                        curve: 'linear',
                        area: true,
                        stackOrder: 'ascending',
                        color: 'grey',
                        data: lineData
                    }
                ],
                barDataList: barDataList,
                dateList: dateList
            });

            setInfo({
                trde_qty: Number(stockInfo.trde_qty),
                trde_prica: Number(stockInfo.trde_prica.substring(0, 7)),
                open_pric: Number(stockInfo.open_pric.replace(/^[+-]/, '')),
                cur_prc: Number(stockInfo.cur_prc.replace(/^[+-]/, '')),
                _250hgst: Number(stockInfo._250hgst.replace(/^[+-]/, '')),
                _250lwst: Number(stockInfo._250lwst.replace(/^[+-]/, '')),
                per: Number(stockInfo.per),
                eps: Number(stockInfo.eps),
                roe: Number(stockInfo.roe),
                pbr: Number(stockInfo.pbr)
            });

            setBarData([
                Number(stockInvestorList[0].ind_invsr.toLocaleString()),
                Number(stockInvestorList[0].frgnr_invsr.toLocaleString()),
                Number(stockInvestorList[0].orgn.toLocaleString())
            ]);

            const message = {
                ...checkInvestor(
                    stockInfo.stk_nm,
                    stockInvestorList[0].frgnr_invsr,
                    stockInvestorList[0].orgn
                )
            };

            setMessage(message);

            const dayMin = Number(stockInfo.low_pric.replace(/^[+-]/, ''));
            const dayMax = Number(stockInfo.high_pric.replace(/^[+-]/, ''));

            setDayRange([
                {
                    value: dayMin,
                    label: <p>1일 최저가 <br />{dayMin.toLocaleString()}</p>
                },
                {
                    value: dayMax,
                    label: <p>1일 최고가 <br />{dayMax.toLocaleString()}</p>
                }
            ]);

            const yearMin = Number(stockInfo._250lwst.replace(/^[+-]/, ''));
            const yearMax = Number(stockInfo._250hgst.replace(/^[+-]/, ''));

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

            const investor = stockInvestorList.map((item: {
                dt: string; ind_invsr: string; frgnr_invsr: string; orgn: string; fnnc_invt: string; insrnc: string; etc_fnnc: string; invtrt: string; samo_fund: string; penfnd_etc: string; bank: string; etc_corp: string; natfor: string;
            }) => {
                return {
                    id: item.dt,
                    dt: `${(item.dt).substring(0, 4)}-${(item.dt).substring(4, 6)}-${(item.dt).substring(6, 8)}`,
                    ind_invsr: Number(item.ind_invsr),
                    frgnr_invsr: Number(item.frgnr_invsr),
                    orgn: Number(item.orgn),
                    fnnc_invt: Number(item.fnnc_invt),
                    insrnc: Number(item.insrnc),
                    etc_fnnc: Number(item.etc_fnnc),
                    invtrt: Number(item.invtrt),
                    samo_fund: Number(item.samo_fund),
                    penfnd_etc: Number(item.penfnd_etc),
                    bank: Number(item.bank),
                    etc_corp: Number(item.etc_corp),
                    natfor: Number(item.natfor),
                }
            });

            setRow(investor);

            return [stockInfo.stk_cd];
        } catch(error) {
            console.error(error);

            return [];
        }
    }

    const timeNow = async () => {
        try {
            const startTime = Date.now();
            const data = await fetchTimeNow({
                marketType: MarketType.STOCK
            });

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            const { time, isMarketOpen, startMarketTime, marketType } = data.result;

            if (marketType !== MarketType.STOCK) {
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

    const stockStream = async (req: StockStreamReq) => {
        try {
            const data = await fetchStockStream(req);

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
                const stockList = data.data.map((res: StockStreamRes) => {
                    const values = res.values;
                    return {
                        code: res.item,
                        value: values["10"],
                        fluRt: values["12"],
                        trend: values["25"],
                    };
                });

                stockList.forEach((stock: StockStream) => {
                    if(stock.code === req.stk_cd) {
                        setStockChartData((old) => ({
                            ...old,
                            value: Number(stock.value.replace(/^[+-]/, '')).toLocaleString(),
                            fluRt: stock.fluRt,
                            trend: stock.trend === '5' ? 'down' : stock.trend === '2' ? 'up' : 'neutral',
                        }));
                    }
                });
            }
        };

        return socket;
    }

    interface StockInfoProps {
        trde_qty: number;
        trde_prica: number;
        open_pric: number;
        cur_prc: number;
        _250hgst: number;
        _250lwst: number;
        per: number;
        eps: number;
        roe: number;
        pbr: number;
    }

    const [info, setInfo] = useState<StockInfoProps>({
        trde_qty: 0,
        trde_prica: 0,
        open_pric: 0,
        cur_prc: 0,
        _250hgst: 0,
        _250lwst: 0,
        per: 0,
        eps: 0,
        roe: 0,
        pbr: 0
    });

    const [barData, setBarData] = useState<Array<number>>([0, 0, 0]);

    interface MessageProps {
        icon: JSX.Element,
        title: string,
        message: string
    }
    const [message, setMessage] = useState<MessageProps>({
        icon: <RemoveIcon />,
        title: '-',
        message: '-'
    });

    const [dayRange, setDayRange] = useState<StockRangeProps[]>([
        {
            value: 0.0,
            label: <p>1일 최저가 <br />0</p>
        },
        {
            value: 0.0,
            label: <p>1일 최고가 <br />0</p>,
        }
    ]);

    const [yearRange, setYearRange] = useState<StockRangeProps[]>([
        {
            value: 0,
            label: <p>52주 최저가 <br />0</p>,
        },
        {
            value: 0,
            label: <p>52주 최고가 <br />0</p>,
        }
    ]);

    const [row, setRow] = useState<GridRowsProp[]>([]);
    const columns: GridColDef[] = [
        {
            field: 'dt',
            headerName: '날짜',
            flex: 1,
            minWidth: 100,
            maxWidth: 120
        },
        {
            field: 'ind_invsr',
            headerName: '개인',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderTrade(params.value as number),
        },
        {
            field: 'frgnr_invsr',
            headerName: '외국인',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderTrade(params.value as number),
        },
        {
            field: 'orgn',
            headerName: '기관계',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderTrade(params.value as number),
        },
        {
            field: 'fnnc_invt',
            headerName: '금융투자',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderTrade(params.value as number),
        },
        {
            field: 'insrnc',
            headerName: '보험',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderTrade(params.value as number),
        },
        {
            field: 'etc_fnnc',
            headerName: '기타금융',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderTrade(params.value as number),
        },
        {
            field: 'invtrt',
            headerName: '투신',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderTrade(params.value as number),
        },
        {
            field: 'samo_fund',
            headerName: '사모펀드',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderTrade(params.value as number),
        },
        {
            field: 'penfnd_etc',
            headerName: '연기금등',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderTrade(params.value as number),
        },
        {
            field: 'bank',
            headerName: '은행',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderTrade(params.value as number),
        },
        {
            field: 'etc_corp',
            headerName: '기타법인',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderTrade(params.value as number),
        },
        {
            field: 'natfor',
            headerName: '내외국인',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderTrade(params.value as number),
        }
    ];

    const labelColors = {
        up: 'error' as const,
        down: 'info' as const,
        neutral: 'default' as const,
    };

    const color = labelColors[stockChartData.trend];
    const trendValues = { up: `${stockChartData.fluRt}%`, down: `${stockChartData.fluRt}%`, neutral: `${stockChartData.fluRt}%` };

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
                chart_type: newAlignment as StockChartType
            })
        }
    };

    function handleOptionChange(event: SelectChangeEvent) {
        minute.current = event.target.value as string

        const value = 'MINUTE_' + event.target.value;

        setReq({
            ...req,
            chart_type: value as StockChartType
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

        if (orgn > 0 && frgnr > 0) {
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

    function renderTrade(trade: number) {
        const text = trade.toLocaleString()

        return (
            <span style={{color: trade == 0 ? 'black' : trade > 0 ? 'red' : 'blue'}}>
                {trade > 0 ? `+${text}` : `${text}`}
            </span>
        )
    }

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                주식 상세
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
                                    {stockChartData.title}
                                </Typography>
                                {stockChartData.nxtEnable === 'Y' &&
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        NXT
                                        <Tooltip title="넥스트 트레이드는 오전 8시부터 오후 8시까지 거래할 수 있는 대체 거래소입니다.">
                                            <HelpIcon sx={{ fontSize: 'inherit', verticalAlign: 'middle' }} />
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
                                        {stockChartData.value}
                                    </Typography>
                                    <Chip size="small" color={color} label={trendValues[stockChartData.trend]} />
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {stockChartData.interval}
                                </Typography>
                            </Stack>
                        </CardContent>
                        <StockDetailLineChart {...stockChartData} />
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
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        거래량
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {info.trde_qty.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        거래대금 (백만원)
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {info.trde_prica.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        시가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {info.open_pric.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        현재가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {info.cur_prc.toLocaleString()}
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
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        per
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {info.per.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        eps
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {info.eps.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        roe
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {info.roe.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        pbr
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {info.pbr.toLocaleString()}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        당일 투자자별 순매수(주)
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
                                value={Number(info.cur_prc)}
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
                                value={Number(info.cur_prc)}
                                valueLabelDisplay="auto"
                                disabled
                                max={yearRange[1].value}
                                min={yearRange[0].value}
                                marks={yearRange}
                            />
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 12 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        일별 투자자별 순매수
                    </Typography>
                    <CustomDataTable rows={row} columns={columns} pageSize={20} />
                </Grid>
            </Grid>
        </Box>
    )
}

export default StockDetail;