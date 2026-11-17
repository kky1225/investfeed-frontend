import {useEffect, useRef} from "react";
import Box from "@mui/material/Box";
import {useColorScheme} from "@mui/material/styles";
import {MiniChartEngine, MiniChartMode, MiniChartTrend} from "../../lib/chart/MiniChart.ts";
import type {Candle, TimeUnit} from "../../lib/chart/types.ts";
import {chartColorVars, LINE_COLOR_VARS} from "./chartColors.ts";

export interface MiniChartProps {
    candles: Candle[],          // 오래된 순. 전부 한 화면에 맞춰 그린다
    mode: MiniChartMode,        // 선 / 캔들
    trend: MiniChartTrend,      // 선의 색 (오르면 상승색, 내리면 하락색)
    baseline?: number | null,   // 점선으로 긋는 기준 가격 (시가 등)
    timeUnit?: TimeUnit,        // 마우스를 올렸을 때 적는 시각의 단위
    // 차트 높이. 화면 크기별로 달리 줄 수 있다 (MUI 의 반응형 값)
    height?: number | { xs?: number, sm?: number, md?: number },
}

const DEFAULT_HEIGHT = {xs: 250, md: 310};

/** 목록 카드용 작은 차트. 이동·확대·지표·그리기 없이 받은 캔들을 선이나 캔들로 보여 준다. */
const MiniChart = ({candles, mode, trend, baseline = null, timeUnit = 'minute', height = DEFAULT_HEIGHT}: MiniChartProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<MiniChartEngine | null>(null);
    const {mode: colorMode, systemMode} = useColorScheme();

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const engine = new MiniChartEngine(container);
        engineRef.current = engine;
        const observer = new ResizeObserver(entries => {
            const {width, height: measured} = entries[0].contentRect;
            engine.resize(width, measured);
        });
        observer.observe(container);
        return () => {
            observer.disconnect();
            engine.destroy();
            engineRef.current = null;
        };
    }, []);

    useEffect(() => {
        engineRef.current?.setData(candles, timeUnit);
    }, [candles, timeUnit]);

    useEffect(() => {
        engineRef.current?.setMode(mode);
    }, [mode]);

    useEffect(() => {
        engineRef.current?.setTrend(trend);
    }, [trend]);

    useEffect(() => {
        engineRef.current?.setBaseline(baseline);
    }, [baseline]);

    // 테마 색을 캔버스에 넘긴다. 밝게/어둡게가 바뀌면 CSS 변수가 바뀐 다음 프레임에 다시 읽는다.
    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            const container = containerRef.current;
            if (!container) return;
            const computed = getComputedStyle(container);
            const color = (name: string) => computed.getPropertyValue(name).trim();
            engineRef.current?.setStyle({
                upColor: color('--chart-up'),
                downColor: color('--chart-down'),
                textColor: color('--chart-text'),
                gridColor: color('--chart-grid'),
                backgroundColor: color('--chart-background'),
                lineColors: LINE_COLOR_VARS.map(color),
                fontFamily: computed.fontFamily,
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [colorMode, systemMode]);

    return (
        // 여백은 바깥 상자에 두고, 캔버스를 담는 안쪽 상자는 여백 없이 둔다 (마우스 위치를 캔버스 기준으로 읽기 위함).
        <Box sx={theme => ({width: '100%', height, px: 2, pb: 1, boxSizing: 'border-box', ...chartColorVars(theme)})}>
            <Box ref={containerRef} sx={{width: '100%', height: '100%'}}/>
        </Box>
    );
};

export default MiniChart;
