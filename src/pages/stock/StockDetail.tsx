import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";
import {useState, MouseEvent, useRef, useEffect, useMemo, ReactElement, JSX} from "react";
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import HelpIcon from '@mui/icons-material/Help';
import ErrorIcon from '@mui/icons-material/Error';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup, {
    toggleButtonGroupClasses,
} from '@mui/material/ToggleButtonGroup';
import {Accordion, AccordionDetails, AccordionSummary, Select, SelectChangeEvent, Slider, Tab, Tabs, Tooltip} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {styled} from "@mui/material/styles";
import MenuItem from "@mui/material/MenuItem";
import {useParams} from "react-router-dom";
import {
    StockChartType,
    StockDetailReq,
    StockDetailRes,
    StockStreamReq,
    StockStreamRes,
    StockDividendItem,
} from "../../type/StockType.ts";
import StockDetailLineChart, {CustomStockDetailLineChartProps} from "../../components/StockDetailLineChart.tsx";
import {fetchStockDetail, fetchStockStream, fetchStockProgramChart} from "../../api/stock/StockApi.ts";
import {useMarketWebSocket} from "../detail/useMarketWebSocket.ts";
import {fetchNews} from "../../api/news/NewsApi.ts";
import InvestorBarChart from "../../components/InvestorBarChart.tsx";
import RemoveIcon from "@mui/icons-material/Remove";
import CheckIcon from "@mui/icons-material/Check";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import DoNotDisturbIcon from "@mui/icons-material/DoNotDisturb";
import CustomDataTable from "../../components/CustomDataTable.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {GridColDef} from "@mui/x-data-grid";
import {MarketType} from "../../type/timeType.ts";
import {LineSeriesType} from "@mui/x-charts";
import { MakeOptional } from '@mui/x-internals/types';
import InvestorLineChart from "../../components/InvestorLineChart.tsx";
import ProgramLineChart from "../../components/ProgramLineChart.tsx";
import * as React from "react";
import {renderTradeColor, renderChangeAmount} from "../../components/CustomRender.tsx";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import {usePollingQuery} from "../../lib/pollingQuery.ts";
import FavoriteIcon from "@mui/icons-material/Favorite";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import {addInterestItem, fetchInterestGroups} from "../../api/interest/InterestApi.ts";
import {useAlert} from "../../context/AlertContext";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import PriceTargetDialog from "../../components/PriceTargetDialog.tsx";
import {InterestGroup} from "../../type/InterestType.ts";

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

interface StockInfoProps {
    marketName: string;
    upName: string;
    trdeQty: number;
    trdePrica: number;
    openPric: number;
    curPrc: number;
    mac: number;
    macWght: number;
    forExhRt: number;
    _250lwst: number;
    _250hgst: number;
    per: number;
    eps: number;
    roe: number;
    pbr: number;
}

interface MessageProps {
    icon: JSX.Element,
    title: string,
    message: string
}

interface TabDataShape {
    investor: { col: GridColDef[]; row: any[] };
    program: { col: GridColDef[]; row: any[] };
    shortSelling: { col: GridColDef[]; row: any[] };
}

interface ExpectedPriceShape {
    value: string;
    fluRt?: string;
    trend?: 'up' | 'down' | 'neutral';
}

// 순수 헬퍼 — 모듈 레벨로 끌어올려 useMemo 의 TDZ 회피.
const trendColor = (value: string): 'up' | 'down' | 'neutral' => {
    return ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';
};

function checkInvestor(name: string, frgnr: number, orgn: number): MessageProps {
    let message: string;
    let title: string;
    let icon: JSX.Element;

    if (frgnr == 0) message = '외국인 관망, ';
    else if (frgnr > 0) message = '외국인 매수, ';
    else message = '외국인 매도, ';

    if (orgn == 0) message += '기관 관망 중입니다.';
    else if (orgn > 0) message += '기관 매수 중입니다.';
    else message += '기관 매도 중입니다.';

    if (frgnr == 0 && orgn == 0) {
        title = `${name} 투자 중립`;
        icon = <RemoveIcon />;
    } else if (frgnr > 0 && orgn > 0) {
        title = `${name} 투자 양호`;
        icon = <CheckIcon color="success" />;
    } else if (frgnr > 0 || orgn > 0) {
        title = `${name} 투자 주의`;
        icon = <PriorityHighIcon color="warning" />;
    } else {
        title = `${name} 투자 위험`;
        icon = <DoNotDisturbIcon color="error" />;
    }
    return { message, title, icon };
}

function orderWarningMsg(type: string): string {
    let message = "";
    switch (type) {
        case "1": message = "ETF 투자주의 요망"; break;
        case "2": message = "정리매매 종목 지정"; break;
        case "3": message = "단기과열 종목 지정"; break;
        case "4": message = "투자위험 종목 지정"; break;
        case "5": message = "투자경고 종목 지정"; break;
    }
    return message;
}

