import {useEffect, useMemo, useRef, useState} from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SettingsIcon from "@mui/icons-material/Settings";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import Paper from "@mui/material/Paper";
import ChartSettingsDialog, {ChartSettingOption} from "./ChartSettingsDialog.tsx";
import ChartDrawingToolbar from "./ChartDrawingToolbar.tsx";
import {useChartStorage} from "./useChartStorage.ts";
import {useColorScheme} from "@mui/material/styles";
import {CandleChartEngine, INDICATOR_PANE_HEIGHT} from "../../lib/chart/CandleChart.ts";
import {Candle, DrawingTool, IndicatorType, PriceLine, TimeUnit} from "../../lib/chart/types.ts";
import type {AssetType} from "../../type/NotificationType.ts";

export interface CandleChartProps {
    candles: Candle[],      // 오래된 순
    timeUnit: TimeUnit,
    seriesKey?: string,     // 종목·주기처럼 다른 차트로 바뀌는 기준. 바뀌면 드래그·확대 상태를 기본 보기로 되돌린다
    // 그린 선을 계정에 저장하는 기준. 주기를 바꿔도 같은 선을 보여 준다. 둘 다 주지 않으면 저장하지 않는다
    assetType?: AssetType,
    assetCode?: string,
    movingAverages?: number[],  // 이동평균선 기간. 색은 순서대로 success·warning·secondary·text.primary
    indicators?: IndicatorType[],   // 차트 아래에 쌓을 보조지표
    priceLines?: PriceLine[],   // 특정 가격에 긋는 가로선 (목표가 등)
    height?: number,            // 가격+거래량 영역 높이. 보조지표 영역은 이 아래에 더해진다
}

const DEFAULT_MOVING_AVERAGES = [5, 20, 60, 120];
const DEFAULT_INDICATORS: IndicatorType[] = ['rsi', 'macd'];
const NO_PRICE_LINES: PriceLine[] = [];
const NO_MOVING_AVERAGES: number[] = [];

// 설정 창에서 켜고 끄는 항목의 key. 이동평균선 전체가 하나, 보조지표는 종류별로 하나
const AVERAGE_TOGGLE = 'average';
const INDICATOR_LABELS: Record<IndicatorType, string> = {rsi: 'RSI', macd: 'MACD'};

// 설정 창의 화면 요소 스위치. 꺼 둔 지표와 같은 목록(hidden)에 저장한다
const TOOLBAR_TOGGLE = 'drawingToolbar';
const LAYOUT_OPTIONS: ChartSettingOption[] = [{key: TOOLBAR_TOGGLE, label: '그리기 도구 모음 표시'}];

// Alt 와 함께 누르는 그리기 단축키 (KeyboardEvent.code)
const TOOL_SHORTCUTS: Record<string, DrawingTool | undefined> = {KeyT: 'trend', KeyH: 'horizontal'};

// 그리기 도구를 고른 뒤 차트 위에 보여 주는 안내
const TOOL_HINTS: Record<DrawingTool, string> = {
    trend: '추세선: 차트에서 시작점을 누른 채 끌었다가 놓으세요.',
    horizontal: '수평선: 차트에서 원하는 가격을 누르세요.',
};

