import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import {MouseEvent, useEffect, useRef, useState} from "react";
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup, {toggleButtonGroupClasses,} from '@mui/material/ToggleButtonGroup';
import {styled} from "@mui/material/styles";
import {Select, SelectChangeEvent} from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import IndexDetailLineChart, {CustomIndexDetailLineChartProps} from "../../components/IndexDetailLineChart.tsx";
import InvestorBarChart from "../../components/InvestorBarChart.tsx";
import {fetchIndexDetail} from "../../api/index/IndexApi.ts";
import {ChartType, indexDetailReq} from "../../type/IndexType.ts";

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

const IndexDetail = () => {
    const [req, setReq] = useState<indexDetailReq>({
        inds_cd: "001",
        chart_type: ChartType.DAY
    });

    const [sectChartData, setSectChartData] = useState<CustomIndexDetailLineChartProps>({
        title: 'KOSPI',
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

    useEffect(() => {
        indexDetail(req)
    }, [req]);

    const indexDetail = async (req: indexDetailReq) => {
        try {
            const data = await fetchIndexDetail(req);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);

            const {
                sectPriceRes, chartListRes,
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

                    lineData = chartListRes.inds_min_pole_qry.map(item => parsePrice(item.cur_prc)).reverse();
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
            }

            let today;

            if(minute === '88' && second === '88') {
                today = `${year}.${month}.${day} 장마감`;
            }else {
                today = `${year}.${month}.${day} ${minute}:${second}`;
            }

            setSectChartData({
                title: 'KOSPI',
                value: sectPriceRes.cur_prc.replace(/^[+-]/, ''),
                fluRt: sectPriceRes.flu_rt,
                openPric: parseFloat(sectPriceRes.open_pric.replace(/^[+-]/, '')),
                interval: today,
                trend: sectPriceRes.pred_pre_sig === '5' ? 'down' : sectPriceRes.pred_pre_sig === '2' ? 'up' : 'neutral',
                seriesData: [
                    {
                        id: 'KOSPI',
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
        }catch(error) {
            console.error(error);
        }
    }

    const parsePrice = (raw: string)  => {
        if (!raw) return null;
        return (parseInt(raw, 10) / 100).toFixed(2);
    }

    const data2: CustomLineChartProps = [
        {
            id: 'direct',
            label: '개인',
            showMark: false,
            curve: 'linear',
            area: true,
            stackOrder: 'ascending',
            color: 'green',
            data: [
                -300, -900, -600, -1200, -1500, -1800, -2400, -2100, -2700, -3000, -1800, -3300,
                -3600, -3900, -4200, -4500, -3900, -4800, -5100, -5400, -4800, -5700, -6000,
                -6300, -6600, -6900, -7200, -7500, -7800, -8100, -8000
            ],
        },
        {
            id: 'referral',
            label: '기관',
            showMark: false,
            curve: 'linear',
            area: true,
            stackOrder: 'ascending',
            color: 'blue',
            data: [
                500, 900, 700, 1400, 1100, 1700, 2300, 2000, 2600, 2900, 2300, 3200,
                3500, 3800, 4100, 4400, 2900, 4700, 5000, 5300, 5600, 5900, 6200,
                6500, 5600, 6800, 7100, 7400, 7700, 8000, 7500
            ],
        },
        {
            id: 'organic',
            label: '외국인',
            showMark: false,
            curve: 'linear',
            stackOrder: 'ascending',
            color: 'red',
            data: [
                1000, 1500, 1200, 1700, 1300, 2000, 2400, 2200, 2600, 2800, 2500,
                3000, 3400, 3700, 3200, 3900, 4100, 3500, 4300, 4500, 4000, 4700,
                5000, 5200, 4800, 5400, 5600, 5900, 6100, 6300, 6800
            ],
            area: true,
        },
    ];

    const [toggle, setToggle] = useState('DAY');
    const [formats, setFormats] = useState('line');
    const minute = useRef('1');

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
                                        3억 2,031만주
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        거래대금
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        9,031억원
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        시가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        2,644.4
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        종가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        2,680.4
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        52주 최저가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        2,720.4
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        52주 최고가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        2,289.4
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
                <Grid size={{ xs: 12, md: 8 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        시간별 투자자별 순매수(억)
                    </Typography>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            {/*<InvestorLineChart seriesData={data2} />*/}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    )
}

export default IndexDetail;