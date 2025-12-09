import {JSX, MouseEvent, ReactElement, useEffect, useRef, useState} from "react";
import {useParams} from "react-router-dom";
import {ChartType, GoldDetailReq} from "../../type/GoldType.ts";
import GoldDetailLineChart, {CustomGoldDetailLineChartProps} from "../../components/GoldDetailLineChart.tsx";
import {fetchGoldDetail} from "../../api/gold/GoldApi.ts";
import {Box, Select, SelectChangeEvent, Slider} from "@mui/material";
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
import IndexDetailLineChart from "../../components/IndexDetailLineChart.tsx";
import ToggleButton from "@mui/material/ToggleButton";
import MenuItem from "@mui/material/MenuItem";
import {styled} from "@mui/material/styles";
import ToggleButtonGroup, {toggleButtonGroupClasses} from "@mui/material/ToggleButtonGroup";
import CandlestickChartIcon from "@mui/icons-material/CandlestickChart";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";
import InvestorBarChart from "../../components/InvestorBarChart.tsx";

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

interface GoldRangeProps {
    value: number;
    label: ReactElement;
}

const GoldDetail = () => {
    const { id } = useParams();

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);
    const [req, setReq] = useState<GoldDetailReq>({
        stk_cd: id ?? "",
        chart_type: ChartType.DAY
    });

    const [goldChartData, setGoldChartData] = useState<CustomGoldDetailLineChartProps>({
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

    const [dayRange, setDayRange] = useState<GoldRangeProps[]>([
        {
            value: 0,
            label: <p>1일 최저가 <br />0</p>
        },
        {
            value: 0,
            label: <p>1일 최고가 <br />0</p>,
        }
    ]);

    const [info, setInfo] = useState<object>({
        trde_qty: 0,
        open_pric: 0,
        cur_prc: 0,
    });

    const [barData, setBarData] = useState<Array<number>>([0, 0, 0]);

    const [message, setMessage] = useState<object>({
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

    const color = labelColors[goldChartData.trend];
    const trendValues = { up: `${goldChartData.fluRt}%`, down: `${goldChartData.fluRt}%`, neutral: `${goldChartData.fluRt}%` };

    useEffect(() => {
        goldDetail(req);
    }, [req]);

    const goldDetail = async (req: GoldDetailReq) => {
        try {
            const data = await fetchGoldDetail(req);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);

            const {
                goldPriceNowRes, goldPriceNowMinuteRes, chartListRes, goldInvestor
            } = data.result;

            let year, month, day, hour, minute;
            let dateList;
            let lineData, barDataList;

            switch (req.chart_type) {
                case ChartType.MINUTE_1:
                case ChartType.MINUTE_3:
                case ChartType.MINUTE_5:
                case ChartType.MINUTE_10:
                case ChartType.MINUTE_30: {
                    year = chartListRes.gds_min_chart_qry[0].cntr_tm.substring(0, 4);
                    month = chartListRes.gds_min_chart_qry[0].cntr_tm.substring(4, 6);
                    day = chartListRes.gds_min_chart_qry[0].cntr_tm.substring(6, 8);
                    hour = goldPriceNowMinuteRes.gold_bid[0].tm.substring(0, 2);
                    minute = goldPriceNowMinuteRes.gold_bid[0].tm.substring(2, 4);

                    dateList = chartListRes.gds_min_chart_qry.map(item => {
                        return `${item.cntr_tm.slice(0, 4)}.${item.cntr_tm.slice(4, 6)}.${item.cntr_tm.slice(6, 8)} ${item.cntr_tm.slice(8, 10)}:${item.cntr_tm.slice(10, 12)}`
                    }).reverse();

                    lineData = chartListRes.gds_min_chart_qry.map(item => item.cntr_pric.replace(/^[+-]/, '')).reverse();
                    barDataList = chartListRes.gds_min_chart_qry.map(item => item.trde_qty).reverse();

                    break;
                }
                case ChartType.DAY: {
                    year = chartListRes.gds_day_chart_qry[0].dt.substring(0, 4);
                    month = chartListRes.gds_day_chart_qry[0].dt.substring(4, 6);
                    day = chartListRes.gds_day_chart_qry[0].dt.substring(6, 8);
                    hour = goldPriceNowMinuteRes.gold_bid[0].tm.substring(0, 2);
                    minute = goldPriceNowMinuteRes.gold_bid[0].tm.substring(2, 4);

                    dateList = chartListRes.gds_day_chart_qry.map(item => {
                        return `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                    }).reverse();

                    lineData = chartListRes.gds_day_chart_qry.map(item => item.cur_prc).reverse();
                    barDataList = chartListRes.gds_day_chart_qry.map(item => item.acc_trde_prica.slice(0, 3)).reverse();

                    break;
                }
                case ChartType.WEEK: {
                    year = chartListRes.gds_week_chart_qry[0].dt.substring(0, 4);
                    month = chartListRes.gds_week_chart_qry[0].dt.substring(4, 6);
                    day = chartListRes.gds_week_chart_qry[0].dt.substring(6, 8);
                    hour = goldPriceNowMinuteRes.gold_bid[0].tm.substring(0, 2);
                    minute = goldPriceNowMinuteRes.gold_bid[0].tm.substring(2, 4);

                    dateList = chartListRes.gds_week_chart_qry.map(item => {
                        return `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                    }).reverse();

                    lineData = chartListRes.gds_week_chart_qry.map(item => item.cur_prc).reverse();
                    barDataList = chartListRes.gds_week_chart_qry.map(item => item.acc_trde_qty.slice(0, 3)).reverse();

                    break;
                }
                case ChartType.MONTH: {
                    year = chartListRes.gds_month_chart_qry[0].dt.substring(0, 4);
                    month = chartListRes.gds_month_chart_qry[0].dt.substring(4, 6);
                    day = chartListRes.gds_month_chart_qry[0].dt.substring(6, 8);
                    hour = goldPriceNowMinuteRes.gold_bid[0].tm.substring(0, 2);
                    minute = goldPriceNowMinuteRes.gold_bid[0].tm.substring(2, 4);

                    dateList = chartListRes.gds_month_chart_qry.map(item => {
                        return `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                    }).reverse();

                    lineData = chartListRes.gds_month_chart_qry.map(item => item.cur_prc).reverse();
                    barDataList = chartListRes.gds_month_chart_qry.map(item => item.acc_trde_qty.slice(0, 3)).reverse();

                    break;
                }
            }

            let id = 'M04020000';
            let title = '금현물'

            let today;

            if(hour === '15' && minute === '30') {
                today = `${year}.${month}.${day} 장마감`;
            }else {
                today = `${year}.${month}.${day} ${hour}:${minute}`;
            }

            const goldPrice = Number(goldPriceNowRes.pred_close_pric) + Number(goldPriceNowRes.pred_pre)

            setGoldChartData({
                id: id,
                title: title,
                value: goldPrice.toLocaleString().replace(/^[+-]/, ''),
                fluRt: goldPriceNowRes.flu_rt,
                openPric: parseFloat(goldPriceNowRes.open_pric.replace(/^[+-]/, '')),
                interval: today,
                trend: goldPriceNowRes.pred_pre_sig === '5' ? 'down' : goldPriceNowRes.pred_pre_sig === '2' ? 'up' : 'neutral',
                seriesData: [
                    {
                        id: id,
                        showMark: false,
                        curve: 'linear',
                        area: true,
                        stackOrder: 'ascending',
                        color: goldPriceNowRes.pred_pre_sig === '2' ? 'red' : 'blue',
                        data: lineData,
                    }
                ],
                barDataList: barDataList,
                dateList: dateList
            });

            const dayMin = goldPriceNowRes['low_pric'].replace(/^[+-]/, '');
            const dayMax = goldPriceNowRes['high_pric'].replace(/^[+-]/, '')

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

            setInfo({
                trde_qty: `${Number(goldPriceNowRes.trde_qty).toLocaleString()}`,
                open_pric: parseFloat(goldPriceNowRes.open_pric.replace(/^[+-]/, '')),
                cur_prc: goldPrice
            });

            setBarData([goldInvestor.inve_trad_stat[0].all_dfrt_trst_netprps_amt, goldInvestor.inve_trad_stat[2].all_dfrt_trst_netprps_amt, goldInvestor.inve_trad_stat[1].all_dfrt_trst_netprps_amt])

            let message = {
                ...checkInvestor(
                    title,
                    goldInvestor.inve_trad_stat[2].all_dfrt_trst_netprps_amt,
                    goldInvestor.inve_trad_stat[1].all_dfrt_trst_netprps_amt
                )
            };

            setMessage(message);
        } catch (err) {
            console.error(err);
        }
    }

    function checkInvestor(name: string, orgn: number, frgnr: number): object {
        let message: string;
        let title: string;
        let icon: JSX.Element;

        if (orgn == 0) {
            message = '기관 관망 중입니다.'
        } else if (orgn > 0) {
            message = '기관 매수 중입니다.'
        } else {
            message = '기관 매도 중입니다.'
        }

        if (orgn > 0) {
            title = `${name} 투자 양호`
            icon = <CheckIcon color="success" />;
        } else if(orgn == 0) {
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

    const handleFormat = (
        _event: MouseEvent<HTMLElement>,
        newFormats: string,
    ) => {
        if(newFormats !== null) {
            setFormats(newFormats);
        }
    };

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                금현물 상세
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
                                {goldChartData.title}
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
                                        {goldChartData.value}
                                    </Typography>
                                    <Chip size="small" color={color} label={trendValues[goldChartData.trend]} />
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {goldChartData.interval}
                                </Typography>
                            </Stack>
                        </CardContent>
                        <GoldDetailLineChart {...goldChartData} />
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
                                        시가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {info.open_pric.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        현재가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {info.cur_prc.toLocaleString()}
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
                                value={Number(info.cur_prc || '0')}
                                valueLabelDisplay="auto"
                                disabled
                                max={dayRange[1].value}
                                min={dayRange[0].value}
                                marks={dayRange}
                            />
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    )
}

export default GoldDetail;