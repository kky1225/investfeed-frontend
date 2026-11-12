import {useEffect, useRef, useState} from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import {useColorScheme} from "@mui/material/styles";
import {CandleChartEngine, INDICATOR_PANE_HEIGHT} from "../../lib/chart/CandleChart.ts";
import {Candle, Drawing, DrawingTool, IndicatorType, PriceLine, TimeUnit} from "../../lib/chart/types.ts";
import {loadDrawings, saveDrawings} from "../../lib/chart/drawingStorage.ts";

export interface CandleChartProps {
    candles: Candle[],      // 오래된 순
    timeUnit: TimeUnit,
    seriesKey?: string,     // 종목·주기처럼 다른 차트로 바뀌는 기준. 바뀌면 드래그·확대 상태를 기본 보기로 되돌린다
    drawingKey?: string,    // 그린 도형을 저장하는 기준(종목 코드 등). 주기를 바꿔도 같은 도형을 보여 준다. 없으면 저장하지 않는다
    movingAverages?: number[],  // 이동평균선 기간. 색은 순서대로 success·warning·secondary·text.primary
    indicators?: IndicatorType[],   // 차트 아래에 쌓을 보조지표
    priceLines?: PriceLine[],   // 특정 가격에 긋는 가로선 (목표가 등)
    height?: number,            // 가격+거래량 영역 높이. 보조지표 영역은 이 아래에 더해진다
}

const DEFAULT_MOVING_AVERAGES = [5, 20, 60, 120];
const DEFAULT_INDICATORS: IndicatorType[] = ['rsi', 'macd'];
const NO_PRICE_LINES: PriceLine[] = [];

const CandleChart = ({
    candles, timeUnit, seriesKey, drawingKey,
    movingAverages = DEFAULT_MOVING_AVERAGES, indicators = DEFAULT_INDICATORS, priceLines = NO_PRICE_LINES,
    height = 400,
}: CandleChartProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<CandleChartEngine | null>(null);
    const {mode, systemMode} = useColorScheme();

    // 그린 도형. drawingKey 가 바뀌면(다른 종목) 그 종목에 저장해 둔 도형을 불러온다.
    const [stored, setStored] = useState(() => ({key: drawingKey, drawings: loadDrawings(drawingKey)}));
    if (stored.key !== drawingKey) {
        setStored({key: drawingKey, drawings: loadDrawings(drawingKey)});
    }
    const drawings = stored.drawings;
    const [tool, setTool] = useState<DrawingTool | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const updateDrawings = (next: Drawing[]) => {
        setStored({key: drawingKey, drawings: next});
        saveDrawings(drawingKey, next);
    };
    // 엔진은 한 번만 만들어지므로, 엔진이 부를 함수는 ref 로 최신 것을 가리키게 한다.
    const updateDrawingsRef = useRef(updateDrawings);
    useEffect(() => {
        updateDrawingsRef.current = updateDrawings;
    });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const engine = new CandleChartEngine(container);
        engineRef.current = engine;
        engine.onDrawingsChange = next => updateDrawingsRef.current(next);
        engine.onToolChange = setTool;
        engine.onSelectionChange = setSelectedId;

        const observer = new ResizeObserver(entries => {
            const {width, height} = entries[0].contentRect;
            engine.resize(width, height);
        });
        observer.observe(container);

        return () => {
            observer.disconnect();
            engine.destroy();
            engineRef.current = null;
        };
    }, []);

    useEffect(() => {
        engineRef.current?.resetView();
    }, [seriesKey]);

    useEffect(() => {
        engineRef.current?.setMovingAverages(movingAverages);
    }, [movingAverages]);

    useEffect(() => {
        engineRef.current?.setIndicators(indicators);
    }, [indicators]);

    useEffect(() => {
        engineRef.current?.setPriceLines(priceLines);
    }, [priceLines]);

    useEffect(() => {
        engineRef.current?.setDrawings(drawings);
    }, [drawings]);

    useEffect(() => {
        engineRef.current?.setTool(tool);
    }, [tool]);

    useEffect(() => {
        engineRef.current?.setData(candles, timeUnit);
    }, [candles, timeUnit]);

    // 캔버스는 CSS 변수를 못 읽으므로 테마 색을 실제 값으로 풀어 엔진에 넘긴다.
    // 라이트/다크 전환은 상위 ThemeProvider 의 effect 에서 반영되므로 다음 프레임에 읽는다.
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
                lineColors: ['--chart-line-1', '--chart-line-2', '--chart-line-3', '--chart-line-4'].map(color),
                fontFamily: computed.fontFamily,
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [mode, systemMode]);

    return (
        <Box>
            {/* 그리기 도구: 도구를 고르고 차트에 그린다. 하나를 그리면 도구가 풀린다. */}
            <Stack direction="row" spacing={1} sx={{px: 2, pb: 1, alignItems: 'center', minHeight: 40}}>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={tool}
                    onChange={(_event, next: DrawingTool | null) => setTool(next)}
                    aria-label="그리기 도구"
                >
                    <ToggleButton value="trend" aria-label="추세선">
                        <Tooltip title="추세선">
                            <ShowChartIcon fontSize="small"/>
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="horizontal" aria-label="수평선">
                        <Tooltip title="수평선">
                            <HorizontalRuleIcon fontSize="small"/>
                        </Tooltip>
                    </ToggleButton>
                </ToggleButtonGroup>
                {selectedId && (
                    <Tooltip title="선택한 선 삭제">
                        <IconButton
                            size="small"
                            aria-label="선택한 선 삭제"
                            onClick={() => updateDrawings(drawings.filter(drawing => drawing.id !== selectedId))}
                        >
                            <DeleteOutlineIcon fontSize="small"/>
                        </IconButton>
                    </Tooltip>
                )}
                {drawings.length > 0 && (
                    <Tooltip title="그린 선 모두 삭제">
                        <IconButton size="small" aria-label="그린 선 모두 삭제" onClick={() => updateDrawings([])}>
                            <DeleteSweepIcon fontSize="small"/>
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>
            <Box
                ref={containerRef}
                sx={(theme) => ({
                    position: 'relative',
                    width: '100%',
                    height: height + indicators.length * INDICATOR_PANE_HEIGHT,
                    '--chart-up': (theme.vars || theme).palette.error.main,
                    '--chart-down': (theme.vars || theme).palette.info.main,
                    '--chart-text': (theme.vars || theme).palette.text.secondary,
                    '--chart-grid': (theme.vars || theme).palette.divider,
                    '--chart-background': (theme.vars || theme).palette.background.paper,
                    '--chart-line-1': (theme.vars || theme).palette.success.main,
                    '--chart-line-2': (theme.vars || theme).palette.warning.main,
                    '--chart-line-3': (theme.vars || theme).palette.secondary.main,
                    '--chart-line-4': (theme.vars || theme).palette.text.primary,
                })}
            />
        </Box>
    );
};

export default CandleChart;
