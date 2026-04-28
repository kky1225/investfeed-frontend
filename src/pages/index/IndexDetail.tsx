import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";
import {JSX, MouseEvent, ReactElement, useEffect, useRef, useState} from "react";
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup, {toggleButtonGroupClasses,} from '@mui/material/ToggleButtonGroup';
import {styled} from "@mui/material/styles";
import {Accordion, AccordionDetails, AccordionSummary, Select, SelectChangeEvent, Slider, Tab, Tabs} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuItem from "@mui/material/MenuItem";
import {GridColDef} from "@mui/x-data-grid";
import CustomDataTable from "../../components/CustomDataTable.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {renderTradeColor} from "../../components/CustomRender.tsx";
import * as React from "react";
import IndexDetailLineChart, {CustomIndexDetailLineChartProps} from "../../components/IndexDetailLineChart.tsx";
import InvestorBarChart from "../../components/InvestorBarChart.tsx";
import {fetchIndexDetail, fetchIndexDetailStream} from "../../api/index/IndexApi.ts";
import {
    IndexChartType,
    IndexDetailReq,
    IndexStream, IndexStreamRes
} from "../../type/IndexType.ts";
import RemoveIcon from "@mui/icons-material/Remove";
import CheckIcon from "@mui/icons-material/Check";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import DoNotDisturbIcon from "@mui/icons-material/DoNotDisturb";
import {useParams} from "react-router-dom";
import {renderChangeAmount} from "../../components/CustomRender.tsx";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import ProgramBarChart from "../../components/ProgramBarChart.tsx";
import {LineSeriesType} from "@mui/x-charts";
import { MakeOptional } from '@mui/x-internals/types';
import ProgramLineChart from "../../components/ProgramLineChart.tsx";

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
    const indsCd = id || "";

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);
    const [req, setReq] = useState<IndexDetailReq>({
        chart_type: IndexChartType.DAY
    });

    const [sectChartData, setSectChartData] = useState<CustomIndexDetailLineChartProps>({
        id: '-',
        title: '-',
        value: '-',
        fluRt: '0',
        predPre: '0',
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

    const [indexBarData, setIndexBarData] = useState<Array<number>>([0, 0, 0]);
    const [programBarData, setProgramBarData] = useState<Array<number>>([0, 0, 0]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [pollError, setPollError] = useState(false);

    interface StockInfoProps {
        trdeQty: number;
        trdePrica: number;
        openPric: number;
        curPrc: number;
        _250lwst: number;
        _250hgst: number;
    }

    const [info, setInfo] = useState<StockInfoProps>({
        trdeQty: 0,
        trdePrica: 0,
        openPric: 0,
        curPrc: 0,
        _250lwst: 0,
        _250hgst: 0
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
                await indexDetailStream();
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        await indexDetailStream();
                        socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                indexDetail(req);
                interval = setInterval(() => {
                    indexDetail(req, true);
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

    const indexDetail = async (req: IndexDetailReq, silent: boolean = false) => {
        try {
            const data = await fetchIndexDetail(indsCd, req, silent ? { skipGlobalError: true } : undefined);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            const {
                indexInfo, chartList, programChartList, programList, investorDailyList
            } = data.result;

            let dateList;
            let lineData, barDataList;

            switch (req.chart_type) {
                case IndexChartType.MINUTE_1:
                case IndexChartType.MINUTE_3:
                case IndexChartType.MINUTE_5:
                case IndexChartType.MINUTE_10:
                case IndexChartType.MINUTE_30: {
                    dateList = chartList.map((item: {dt: string}) => {
                        return `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)} ${item.dt.slice(8, 10)}:${item.dt.slice(10, 12)}`
                    }).reverse();

                    lineData = chartList.map((item: { curPrc: string }) => parsePrice(item.curPrc.replace(/^[+-]/, ''))).reverse();
                    barDataList = chartList.map((item: { trdeQty: string }) => Number(item.trdeQty)).reverse();

                    break;
                }
                case IndexChartType.DAY:
                case IndexChartType.WEEK:
                case IndexChartType.MONTH:
                case IndexChartType.YEAR: {
                    dateList = chartList.map((item: {dt: string}) => {
                        return `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                    }).reverse();

                    lineData = chartList.map((item: { curPrc: string }) => parsePrice(item.curPrc)).reverse();
                    barDataList = chartList.map((item: { trdeQty: string }) => Number(item.trdeQty)).reverse();

                    break;
                }
            }

            const year = chartList[0].dt.substring(0, 4);
            const month = chartList[0].dt.substring(4, 6);
            const day = chartList[0].dt.substring(6, 8);
            const hour = indexInfo.tmN.substring(0, 2);
            const minute = indexInfo.tmN.substring(2, 4);

            let today;

            if((Number(hour) >= 15 && Number(minute) >= 30) || Number(hour) < 9) {
                today = `${year}.${month}.${day} 장마감`;
            } else {
                today = `${year}.${month}.${day} ${hour}:${minute}`;
            }

            setSectChartData({
                id: chartList.indsCd,
                title: indexInfo.indsNm,
                value: Number(indexInfo.curPrc.replace(/^[+-]/, '')).toLocaleString(),
                fluRt: indexInfo.fluRt,
                predPre: indexInfo.predPre || '0',
                openPric: parseFloat(indexInfo.openPric.replace(/^[+-]/, '')),
                interval: today,
                trend: trendColor(indexInfo.predPreSig),
                seriesData: [
                    {
                        id: chartList.indsCd,
                        showMark: false,
                        curve: 'linear',
                        area: true,
                        stackOrder: 'ascending',
                        color: chartColor(indexInfo.predPreSig),
                        data: lineData,
                    }
                ],
                barDataList: barDataList,
                dateList: dateList
            });

            const dayMin = indexInfo.lowPric.replace(/^[+-]/, '');
            const dayMax = indexInfo.highPric.replace(/^[+-]/, '')

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

            const yearMin = indexInfo['_250lwst'].replace(/^[+-]/, '');
            const yearMax = indexInfo['_250hgst'].replace(/^[+-]/, '');

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
                trdeQty: Number(indexInfo.trdeQty),
                trdePrica: Number(indexInfo.trdePrica),
                openPric: Number(indexInfo.trdePrica.replace(/^[+-]/, '')),
                curPrc: Number(indexInfo.curPrc.replace(/^[+-]/, '')),
                _250lwst: Number(indexInfo._250lwst.replace(/^[+-]/, '')),
                _250hgst: Number(indexInfo._250hgst.replace(/^[+-]/, ''))
            });

            setIndexBarData([Number(indexInfo.indNetprps), Number(indexInfo.frgnrNetprps), Number(indexInfo.orgnNetprps)])
            setProgramBarData(
                [
                    Math.round(Number(indexInfo.dfrtTrdeNetprps) / 100),
                    Math.round(Number(indexInfo.ndiffproTrdeNetprps) / 100),
                    Math.round(Number(indexInfo.allNetprps) / 100)
                ]
            );

            const indexMessage = {
                ...checkInvestor(indexInfo.indsNm, Number(indexInfo.frgnrNetprps), Number(indexInfo.orgnNetprps))
            };

            const programMessage = {
                ...checkProgram(indexInfo.indsNm, Number(indexInfo.dfrtTrdeNetprps), Number(indexInfo.ndiffproTrdeNetprps))
            };

            setIndexMessage(indexMessage);
            setProgramMessage(programMessage);

            const programChartData: MakeOptional<LineSeriesType, 'type'>[] = [
                {
                    id: 'direct',
                    label: '차익',
                    showMark: false,
                    curve: 'linear',
                    area: true,
                    stackOrder: 'ascending',
                    color: 'green',
                    data: programChartList.map(item => { return Math.round(Number(item.dfrtTrdeNetprps) / 100)})
                },
                {
                    id: 'referral',
                    label: '비차익',
                    showMark: false,
                    curve: 'linear',
                    area: true,
                    stackOrder: 'ascending',
                    color: 'blue',
                    data: programChartList.map(item => { return Math.round(Number(item.ndiffproTrdeNetprps) / 100)}),
                },
                {
                    id: 'organic',
                    label: '전체',
                    showMark: false,
                    curve: 'linear',
                    stackOrder: 'ascending',
                    color: 'red',
                    data: programChartList.map(item => { return Math.round(Number(item.allNetprps) / 100)}),
                    area: true,
                }
            ];

            setProgramChartData(programChartData);
            setProgramDateData(programChartList.map(item => { return item.cntrTm}));

            const programColumns: GridColDef[] = [
                {
                    field: 'dt',
                    headerName: '날짜',
                    flex: 1,
                    minWidth: 100,
                    maxWidth: 120
                },
                {
                    field: 'dfrtTrdeTdy',
                    headerName: '차익',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number)
                },
                {
                    field: 'ndiffproTrdeTdy',
                    headerName: '비차익',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number)
                },
                {
                    field: 'allTdy',
                    headerName: '전체',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number)
                },
            ];

            const programRow = programList.map((item: {
                dt: string; dfrtTrdeTdy: string; ndiffproTrdeTdy: string; allTdy: string;
            }) => {
                return {
                    id: item.dt,
                    dt: `${(item.dt).substring(0, 4)}-${(item.dt).substring(4, 6)}-${(item.dt).substring(6, 8)}`,
                    dfrtTrdeTdy: Math.round(Number(item.dfrtTrdeTdy) / 100),
                    ndiffproTrdeTdy: Math.round(Number(item.ndiffproTrdeTdy) / 100),
                    allTdy: Math.round(Number(item.allTdy) / 100),
                }
            });

            const investorColumns: GridColDef[] = [
                {
                    field: 'dt',
                    headerName: '날짜',
                    flex: 1,
                    minWidth: 100,
                    maxWidth: 120
                },
                {
                    field: 'indNetprps',
                    headerName: '개인',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number),
                },
                {
                    field: 'frgnrNetprps',
                    headerName: '외국인',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number),
                },
                {
                    field: 'orgnNetprps',
                    headerName: '기관계',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number),
                },
                {
                    field: 'scNetprps',
                    headerName: '금융투자',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number),
                },
                {
                    field: 'insrncNetprps',
                    headerName: '보험',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number),
                },
                {
                    field: 'jnsinkmNetprps',
                    headerName: '종신금',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number),
                },
                {
                    field: 'invtrtNetprps',
                    headerName: '투신',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number),
                },
                {
                    field: 'samoFundNetprps',
                    headerName: '사모펀드',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number),
                },
                {
                    field: 'endwNetprps',
                    headerName: '연기금등',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number),
                },
                {
                    field: 'bankNetprps',
                    headerName: '은행',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number),
                },
                {
                    field: 'natnNetprps',
                    headerName: '국가',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number),
                },
                {
                    field: 'etcCorpNetprps',
                    headerName: '기타법인',
                    flex: 1,
                    minWidth: 100,
                    renderCell: (params) => renderTradeColor(params.value as number),
                },
                {
                    field: 'nativeTrmtFrgnrNetprps',
                    headerName: '내국인대우외국인',
                    flex: 1,
                    minWidth: 140,
                    renderCell: (params) => renderTradeColor(params.value as number),
                },
            ];

            const investorRow = (investorDailyList || []).map((item: any) => ({
                id: item.dt,
                dt: `${(item.dt).substring(0, 4)}-${(item.dt).substring(4, 6)}-${(item.dt).substring(6, 8)}`,
                indNetprps: Number(item.indNetprps),
                frgnrNetprps: Number(item.frgnrNetprps),
                orgnNetprps: Number(item.orgnNetprps),
                scNetprps: Number(item.scNetprps),
                insrncNetprps: Number(item.insrncNetprps),
                jnsinkmNetprps: Number(item.jnsinkmNetprps),
                invtrtNetprps: Number(item.invtrtNetprps),
                samoFundNetprps: Number(item.samoFundNetprps),
                endwNetprps: Number(item.endwNetprps),
                bankNetprps: Number(item.bankNetprps),
                natnNetprps: Number(item.natnNetprps),
                etcCorpNetprps: Number(item.etcCorpNetprps),
                nativeTrmtFrgnrNetprps: Number(item.nativeTrmtFrgnrNetprps),
            }));

            setTabData({
                investor: {
                    col: investorColumns,
                    row: investorRow
                },
                program: {
                    col: programColumns,
                    row: programRow
                }
            });
            setLastUpdated(new Date());
            setPollError(false);
        } catch(error) {
            console.error(error);
            if (silent) setPollError(true);
        } finally {
            setLoading(false);
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

            if (marketType !== MarketType.INDEX) {
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

    const indexDetailStream = async () => {
        try {
            const data = await fetchIndexDetailStream(indsCd);

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
                const indexList = data.data.map((res: IndexStreamRes) => {
                    const values = res.values;
                    return {
                        code: res.item,
                        value: values["10"],
                        change: values["11"],
                        fluRt: values["12"],
                        trend: values["25"]
                    };
                });

                indexList.forEach((index: IndexStream) => {
                    if(index.code === indsCd) {
                        setSectChartData((prev) => ({
                            ...prev,
                            value: index.value.replace(/^[+-]/, ''),
                            fluRt: index.fluRt,
                            predPre: index.change || '0',
                            trend: trendColor(index.trend),
                        }));
                    }
                });
            }
        };

        return socket;
    }

    const trendColor = (value: string) => {
        return ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';
    }

    const chartColor = (value: string) => {
        return ["1", "2"].includes(value) ? 'red' : ["4", "5"].includes(value) ? 'blue' : 'grey';
    }

    const parsePrice = (raw: string)  => {
        if (!raw) return null;
        return (parseInt(raw, 10) / 100).toFixed(2);
    }

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

            setReq({
                ...req,
                chart_type: newAlignment as IndexChartType
            })
        }
    };

    function handleOptionChange(event: SelectChangeEvent) {
        minute.current = event.target.value as string

        const value = 'MINUTE_' + event.target.value;

        setReq({
            ...req,
            chart_type: value as IndexChartType
        })
    }

    const labelColors = {
        up: 'error' as const,
        down: 'info' as const,
        neutral: 'default' as const,
    };

    const color = labelColors[sectChartData.trend];
    const trendValues = { up: `${sectChartData.fluRt}%`, down: `${sectChartData.fluRt}%`, neutral: `${sectChartData.fluRt}%` };

    interface MessageProps {
        icon: JSX.Element,
        title: string,
        message: string
    }

    const [indexMessage, setIndexMessage] = useState<MessageProps>({
        icon: <RemoveIcon />,
        title: '-',
        message: '-'
    });

    const [programMessage, setProgramMessage] = useState<MessageProps>({
        icon: <RemoveIcon />,
        title: '-',
        message: '-'
    });

    function checkInvestor(name: string, frgnr: number, orgn: number): MessageProps {
        let message: string;
        let title: string;
        let icon: JSX.Element;

        if (frgnr == 0) {
            message = '외국인 관망, '
        } else if (frgnr > 0) {
            message = '외국인 매수, '
        } else {
            message = '외국인 매도, '
        }

        if (orgn == 0) {
            message = message + '기관 관망 중입니다.'
        } else if (orgn > 0) {
            message = message + '기관 매수 중입니다.'
        } else {
            message = message + '기관 매도 중입니다.'
        }

        if (frgnr == 0 && orgn == 0) {
            title = `${name} 투자 중립`
            icon = <RemoveIcon />
        } else if (frgnr > 0 && orgn > 0) {
            title = `${name} 투자 양호`
            icon = <CheckIcon color="success" />;
        } else if(frgnr > 0 || orgn > 0) {
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

    function checkProgram(name: string, dfrtTrdeNetprps: number, ndiffproTrdeNetprps: number): MessageProps {
        let message: string;
        let title: string;
        let icon: JSX.Element;

        if (dfrtTrdeNetprps == 0) {
            message = '프로그램 차익 관망, '
        } else if (dfrtTrdeNetprps > 0) {
            message = '프로그램 차익 매수, '
        } else {
            message = '프로그램 차익 매도, '
        }

        if (ndiffproTrdeNetprps == 0) {
            message = message + '비차익 관망 중입니다.'
        } else if (ndiffproTrdeNetprps > 0) {
            message = message + '비차익 매수 중입니다.'
        } else {
            message = message + '비차익 매도 중입니다.'
        }

        if (dfrtTrdeNetprps == 0 && ndiffproTrdeNetprps == 0) {
            title = `${name} 투자 중립`
            icon = <RemoveIcon />
        } else if (dfrtTrdeNetprps > 0 && ndiffproTrdeNetprps > 0) {
            title = `${name} 투자 양호`
            icon = <CheckIcon color="success" />;
        } else if(dfrtTrdeNetprps > 0 || ndiffproTrdeNetprps > 0) {
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

    const [programChartData, setProgramChartData] = useState<MakeOptional<LineSeriesType, 'type'>[]>([
        {
            id: 'direct',
            label: '차익',
            showMark: false,
            curve: 'linear',
            area: true,
            stackOrder: 'ascending',
            color: 'green',
            data: [],
        },
        {
            id: 'referral',
            label: '비차익',
            showMark: false,
            curve: 'linear',
            area: true,
            stackOrder: 'ascending',
            color: 'blue',
            data: [],
        },
        {
            id: 'organic',
            label: '전체',
            showMark: false,
            curve: 'linear',
            stackOrder: 'ascending',
            color: 'red',
            data: [],
            area: true,
        }
    ]);
    const [programDateData, setProgramDateData] = useState<string[]>([]);
    const [tabValue, setTabValue] = useState<'investor' | 'program'>('investor');
    const [tabData, setTabData] = useState<any>({
        investor: { col: [], row: [] },
        program: { col: [], row: [] }
    });
    const handleTabChange = (_event: React.SyntheticEvent, newValue: 'investor' | 'program') => {
        setTabValue(newValue);
    };

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                <Typography component="h2" variant="h6">
                    지수 상세
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
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                {loading ? <Skeleton width={100}/> : sectChartData.title}
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
                                        {loading ? <Skeleton width={160}/> : sectChartData.value}
                                    </Typography>
                                    {loading ? <Skeleton width={80}/> : renderChangeAmount(sectChartData.predPre, '')}
                                    {loading
                                        ? <Skeleton variant="rounded" width={60} height={24}/>
                                        : <Chip size="small" color={color} label={trendValues[sectChartData.trend]} />}
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {loading ? <Skeleton width={140}/> : sectChartData.interval}
                                </Typography>
                            </Stack>
                        </CardContent>
                        <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                            <Box sx={{ minWidth: 1200 }}>
                                {loading ? (
                                    <Skeleton variant="rectangular" height={400} sx={{mx: 2, mb: 2, borderRadius: 1}}/>
                                ) : (
                                    <IndexDetailLineChart {...sectChartData} />
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
                                    <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                        거래량 (천주)
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.trdeQty.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                        거래대금 (백만원)
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.trdePrica.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                        시가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.openPric.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                        현재가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.curPrc.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                        52주 최저가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info._250lwst.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                        52주 최고가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
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
                                당일 투자자별 순매수(억)
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
                                                <InvestorBarChart data={indexBarData} />
                                            )}
                                        </CardContent>
                                    </Card>
                                    <Card variant="outlined" sx={{ width: '100%', mt: 2 }}>
                                        {!loading && indexMessage.icon}
                                        <CardContent>
                                            <Typography gutterBottom variant="h5" component="div">
                                                {loading ? <Skeleton width={180}/> : indexMessage.title}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                {loading ? <Skeleton width="80%"/> : indexMessage.message}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Card variant="outlined" sx={{ width: '100%' }}>
                                        <CardContent>
                                            {loading ? (
                                                <Skeleton variant="rectangular" height={300} sx={{borderRadius: 1}}/>
                                            ) : (
                                                <ProgramBarChart data={programBarData} />
                                            )}
                                        </CardContent>
                                    </Card>
                                    <Card variant="outlined" sx={{ width: '100%', mt: 2 }}>
                                        {!loading && programMessage.icon}
                                        <CardContent>
                                            <Typography gutterBottom variant="h5" component="div">
                                                {loading ? <Skeleton width={180}/> : programMessage.title}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                {loading ? <Skeleton width="80%"/> : programMessage.message}
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
                <Grid size={{ xs: 12, md: 12 }}>
                    <Accordion variant="outlined">
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography component="h2" variant="h6">
                                시간별 프로그램 순매수(억)
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                <Box sx={{ minWidth: 1200 }}>
                                    {loading ? (
                                        <Skeleton variant="rectangular" height={300} sx={{borderRadius: 1}}/>
                                    ) : (
                                        <ProgramLineChart seriesData={programChartData} date={programDateData} />
                                    )}
                                </Box>
                            </Box>
                        </AccordionDetails>
                    </Accordion>
                </Grid>
                <Grid size={{ xs: 12, md: 12 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        일별 거래 추이
                    </Typography>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={tabValue} onChange={handleTabChange} aria-label="index tabs">
                            <Tab label="투자자별" value='investor' />
                            <Tab label="프로그램" value='program' />
                        </Tabs>
                    </Box>
                    <CustomDataTable rows={tabData[tabValue].row} columns={tabData[tabValue].col} pageSize={20} loading={loading} />
                </Grid>
            </Grid>
        </Box>
    )
}

export default IndexDetail;