const CandleChart = ({
    candles, timeUnit, seriesKey, assetType, assetCode,
    movingAverages = DEFAULT_MOVING_AVERAGES, indicators = DEFAULT_INDICATORS, priceLines = NO_PRICE_LINES,
    height = 400,
}: CandleChartProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<CandleChartEngine | null>(null);
    const {mode, systemMode} = useColorScheme();

    // 그린 선과 차트 설정(꺼 둔 지표)은 계정에 저장한다.
    const {drawings, updateDrawings, hidden, setVisible} = useChartStorage(assetType, assetCode);
    const [tool, setTool] = useState<DrawingTool | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [atLatest, setAtLatest] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingOptions = useMemo<ChartSettingOption[]>(() => [
        ...(movingAverages.length > 0
            ? [{key: AVERAGE_TOGGLE, label: `이동평균선 (${movingAverages.join('·')})`}]
            : []),
        ...indicators.map(type => ({key: type, label: INDICATOR_LABELS[type]})),
    ], [movingAverages, indicators]);
    const activeAverages = hidden.includes(AVERAGE_TOGGLE) ? NO_MOVING_AVERAGES : movingAverages;
    const activeIndicators = useMemo(
        () => indicators.filter(type => !hidden.includes(type)),
        [indicators, hidden],
    );

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
        engine.onLatestChange = setAtLatest;

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
        engineRef.current?.setMovingAverages(activeAverages);
    }, [activeAverages]);

    useEffect(() => {
        engineRef.current?.setIndicators(activeIndicators);
    }, [activeIndicators]);

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

    // 단축키: Alt+T 추세선, Alt+H 수평선, Esc 취소. 글자를 입력하는 중에는 동작하지 않는다.
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target instanceof HTMLElement ? event.target : null;
            if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
            if (event.key === 'Escape') {
                setTool(null);
                return;
            }
            if (!event.altKey || event.ctrlKey || event.metaKey) return;
            const next = TOOL_SHORTCUTS[event.code];
            if (!next) return;
            event.preventDefault();
            setTool(next);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const toolbarVisible = !hidden.includes(TOOLBAR_TOGGLE);

    return (
        <Box>
            {/* 위쪽 줄: 그리기 도구 모음(설정에서 숨길 수 있다), 그리는 중일 때의 안내, 최근으로 이동, 차트 설정 */}
            <Stack direction="row" spacing={1} sx={{px: 2, pb: 1, alignItems: 'center', minHeight: 40}}>
                {toolbarVisible && <ChartDrawingToolbar tool={tool} onSelectTool={setTool}/>}
                {tool && (
                    <>
                        {/* 좁은 화면에서는 안내 문구를 생략해 버튼이 한 줄에 들어가게 한다. */}
                        <Typography variant="body2" noWrap sx={{color: 'text.secondary', display: {xs: 'none', sm: 'block'}}}>
                            {TOOL_HINTS[tool]}
                        </Typography>
                        {/* 도구 모음을 숨긴 채 단축키로 그릴 때는 취소할 버튼이 없으므로 따로 보여 준다. */}
                        {!toolbarVisible && <Button size="small" onClick={() => setTool(null)}>취소</Button>}
                    </>
                )}

                {/* 오른쪽: 최근으로 이동(과거를 보고 있을 때만), 차트 설정 */}
                <Box sx={{flexGrow: 1}}/>
                {!atLatest && (
                    <Tooltip title="최근으로 이동">
                        <IconButton
                            size="small"
                            aria-label="최근으로 이동"
                            onClick={() => engineRef.current?.scrollToLatest()}
                        >
                            <KeyboardDoubleArrowRightIcon fontSize="small"/>
                        </IconButton>
                    </Tooltip>
                )}
                <Tooltip title="차트 설정">
                    <IconButton size="small" aria-label="차트 설정" onClick={() => setSettingsOpen(true)}>
                        <SettingsIcon fontSize="small"/>
                    </IconButton>
                </Tooltip>
            </Stack>
            <ChartSettingsDialog
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                indicatorOptions={settingOptions}
                layoutOptions={LAYOUT_OPTIONS}
                hidden={hidden}
                onToggle={setVisible}
                drawingCount={drawings.length}
                onClearDrawings={() => updateDrawings([])}
            />
            <Stack direction="row">
                <Box sx={{position: 'relative', flexGrow: 1, minWidth: 0}}>
                    {/* 선을 선택하면 차트 위쪽 가운데에 그 선에 대한 버튼이 뜬다. */}
                    {selectedId && !tool && (
                        <Paper
                            elevation={3}
                            sx={{position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 2}}
                        >
                            <Tooltip title="선택한 선 삭제 (Delete)">
                                <IconButton
                                    size="small"
                                    aria-label="선택한 선 삭제"
                                    onClick={() => updateDrawings(drawings.filter(drawing => drawing.id !== selectedId))}
                                >
                                    <DeleteOutlineIcon fontSize="small"/>
                                </IconButton>
                            </Tooltip>
                        </Paper>
                    )}
                    <Box
                        ref={containerRef}
                        sx={(theme) => ({
                            position: 'relative',
                            width: '100%',
                            height: height + activeIndicators.length * INDICATOR_PANE_HEIGHT,
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
            </Stack>
        </Box>
    );
};

export default CandleChart;