const INITIAL_CHART_DATA: CustomStockDetailLineChartProps = {
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

const INITIAL_INFO: StockInfoProps = {
    marketName: "", upName: "",
    trdeQty: 0, trdePrica: 0, openPric: 0, curPrc: 0,
    mac: 0, macWght: 0, forExhRt: 0,
    _250hgst: 0, _250lwst: 0,
    per: 0, eps: 0, roe: 0, pbr: 0,
};

const INITIAL_DAY_RANGE: StockRangeProps[] = [
    {value: 0.0, label: <p>1일 최저가 <br />0</p>},
    {value: 0.0, label: <p>1일 최고가 <br />0</p>},
];

const INITIAL_YEAR_RANGE: StockRangeProps[] = [
    {value: 0, label: <p>52주 최저가 <br />0</p>},
    {value: 0, label: <p>52주 최고가 <br />0</p>},
];

const INITIAL_BAR_DATA: number[] = [0, 0, 0];

const INITIAL_MESSAGE: MessageProps = {
    icon: <RemoveIcon />,
    title: '-',
    message: '-'
};

const INITIAL_INVESTOR_CHART_DATA: MakeOptional<LineSeriesType, 'type'>[] = [
    {id: 'direct', label: '외국인', showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: 'green', data: []},
    {id: 'referral', label: '기관', showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: 'blue', data: []},
    {id: 'organic', label: '연기금', showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: 'red', data: []},
];

const INVESTOR_COLUMNS: GridColDef[] = [
    {field: 'dt', headerName: '날짜', flex: 1, minWidth: 100, maxWidth: 120},
    {field: 'indInvsr', headerName: '개인', flex: 1, minWidth: 100, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'frgnrInvsr', headerName: '외국인', flex: 1, minWidth: 100, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'orgn', headerName: '기관계', flex: 1, minWidth: 100, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'fnncInvt', headerName: '금융투자', flex: 1, minWidth: 100, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'insrnc', headerName: '보험', flex: 1, minWidth: 100, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'etcFnnc', headerName: '기타금융', flex: 1, minWidth: 100, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'invtrt', headerName: '투신', flex: 1, minWidth: 100, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'samoFund', headerName: '사모펀드', flex: 1, minWidth: 100, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'penfndEtc', headerName: '연기금등', flex: 1, minWidth: 100, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'bank', headerName: '은행', flex: 1, minWidth: 100, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'natn', headerName: '국가', flex: 1, minWidth: 100, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'etcCorp', headerName: '기타법인', flex: 1, minWidth: 100, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'natfor', headerName: '내외국인', flex: 1, minWidth: 100, renderCell: (params) => renderTradeColor(params.value as number)},
];

const PROGRAM_COLUMNS: GridColDef[] = [
    {field: 'dt', headerName: '날짜', flex: 1, minWidth: 110, maxWidth: 120},
    {field: 'prmNetprpsQty', headerName: '프로그램 순매수 수량', flex: 1, minWidth: 170, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'prmBuyQty', headerName: '프로그램 매수 수량', flex: 1, minWidth: 160, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'prmSellQty', headerName: '프로그램 매도 수량', flex: 1, minWidth: 160, renderCell: (params) => renderTradeColor(params.value as number)},
    {field: 'prmNetprpsQtyIrds', headerName: '프로그램 순매수 수량 증감', flex: 1, minWidth: 200, renderCell: (params) => renderTradeColor(params.value as number)},
];

const SHORT_SELLING_COLUMNS: GridColDef[] = [
    {field: 'dt', headerName: '날짜', flex: 1, minWidth: 110, maxWidth: 120},
    {field: 'shrtsTrdePrica', headerName: '공매도 거래 대금', flex: 1, minWidth: 150, valueFormatter: (value: string) => Number(value).toLocaleString()},
    {field: 'shrtsQty', headerName: '공매도 수량', flex: 1, minWidth: 120, valueFormatter: (value: string) => Number(value).toLocaleString()},
    {field: 'trdeQty', headerName: '거래량', flex: 1, minWidth: 100, valueFormatter: (value: string) => Number(value).toLocaleString()},
    {field: 'trdeWght', headerName: '매매비중', flex: 1, minWidth: 100, valueFormatter: (value: string) => `${value}%`},
    {field: 'shrtsAvgPric', headerName: '공매도 평균가', flex: 1, minWidth: 140, valueFormatter: (value: string) => Number(value).toLocaleString()},
];

const INITIAL_TAB_DATA: TabDataShape = {
    investor: { col: [], row: [] },
    program: { col: [], row: [] },
    shortSelling: { col: [], row: [] },
};

const StockDetail = () => {
    const { id } = useParams();
    const stkCd = id || "";
    const [req, setReq] = useState<StockDetailReq>({
        chartType: StockChartType.DAY
    });

    const [toggle, setToggle] = useState('DAY');
    const [formats, setFormats] = useState('line');
    const minute = useRef('1');

    // 별도 fetcher (loadProgramChart) + 폴링 누적 패턴이라 useMemo 불가 — useState 유지
    const [programChartData, setProgramChartData] = useState<number[]>([]);
    const [programDateData, setProgramDateData] = useState<string[]>([]);
    const [programChartLoading, setProgramChartLoading] = useState(false);
    const [programChartLoaded, setProgramChartLoaded] = useState(false);
    const [priceTargetOpen, setPriceTargetOpen] = useState(false);

    // WebSocket 으로 들어오는 실시간 부분 갱신 overlay.
    // expectedPrice 는 WS 가 set/clear 둘 다 하므로 sentinel 삼중 상태:
    //   undefined = 폴링 base 사용, null = WS 가 명시적으로 지움, object = WS 가 채움
    const [liveStockChartOverlay, setLiveStockChartOverlay] = useState<Partial<CustomStockDetailLineChartProps>>({});
    const [liveExpectedPriceOverlay, setLiveExpectedPriceOverlay] = useState<ExpectedPriceShape | null | undefined>(undefined);

    // stkCd 변경 시 overlay reset (이전 종목 데이터 잔존 방지)
    const [prevStkCd, setPrevStkCd] = useState(stkCd);
    if (stkCd !== prevStkCd) {
        setPrevStkCd(stkCd);
        setLiveStockChartOverlay({});
        setLiveExpectedPriceOverlay(undefined);
    }

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<StockDetailRes>(
        ['stockDetail', stkCd, req.chartType],
        (config) => fetchStockDetail(stkCd, req, config),
    );
    const loading = isLoading;

    // WebSocket 라이프사이클 — 폴링과 독립. useMarketWebSocket 훅이 시장 시각/연결/정리 모두 처리.
    useMarketWebSocket({
        marketType: MarketType.STOCK,
        subscriptionKey: stkCd,
        streamFn: () => fetchStockStream({items: [stkCd]} satisfies StockStreamReq),
        onMessage: (event) => {
            const data = JSON.parse(event.data);
            if (data.trnm !== "REAL" || !Array.isArray(data.data)) return;

            data.data.forEach((res: StockStreamRes) => {
                if (res.item !== stkCd) return;
                const values = res.values;

                if (res.type === "0H") {
                    setLiveExpectedPriceOverlay({
                        value: Number(values["10"]?.replace(/^[+-]/, '') ?? '0').toLocaleString(),
                        fluRt: values["12"] ?? '0',
                        trend: trendColor(values["25"] ?? '3'),
                    });
                } else {
                    setLiveExpectedPriceOverlay(null);
                    setLiveStockChartOverlay({
                        value: Number(values["10"]?.replace(/^[+-]/, '') ?? '0').toLocaleString(),
                        fluRt: values["12"] ?? '0',
                        predPre: values["11"] || '0',
                        trend: trendColor(values["25"] ?? '3'),
                    });
                }
            });
        },
    });

    // 폴링 결과 → 파생값들 (useMemo 들). 모두 같은 res 를 읽어 각자 가공만 함.
    const baseStockChartData = useMemo<CustomStockDetailLineChartProps>(() => {
        if (!result) return INITIAL_CHART_DATA;
        try {
            const {stockInfo, stockChartList} = result;

            let dateList;
            let lineData, barDataList;

            switch (req.chartType) {
                case StockChartType.MINUTE_1:
                case StockChartType.MINUTE_3:
                case StockChartType.MINUTE_5:
                case StockChartType.MINUTE_10:
                case StockChartType.MINUTE_30: {
                    dateList = stockChartList.map((item: { dt: string }) => `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)} ${item.dt.slice(8, 10)}:${item.dt.slice(10, 12)}`).reverse();
                    lineData = stockChartList.map((item: { curPrc: string }) => item.curPrc.replace(/^[+-]/, '')).reverse();
                    barDataList = stockChartList.map((item: { trdeQty: string }) => Number(item.trdeQty)).reverse();
                    break;
                }
                case StockChartType.DAY:
                case StockChartType.WEEK:
                case StockChartType.MONTH:
                case StockChartType.YEAR: {
                    dateList = stockChartList.map((item: { dt: string }) => `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`).reverse();
                    lineData = stockChartList.map((item: { curPrc: string }) => item.curPrc).reverse();
                    barDataList = stockChartList.map((item: { trdeQty: string }) => Number(item.trdeQty)).reverse();
                    break;
                }
                default:
                    return INITIAL_CHART_DATA;
            }

            const year = stockInfo.tm.substring(0, 4);
            const month = stockInfo.tm.substring(4, 6);
            const day = stockInfo.tm.substring(6, 8);
            const hour = stockInfo.tm.substring(8, 10);
            const mm = stockInfo.tm.substring(10, 12);

            const today = (Number(hour) >= 20 || Number(hour) < 8)
                ? `${year}.${month}.${day} 장마감`
                : `${year}.${month}.${day} ${hour}:${mm}`;

            return {
                id: stockInfo.stkCd,
                title: stockInfo.stkNm,
                orderWarning: stockInfo.orderWarning,
                value: Number(stockInfo.curPrc.replace(/^[+-]/, '')).toLocaleString(),
                fluRt: stockInfo.fluRt,
                predPre: stockInfo.predPre || '0',
                openPric: parseFloat(stockInfo.openPric),
                interval: today,
                trend: trendColor(stockInfo.preSig),
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
            } as unknown as CustomStockDetailLineChartProps;
        } catch (error) {
            console.error(error);
            return INITIAL_CHART_DATA;
        }
    }, [result, req.chartType, id]);

    // 폴링 base expectedPrice (expCntrPric 가 있을 때만 객체, 없으면 null)
    const baseExpectedPrice = useMemo<ExpectedPriceShape | null>(() => {
        if (!result) return null;
        const {stockInfo} = result;
        const expPric = stockInfo.expCntrPric;
        if (!expPric || Number(expPric) === 0) return null;
        return {
            value: Number(expPric.replace(/^[+-]/, '')).toLocaleString(),
            fluRt: stockInfo.expCntrFluRt || undefined,
            trend: stockInfo.expCntrPreSig ? trendColor(stockInfo.expCntrPreSig) : undefined,
        };
    }, [result]);

    const info = useMemo<StockInfoProps>(() => {
        if (!result) return INITIAL_INFO;
        const {stockInfo} = result;
        return {
            marketName: stockInfo.marketName || '-',
            upName: stockInfo.upName || '-',
            trdeQty: Number(stockInfo.trdeQty),
            trdePrica: Number(stockInfo.trdePrica.substring(0, 7)),
            openPric: Number(stockInfo.openPric.replace(/^[+-]/, '')),
            curPrc: Number(stockInfo.curPrc.replace(/^[+-]/, '')),
            mac: Number(stockInfo.mac.replace(/^[+-]/, '')),
            macWght: Number(stockInfo.macWght.replace(/^[+-]/, '')),
            forExhRt: Number(stockInfo.forExhRt.replace(/^[+-]/, '')),
            _250hgst: Number(stockInfo._250hgst.replace(/^[+-]/, '')),
            _250lwst: Number(stockInfo._250lwst.replace(/^[+-]/, '')),
            per: Number(stockInfo.per),
            eps: Number(stockInfo.eps),
            roe: Number(stockInfo.roe),
            pbr: Number(stockInfo.pbr)
        };
    }, [result]);

    const dividendData = useMemo<StockDividendItem[]>(() => {
        if (!result) return [];
        return (result as {dividendList?: StockDividendItem[]}).dividendList || [];
    }, [result]);

    const dividendYield = useMemo<number | null>(() => {
        if (!result) return null;
        const {stockInfo} = result;
        const dvdList = (result as {dividendList?: StockDividendItem[]}).dividendList || [];
        if (dvdList.length === 0) return null;
        const lastYear = (new Date().getFullYear() - 1).toString();
        const lastYearAmt = dvdList
            .filter((d: StockDividendItem) => d.dvdnBasDt?.substring(0, 4) === lastYear)
            .reduce((sum: number, d: StockDividendItem) => sum + Number(d.stckGenrDvdnAmt || 0), 0);
        const curPrc = Number(stockInfo.curPrc.replace(/^[+-]/, ''));
        if (lastYearAmt > 0 && curPrc > 0) {
            return Math.round(lastYearAmt / curPrc * 10000) / 100;
        }
        return null;
    }, [result]);

    const barData = useMemo<number[]>(() => {
        if (!result) return INITIAL_BAR_DATA;
        const {stockInvestorList} = result;
        if (!stockInvestorList?.[0]) return INITIAL_BAR_DATA;
        return [
            Number(stockInvestorList[0].indInvsr.toLocaleString()),
            Number(stockInvestorList[0].frgnrInvsr.toLocaleString()),
            Number(stockInvestorList[0].orgn.toLocaleString())
        ];
    }, [result]);

    const message = useMemo<MessageProps>(() => {
        if (!result) return INITIAL_MESSAGE;
        const {stockInfo, stockInvestorList} = result;
        if (!stockInvestorList?.[0]) return INITIAL_MESSAGE;
        return checkInvestor(stockInfo.stkNm, Number(stockInvestorList[0].frgnrInvsr), Number(stockInvestorList[0].orgn));
    }, [result]);

    const dayRange = useMemo<StockRangeProps[]>(() => {
        if (!result) return INITIAL_DAY_RANGE;
        const {stockInfo} = result;
        const dayMin = Number(stockInfo.lowPric.replace(/^[+-]/, ''));
        const dayMax = Number(stockInfo.highPric.replace(/^[+-]/, ''));
        return [
            {value: dayMin, label: <p>1일 최저가 <br />{dayMin.toLocaleString()}</p>},
            {value: dayMax, label: <p>1일 최고가 <br />{dayMax.toLocaleString()}</p>},
        ];
    }, [result]);

    const yearRange = useMemo<StockRangeProps[]>(() => {
        if (!result) return INITIAL_YEAR_RANGE;
        const {stockInfo} = result;
        const yearMin = Number(stockInfo._250lwst.replace(/^[+-]/, ''));
        const yearMax = Number(stockInfo._250hgst.replace(/^[+-]/, ''));
        return [
            {value: yearMin, label: <p>52주 최저가 <br />{yearMin.toLocaleString()}</p>},
            {value: yearMax, label: <p>52주 최고가 <br />{yearMax.toLocaleString()}</p>},
        ];
    }, [result]);

    const investorChartData = useMemo<MakeOptional<LineSeriesType, 'type'>[]>(() => {
        if (!result) return INITIAL_INVESTOR_CHART_DATA;
        const {stockInvestorChartList} = result;
        return [
            {id: 'direct', label: '외국인', showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: 'green',
                data: stockInvestorChartList.map(item => Number(item.frgnrInvsr))},
            {id: 'referral', label: '기관', showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: 'blue',
                data: stockInvestorChartList.map(item => Number(item.orgn))},
            {id: 'organic', label: '연기금', showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: 'red',
                data: stockInvestorChartList.map(item => Number(item.penfnd_etc))},
        ];
    }, [result]);

    const investorDateData = useMemo<string[]>(() => {
        if (!result) return [];
        return result.stockInvestorChartList.map(item => item.tm);
    }, [result]);

    const tabData = useMemo<TabDataShape>(() => {
        if (!result) return INITIAL_TAB_DATA;
        const {stockInvestorList, stockProgramList, stockShortSellingList} = result;
        const investorRow = stockInvestorList.map((item: {
            dt: string; indInvsr: string; frgnrInvsr: string; orgn: string; fnncInvt: string; insrnc: string; etcFnnc: string; invtrt: string; samoFund: string; penfndEtc: string; bank: string; natn: string; etcCorp: string; natfor: string;
        }) => ({
            id: item.dt,
            dt: `${item.dt.substring(0, 4)}-${item.dt.substring(4, 6)}-${item.dt.substring(6, 8)}`,
            indInvsr: Number(item.indInvsr),
            frgnrInvsr: Number(item.frgnrInvsr),
            orgn: Number(item.orgn),
            fnncInvt: Number(item.fnncInvt),
            insrnc: Number(item.insrnc),
            etcFnnc: Number(item.etcFnnc),
            invtrt: Number(item.invtrt),
            samoFund: Number(item.samoFund),
            penfndEtc: Number(item.penfndEtc),
            bank: Number(item.bank),
            natn: Number(item.natn),
            etcCorp: Number(item.etcCorp),
            natfor: Number(item.natfor),
        }));
        const programRow = stockProgramList.map((item: {
            dt: string; prmSellQty: string; prmBuyQty: string; prmNetprpsQty: string; prmNetprpsQtyIrds: string;
        }) => ({
            id: item.dt,
            dt: `${item.dt.substring(0, 4)}-${item.dt.substring(4, 6)}-${item.dt.substring(6, 8)}`,
            prmSellQty: Number(item.prmSellQty),
            prmBuyQty: Number(item.prmBuyQty),
            prmNetprpsQty: Number(item.prmNetprpsQty),
            prmNetprpsQtyIrds: Number(item.prmNetprpsQtyIrds),
        }));
        const shortSellingRow = stockShortSellingList.map((item: {
            dt: string; shrtsTrdePrica: string; shrtsQty: string; trdeQty: string; trdeWght: string; shrtsAvgPric: string
        }) => ({
            id: item.dt,
            dt: `${item.dt.substring(0, 4)}-${item.dt.substring(4, 6)}-${item.dt.substring(6, 8)}`,
            shrtsTrdePrica: Number(item.shrtsTrdePrica),
            shrtsQty: Number(item.shrtsQty),
            trdeQty: Number(item.trdeQty),
            trdeWght: Number(item.trdeWght),
            shrtsAvgPric: Number(item.shrtsAvgPric),
        }));
        return {
            investor: { col: INVESTOR_COLUMNS, row: investorRow },
            program: { col: PROGRAM_COLUMNS, row: programRow },
            shortSelling: { col: SHORT_SELLING_COLUMNS, row: shortSellingRow },
        };
    }, [result]);

    // 최종 stockChartData / expectedPrice = base + WS overlay 머지
    const stockChartData = useMemo<CustomStockDetailLineChartProps>(() => ({
        ...baseStockChartData,
        ...liveStockChartOverlay,
    }), [baseStockChartData, liveStockChartOverlay]);

    // expectedPrice: WS overlay 의 sentinel 처리
    //   undefined = WS 메시지 없음 → base 사용
    //   null      = WS 가 명시적으로 지움 → null
    //   object    = WS 가 채움 → object
    const expectedPrice = useMemo<ExpectedPriceShape | null>(() => {
        return liveExpectedPriceOverlay !== undefined ? liveExpectedPriceOverlay : baseExpectedPrice;
    }, [baseExpectedPrice, liveExpectedPriceOverlay]);

    // loadProgramChart 가 초기 로드 후, 폴링이 들어올 때마다 오늘의 prmNetprpsQty 를 누적.
    // (이건 useMemo 로 못 풂 — prev 에 append 하는 stateful accumulation 패턴.)
    useEffect(() => {
        if (!result) return;
        const {stockProgramList} = result;
        if (!stockProgramList || stockProgramList.length === 0) return;

        const todayProgram = stockProgramList[0];
        const netQty = Number(todayProgram.prmNetprpsQty);
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

        setProgramChartData(prev => prev.length === 0 ? prev : [...prev, netQty]);
        setProgramDateData(prev => prev.length === 0 ? prev : [...prev, hhmm]);
    }, [result]);

    const loadProgramChart = async () => {
        if (!id || programChartLoaded) return;
        setProgramChartLoading(true);
        try {
            const data = await fetchStockProgramChart(id);
            if (data.code === "0000" && data.result.length > 0) {
                const chartList = data.result;
                setProgramChartData(chartList.map((item: any) => Number(item.prmNetprpsAmt)));
                setProgramDateData(chartList.map((item: any) => item.tm));
            }
            setProgramChartLoaded(true);
        } catch (e) {
            console.error(e);
        } finally {
            setProgramChartLoading(false);
        }
    }



    const [tabValue, setTabValue] = useState<'investor' | 'program' | 'shortSelling' | 'news'>('investor');
    const [newsItems, setNewsItems] = useState<{title: string; link: string; description: string; pubDate: string}[]>([]);
    const [newsPage, setNewsPage] = useState(1);
    const [newsTotal, setNewsTotal] = useState(0);
    const [newsLoaded, setNewsLoaded] = useState(false);

    const labelColors = {
        up: 'error' as const,
        down: 'info' as const,
        neutral: 'default' as const,
    };

    const color = labelColors[stockChartData.trend];
    const trendValues = { up: `${stockChartData.fluRt}%`, down: `${stockChartData.fluRt}%`, neutral: `${stockChartData.fluRt}%` };

    const expectedColor = expectedPrice?.trend ? labelColors[expectedPrice.trend] : 'default';

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
                chartType: newAlignment as StockChartType
            })
        }
    };

    function handleOptionChange(event: SelectChangeEvent) {
        minute.current = event.target.value as string

        const value = 'MINUTE_' + event.target.value;

        setReq({
            ...req,
            chartType: value as StockChartType
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


    const handleChange = (_event: React.SyntheticEvent, newValue: string) => {
        if (newValue === 'investor' || newValue === 'program' || newValue === 'shortSelling' || newValue === 'news') {
            setTabValue(newValue);
            if (newValue === 'news' && !newsLoaded && stockChartData.title) {
                loadNews(stockChartData.title, 1);
            }
        }
    };

    const loadNews = async (stkNm: string, page: number) => {
        try {
            const res = await fetchNews({query: stkNm, page});
            if (res) {
                if (page === 1) {
                    setNewsItems(res.items ?? []);
                } else {
                    setNewsItems(prev => [...prev, ...(res.items ?? [])]);
                }
                setNewsTotal(res.total ?? 0);
                setNewsPage(page);
                setNewsLoaded(true);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const [interestDialogOpen, setInterestDialogOpen] = useState(false);
    const [interestGroups, setInterestGroups] = useState<InterestGroup[]>([]);
    const [interestLoading, setInterestLoading] = useState(false);
    const [addedGroupIds, setAddedGroupIds] = useState<Set<number>>(new Set());
    const showAlert = useAlert();

    const handleHeartClick = async () => {
        setInterestDialogOpen(true);
        setInterestLoading(true);
        setAddedGroupIds(new Set());
        try {
            const res = await fetchInterestGroups();
            if (res.code !== "0000") throw new Error(res.message || `관심 그룹 조회 실패 (${res.code})`);
            setInterestGroups(res.result ?? []);
        } finally {
            setInterestLoading(false);
        }
    };

    const handleAddToGroup = async (group: InterestGroup) => {
        try {
            const res = await addInterestItem(group.id, {
                stkCd: stockChartData.id,
                stkNm: stockChartData.title,
            });
            if (res.code !== "0000") throw new Error(res.message || `관심 종목 추가 실패 (${res.code})`);
            setAddedGroupIds(prev => new Set(prev).add(group.id));
            showAlert(`${group.groupNm}에 추가되었습니다.`, 'success');
        } catch (error) {
            console.error(error);
            showAlert('이미 추가된 종목이거나 오류가 발생했습니다.', 'error');
        }
    };

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                <Typography component="h2" variant="h6">
                    주식 상세
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
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography component="h2" variant="subtitle2" gutterBottom>
                                    {loading ? <Skeleton width={140}/> : (
                                        <>
                                            {stockChartData.title}
                                            {stockChartData.orderWarning !== '0' &&
                                                <Tooltip title={orderWarningMsg(stockChartData.orderWarning)} placement="right">
                                                    <ErrorIcon color="error" sx={{ fontSize: 'inherit', verticalAlign: 'middle', ml: "1px", mb: "3px" }} />
                                                </Tooltip>
                                            }
                                        </>
                                    )}
                                </Typography>
                                <Stack direction="row" alignItems="center" gap={0.5}>
                                    {stockChartData.nxtEnable === 'Y' &&
                                        <Typography component="h2" variant="subtitle2" gutterBottom>
                                            NXT
                                            <Tooltip title="넥스트 트레이드는 오전 8시부터 오후 8시까지 거래할 수 있는 대체 거래소입니다.">
                                                <HelpIcon sx={{ fontSize: 'inherit', verticalAlign: 'middle', ml: "1px", mb: "3px" }} />
                                            </Tooltip>
                                        </Typography>
                                    }
                                    <Tooltip title="관심종목 추가">
                                        <IconButton size="small" onClick={handleHeartClick} sx={{mb: "3px"}}>
                                            {addedGroupIds.size > 0
                                                ? <FavoriteIcon fontSize="small" color="error" />
                                                : <FavoriteBorderIcon fontSize="small" color="error" />
                                            }
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="목표가 알림">
                                        <IconButton size="small" onClick={() => setPriceTargetOpen(true)} sx={{mb: "3px"}}>
                                            <NotificationsActiveIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
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
                                        {loading ? <Skeleton width={160}/> : stockChartData.value}
                                    </Typography>
                                    {loading ? <Skeleton width={80}/> : renderChangeAmount(stockChartData.predPre)}
                                    {loading
                                        ? <Skeleton variant="rounded" width={60} height={24}/>
                                        : <Chip size="small" color={color} label={trendValues[stockChartData.trend]} />}
                                    {expectedPrice && (
                                        <>
                                            <Divider orientation="vertical" flexItem />
                                            <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.85em' }}>
                                                예상
                                            </Typography>
                                            <Typography variant="h4" component="p">
                                                {expectedPrice.value}
                                            </Typography>
                                            {expectedPrice.fluRt && (
                                                <Chip size="small" color={expectedColor} label={`${expectedPrice.fluRt}%`} />
                                            )}
                                        </>
                                    )}
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {loading ? <Skeleton width={140}/> : stockChartData.interval}
                                </Typography>
                            </Stack>
                        </CardContent>
                        <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                            <Box sx={{ minWidth: 1200 }}>
                                {loading ? (
                                    <Skeleton variant="rectangular" height={400} sx={{mx: 2, mb: 2, borderRadius: 1}}/>
                                ) : (
                                    <StockDetailLineChart {...stockChartData} />
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
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        시장명
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.marketName}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        업종명
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.upName}
                                    </Typography>
                                </Grid>
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
                                        시가총액 (억)
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.mac.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        외인 소진률
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : `${info.forExhRt.toLocaleString()}%`}
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
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        per
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.per.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        eps
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.eps.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        roe
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.roe.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        pbr
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.pbr.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                                        배당수익률
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : (dividendYield !== null ? `${dividendYield}%` : '-')}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                    <Accordion variant="outlined" defaultExpanded slotProps={{ transition: { unmountOnExit: true } }}>
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
                    <Accordion variant="outlined" defaultExpanded slotProps={{ transition: { unmountOnExit: true } }} sx={{ overflow: 'visible' }}>
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
                    <Accordion variant="outlined" slotProps={{ transition: { unmountOnExit: true } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography component="h2" variant="h6">
                                장중 투자자별 순매수(주)
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            {loading ? (
                                <Skeleton variant="rectangular" height={300} sx={{borderRadius: 1}}/>
                            ) : (
                                <InvestorLineChart seriesData={investorChartData} date={investorDateData} />
                            )}
                        </AccordionDetails>
                    </Accordion>
                </Grid>
                <Grid size={{ xs: 12, md: 12 }}>
                    <Accordion
                        variant="outlined"
                        slotProps={{ transition: { unmountOnExit: true } }}
                        onChange={(_e, expanded) => { if (expanded && !programChartLoaded) loadProgramChart(); }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography component="h2" variant="h6">
                                시간별 프로그램 순매수(주)
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            {programChartLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                                    <CircularProgress />
                                </Box>
                            ) : programChartData.length > 0 ? (
                                <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                    <Box sx={{ minWidth: 1200 }}>
                                        <ProgramLineChart
                                            seriesData={[{
                                                id: 'organic',
                                                label: '순매수',
                                                showMark: false,
                                                curve: 'linear',
                                                stackOrder: 'ascending',
                                                color: 'red',
                                                data: programChartData,
                                                area: true,
                                            }]}
                                            date={programDateData}
                                        />
                                    </Box>
                                </Box>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                                    데이터가 없습니다.
                                </Typography>
                            )}
                        </AccordionDetails>
                    </Accordion>
                </Grid>
                <Grid size={{ xs: 12, md: 12 }}>
                    <Accordion
                        variant="outlined"
                        slotProps={{ transition: { unmountOnExit: true } }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography component="h2" variant="h6">
                                배당 정보
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            {dividendData.length > 0 ? (
                                <Grid container spacing={2}>
                                    {Object.entries(
                                        dividendData.reduce((acc, item) => {
                                            const year = item.dvdnBasDt ? item.dvdnBasDt.substring(0, 4) : '기타';
                                            if (!acc[year]) acc[year] = [];
                                            acc[year].push(item);
                                            return acc;
                                        }, {} as Record<string, typeof dividendData>)
                                    ).sort(([a], [b]) => b.localeCompare(a)).map(([year, items]) => {
                                        const totalAmt = items.reduce((sum, item) => sum + Number(item.stckGenrDvdnAmt || 0), 0);
                                        return (
                                            <Grid key={year} size={{ xs: 12, sm: 6, md: 4 }}>
                                                <Card variant="outlined" sx={{ height: '100%' }}>
                                                    <CardContent>
                                                        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                                                            {year}년
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                            {items.length}건 / 합계 {totalAmt.toLocaleString()}원
                                                        </Typography>
                                                        <Divider sx={{ mb: 1 }} />
                                                        {items.map((item, i) => (
                                                            <Box key={`${item.dvdnBasDt}_${i}`} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.3 }}>
                                                                <Typography variant="body2">
                                                                    {item.dvdnBasDt ? `${item.dvdnBasDt.substring(4, 6)}-${item.dvdnBasDt.substring(6, 8)}` : ''} {item.stckDvdnRcdNm}
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                                    <Typography variant="body2" fontWeight={600}>
                                                                        {Number(item.stckGenrDvdnAmt || 0).toLocaleString()}원
                                                                    </Typography>
                                                                    {item.cashDvdnPayDt ? (
                                                                        item.cashDvdnPayDt > new Date().toISOString().replace(/-/g, '').substring(0, 8)
                                                                            ? <Typography variant="caption" color="text.secondary">(미지급)</Typography>
                                                                            : <Typography variant="caption" color="text.secondary">
                                                                                ({item.cashDvdnPayDt.substring(4, 6)}-{item.cashDvdnPayDt.substring(6, 8)} 지급)
                                                                              </Typography>
                                                                    ) : (
                                                                        <Typography variant="caption" color="text.secondary">(미지급)</Typography>
                                                                    )}
                                                                </Box>
                                                            </Box>
                                                        ))}
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        );
                                    })}
                                </Grid>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                                    배당 정보가 없습니다.
                                </Typography>
                            )}
                        </AccordionDetails>
                    </Accordion>
                </Grid>
                <Grid size={{ xs: 12, md: 12 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        일별 거래 추이
                    </Typography>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={tabValue} onChange={handleChange} aria-label="basic tabs example">
                            <Tab label="투자자별" value='investor' />
                            <Tab label="프로그램" value='program' />
                            <Tab label="공매도" value='shortSelling' />
                            <Tab label="뉴스" value='news' />
                        </Tabs>
                    </Box>
                    {tabValue !== 'news' ? (
                        <CustomDataTable rows={tabData[tabValue].row} columns={tabData[tabValue].col} pageSize={20} loading={loading} />
                    ) : (
                        <Box sx={{mt: 2}}>
                            {newsItems.length > 0 ? (
                                <>
                                    {newsItems.map((item, index) => (
                                        <Box key={index} sx={{py: 1.5, borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer', '&:hover': {bgcolor: 'action.hover'}}}
                                            onClick={() => window.open(item.link, '_blank')}>
                                            <Typography variant="body2" sx={{fontWeight: 600, mb: 0.5}}>{item.title}</Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                                                {item.description}
                                            </Typography>
                                            <Typography variant="caption" color="text.disabled" sx={{display: 'block', mt: 0.5}}>
                                                {item.pubDate}
                                            </Typography>
                                        </Box>
                                    ))}
                                    {newsItems.length < newsTotal && (
                                        <Box sx={{textAlign: 'center', mt: 2}}>
                                            <Button size="small" onClick={() => loadNews(stockChartData.title, newsPage + 1)}>
                                                더보기
                                            </Button>
                                        </Box>
                                    )}
                                </>
                            ) : newsLoaded ? (
                                <Typography variant="body2" color="text.secondary" sx={{py: 2, textAlign: 'center'}}>
                                    관련 뉴스가 없습니다.
                                </Typography>
                            ) : null}
                        </Box>
                    )}
                </Grid>
            </Grid>

            {/* 관심종목 그룹 선택 다이얼로그 */}
            <Dialog open={interestDialogOpen} onClose={() => setInterestDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>관심종목에 추가</DialogTitle>
                <DialogContent sx={{pb: 1}}>
                    {interestLoading ? (
                        <Box sx={{display: 'flex', justifyContent: 'center', py: 3}}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : interestGroups.length === 0 ? (
                        <Box sx={{py: 2, textAlign: 'center'}}>
                            <Typography variant="body2" color="text.secondary">
                                관심종목 그룹이 없습니다.
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                관심종목 메뉴에서 그룹을 먼저 만들어주세요.
                            </Typography>
                        </Box>
                    ) : (
                        <List dense disablePadding>
                            {interestGroups.map(group => (
                                <ListItemButton
                                    key={group.id}
                                    onClick={() => handleAddToGroup(group)}
                                    disabled={addedGroupIds.has(group.id)}
                                    sx={{borderRadius: 1}}
                                >
                                    <ListItemText
                                        primary={group.groupNm}
                                        primaryTypographyProps={{variant: 'body2'}}
                                    />
                                    {addedGroupIds.has(group.id) && (
                                        <FavoriteIcon fontSize="small" color="error" />
                                    )}
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setInterestDialogOpen(false)}>닫기</Button>
                </DialogActions>
            </Dialog>

            <PriceTargetDialog
                open={priceTargetOpen}
                onClose={() => setPriceTargetOpen(false)}
                assetType="STOCK"
                assetCode={id ?? ""}
                assetName={stockChartData.title}
                currentPrice={stockChartData.value}
            />
        </Box>
    )
}

export default StockDetail;
