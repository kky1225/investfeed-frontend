import {useEffect, useState} from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import MenuItem from "@mui/material/MenuItem";
import {Select, type SelectChangeEvent} from "@mui/material";
import StockDetailLineChart, {type CustomStockDetailLineChartProps} from "../../components/StockDetailLineChart.tsx";
import CryptoDetailLineChart, {type CryptoDetailLineChartProps} from "../../components/CryptoDetailLineChart.tsx";
import CommodityDetailLineChart, {type CommodityDetailLineChartProps} from "../../components/CommodityDetailLineChart.tsx";
import {fetchStockChart} from "../../api/stock/StockApi.ts";
import {fetchCryptoDetail} from "../../api/crypto/CryptoApi.ts";
import {fetchCommodityDetail} from "../../api/commodity/CommodityApi.ts";
import {StockChartType} from "../../type/StockType.ts";
import {CryptoChartType} from "../../type/CryptoType.ts";
import {CommodityChartType} from "../../type/CommodityType.ts";
import type {AssetType} from "./MultiViewSearchDialog.tsx";

interface ChartDetailDialogProps {
    open: boolean;
    onClose: () => void;
    assetType: AssetType | null;
    code: string;
    name: string;
}

export default function ChartDetailDialog({open, onClose, assetType, code, name}: ChartDetailDialogProps) {
    const [chartData, setChartData] = useState<CustomStockDetailLineChartProps | CryptoDetailLineChartProps | CommodityDetailLineChartProps | null>(null);
    const [chartType, setChartType] = useState("DAY");
    const [minuteUnit, setMinuteUnit] = useState("1");

    useEffect(() => {
        if (!open || !code || !assetType) return;
        setChartType("DAY");
        loadChart("DAY", "1");
    }, [open, code, assetType]);

    const loadChart = async (type: string, minute: string) => {
        try {
            if (assetType === 'STOCK') {
                const chartTypeMap: Record<string, StockChartType> = {
                    MINUTE: `MINUTE_${minute}` as StockChartType,
                    DAY: StockChartType.DAY,
                    WEEK: StockChartType.WEEK,
                    MONTH: StockChartType.MONTH,
                    YEAR: StockChartType.YEAR,
                };
                const data = await fetchStockChart({stkCd: code, chartType: chartTypeMap[type] ?? StockChartType.DAY});
                if (data.result) setChartData(data.result);
            } else if (assetType === 'CRYPTO') {
                const chartTypeMap: Record<string, CryptoChartType> = {
                    MINUTE: `MINUTE_${minute}` as CryptoChartType,
                    DAY: CryptoChartType.DAY,
                    WEEK: CryptoChartType.WEEK,
                    MONTH: CryptoChartType.MONTH,
                    YEAR: CryptoChartType.YEAR,
                };
                const data = await fetchCryptoDetail({market: code, chartType: chartTypeMap[type] ?? CryptoChartType.DAY});
                if (data.result) setChartData(data.result);
            } else if (assetType === 'COMMODITY') {
                const chartTypeMap: Record<string, CommodityChartType> = {
                    MINUTE: `MINUTE_${minute}` as CommodityChartType,
                    DAY: CommodityChartType.DAY,
                    WEEK: CommodityChartType.WEEK,
                    MONTH: CommodityChartType.MONTH,
                };
                const data = await fetchCommodityDetail({stkCd: code, chartType: chartTypeMap[type] ?? CommodityChartType.DAY});
                if (data.result) setChartData(data.result);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleChartTypeChange = (_: unknown, value: string | null) => {
        if (!value) return;
        setChartType(value);
        loadChart(value, minuteUnit);
    };

    const handleMinuteChange = (e: SelectChangeEvent) => {
        setMinuteUnit(e.target.value);
        loadChart("MINUTE", e.target.value);
    };

    const trend = chartData && 'trend' in chartData ? chartData.trend : 'neutral';
    const chipColor = trend === 'up' ? 'error' : trend === 'down' ? 'info' : 'default';

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
            <DialogTitle sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <Typography variant="h6">{name}</Typography>
                    {chartData && 'value' in chartData && (
                        <>
                            <Typography variant="h6" sx={{fontWeight: 700}}>
                                {Number(String(chartData.value).replace(/[^0-9.-]/g, '')).toLocaleString()}원
                            </Typography>
                            {'fluRt' in chartData && (
                                <Chip
                                    label={`${Number(chartData.fluRt) > 0 ? '+' : ''}${chartData.fluRt}%`}
                                    size="small"
                                    color={chipColor}
                                    variant="outlined"
                                />
                            )}
                        </>
                    )}
                </Box>
                <IconButton onClick={onClose}><CloseIcon/></IconButton>
            </DialogTitle>
            <DialogContent>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
                    {chartType === 'MINUTE' && (
                        <Select size="small" value={minuteUnit} onChange={handleMinuteChange} sx={{minWidth: 70}}>
                            <MenuItem value="1">1분</MenuItem>
                            <MenuItem value="3">3분</MenuItem>
                            <MenuItem value="5">5분</MenuItem>
                            <MenuItem value="30">30분</MenuItem>
                        </Select>
                    )}
                    <ToggleButtonGroup value={chartType} exclusive onChange={handleChartTypeChange} size="small">
                        <ToggleButton value="MINUTE">분</ToggleButton>
                        <ToggleButton value="DAY">일</ToggleButton>
                        <ToggleButton value="WEEK">주</ToggleButton>
                        <ToggleButton value="MONTH">월</ToggleButton>
                        {assetType !== 'COMMODITY' && <ToggleButton value="YEAR">년</ToggleButton>}
                    </ToggleButtonGroup>
                </Box>

                <Box sx={{height: 500}}>
                    {chartData && assetType === 'STOCK' && (
                        <StockDetailLineChart {...(chartData as CustomStockDetailLineChartProps)} />
                    )}
                    {chartData && assetType === 'CRYPTO' && (
                        <CryptoDetailLineChart {...(chartData as CryptoDetailLineChartProps)} />
                    )}
                    {chartData && assetType === 'COMMODITY' && (
                        <CommodityDetailLineChart {...(chartData as CommodityDetailLineChartProps)} />
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    );
}
