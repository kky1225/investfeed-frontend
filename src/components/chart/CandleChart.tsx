import {ReactNode, useEffect, useMemo, useRef, useState} from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SettingsIcon from "@mui/icons-material/Settings";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import Paper from "@mui/material/Paper";
import ChartSettingsDialog, {ChartIndicatorOption} from "./ChartSettingsDialog.tsx";
import {IndicatorParam, INDICATORS, normalizeParams} from "../../lib/chart/indicatorPanes.ts";
import ChartDrawingToolbar from "./ChartDrawingToolbar.tsx";
import {ChartToolbarButton} from "./ChartToolbarControls.tsx";
import {useChartStorage} from "./useChartStorage.ts";
import {useColorScheme} from "@mui/material/styles";
import {CandleChartEngine, INDICATOR_PANE_HEIGHT} from "../../lib/chart/CandleChart.ts";
import {Candle, DrawingTool, IndicatorConfig, IndicatorType, PriceLine, TimeUnit} from "../../lib/chart/types.ts";
import type {AssetType} from "../../type/NotificationType.ts";

export interface CandleChartProps {
    candles: Candle[],      // 오래된 순
    timeUnit: TimeUnit,
    seriesKey?: string,     // 종목·주기처럼 다른 차트로 바뀌는 기준. 바뀌면 드래그·확대 상태를 기본 보기로 되돌린다
    // 그린 선을 계정에 저장하는 기준. 주기를 바꿔도 같은 선을 보여 준다. 둘 다 주지 않으면 저장하지 않는다
    assetType?: AssetType,
    assetCode?: string,
    movingAverages?: number[],  // 이동평균선의 기본 기간(설정 창에서 바꿀 수 있다). 색은 순서대로 success·warning·secondary·grey
    indicators?: IndicatorType[],   // 이 차트에서 쓸 수 있는 보조지표. 기본은 등록된 전부이고, 켜고 끄는 것은 설정 창에서 한다
    priceLines?: PriceLine[],   // 특정 가격에 긋는 가로선 (목표가 등)
    // 화면 왼쪽 끝이 받아 둔 캔들의 처음에 가까워지면 부른다. 가까운 동안 여러 번 부르므로
    // 받는 쪽에서 요청 중이거나 더 받을 것이 없으면 무시해야 한다 (useCandleHistory 의 loadOlder)
    onLoadOlder?: () => void,
    toolbarStart?: ReactNode,   // 위쪽 줄 맨 앞에 놓을 화면별 버튼 (주기, 차트 종류 등)
    height?: number,            // 가격+거래량 영역 높이. 보조지표 영역은 이 아래에 더해진다
}

const DEFAULT_MOVING_AVERAGES = [5, 20, 60, 120];
const DEFAULT_INDICATORS = Object.keys(INDICATORS) as IndicatorType[];
const NO_PRICE_LINES: PriceLine[] = [];
const NO_MOVING_AVERAGES: number[] = [];

// 설정에 저장하는 이동평균선의 key. 선 전체를 한 번에 켜고 끄며, 설정값은 선마다의 기간이다. 보조지표의 key 는 종류 이름
const AVERAGE_KEY = 'average';
const AVERAGE_PERIOD_MAX = 500;

/** 설정 창에 보이는 지표 한 줄의 정의: 이동평균선 + 보조지표들 */
interface IndicatorEntry {
    key: string,
    label: string,
    defaultOn: boolean,
    specs: IndicatorParam[],
}

// Alt 와 함께 누르는 그리기 단축키 (KeyboardEvent.code)
const TOOL_SHORTCUTS: Record<string, DrawingTool | undefined> = {KeyT: 'trend', KeyH: 'horizontal'};

// 그리기 도구를 고른 뒤 차트 위에 보여 주는 안내
const TOOL_HINTS: Record<DrawingTool, string> = {
    trend: '추세선: 차트에서 시작점을 누른 채 끌었다가 놓으세요.',
    horizontal: '수평선: 차트에서 원하는 가격을 누르세요.',
};

const CandleChart = ({
    candles, timeUnit, seriesKey, assetType, assetCode, toolbarStart, onLoadOlder,
    movingAverages = DEFAULT_MOVING_AVERAGES, indicators = DEFAULT_INDICATORS, priceLines = NO_PRICE_LINES,
    height = 400,
}: CandleChartProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<CandleChartEngine | null>(null);
    const {mode, systemMode} = useColorScheme();

    // 그린 선과 차트 설정(꺼 둔 지표)은 계정에 저장한다.
    const {
        drawings, updateDrawings,
        indicators: indicatorSettings, setIndicatorOn, setIndicatorParams,
        drawingToolbar: toolbarVisible, setDrawingToolbar,
        flatByPrevClose, setFlatByPrevClose,
    } = useChartStorage(assetType, assetCode);
    const [tool, setTool] = useState<DrawingTool | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [atLatest, setAtLatest] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(false);
    // 이 차트에서 쓸 수 있는 지표들: 이동평균선(선마다 기간 하나) + 보조지표
    const entries = useMemo<IndicatorEntry[]>(() => [
        ...(movingAverages.length > 0 ? [{
            key: AVERAGE_KEY,
            label: '이동평균선',
            defaultOn: true,
            specs: movingAverages.map((period, order) => (
                {label: `선 ${order + 1}`, default: period, min: 1, max: AVERAGE_PERIOD_MAX, step: 1}
            )),
        }] : []),
        ...indicators.map(type => {
            const {label, defaultOn, params: specs} = INDICATORS[type];
            return {key: type, label, defaultOn, specs};
        }),
    ], [movingAverages, indicators]);

    // 저장된 설정을 입혀 설정 창에 보일 상태로 만든다.
    const indicatorOptions = useMemo<ChartIndicatorOption[]>(() => entries.map(entry => {
        const saved = indicatorSettings[entry.key];
        const values = normalizeParams(entry.specs, saved?.params ?? undefined);
        return {
            key: entry.key,
            label: entry.label,
            on: saved?.on ?? entry.defaultOn,
            params: entry.specs.map((spec, order) => ({...spec, value: values[order]})),
            customized: entry.specs.some((spec, order) => spec.default !== values[order]),
        };
    }), [entries, indicatorSettings]);

    // 엔진에 넘길 것: 켜 둔 이동평균선의 기간들, 켜 둔 보조지표와 설정값
    const activeAverages = useMemo(() => {
        const option = indicatorOptions.find(item => item.key === AVERAGE_KEY);
        return option?.on ? option.params.map(param => param.value) : NO_MOVING_AVERAGES;
    }, [indicatorOptions]);
    const activeIndicators = useMemo<IndicatorConfig[]>(() => indicatorOptions
        .filter(option => option.on && option.key !== AVERAGE_KEY)
        .map(option => ({type: option.key as IndicatorType, params: option.params.map(param => param.value)})),
    [indicatorOptions]);
    // 차트 아래에 따로 영역을 차지하는 지표의 수. 그만큼 전체 높이를 늘린다
    const paneCount = activeIndicators.filter(config => INDICATORS[config.type].placement === 'pane').length;

    const toggleIndicator = (key: string, on: boolean) => {
        setIndicatorOn(key, on, entries.find(entry => entry.key === key)?.defaultOn ?? true);
    };

    // 엔진은 한 번만 만들어지므로, 엔진이 부를 함수는 ref 로 최신 것을 가리키게 한다.
    const updateDrawingsRef = useRef(updateDrawings);
    const loadOlderRef = useRef(onLoadOlder);
    useEffect(() => {
        updateDrawingsRef.current = updateDrawings;
        loadOlderRef.current = onLoadOlder;
    });

    // 캔들이 하나도 없으면(장 시작 전의 분봉 등) 차트가 그려지지 않아 왼쪽 끝 감지도 안 되므로, 직접 과거 구간을 요청한다.
    useEffect(() => {
        if (candles.length === 0) loadOlderRef.current?.();
    }, [candles.length, seriesKey]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const engine = new CandleChartEngine(container);
        engineRef.current = engine;
        engine.onDrawingsChange = next => updateDrawingsRef.current(next);
        engine.onToolChange = setTool;
        engine.onSelectionChange = setSelectedId;
        engine.onLatestChange = setAtLatest;
        engine.onNeedOlder = () => loadOlderRef.current?.();

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
        engineRef.current?.setFlatByPrevClose(flatByPrevClose);
    }, [flatByPrevClose]);

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
                lineColors: [
                    '--chart-line-1', '--chart-line-2', '--chart-line-3', '--chart-line-4', '--chart-line-5',
                    '--chart-line-6',
                ].map(color),
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

    return (
        <Box>
            {/* 위쪽 한 줄에 모든 버튼을 모은다: 화면별 버튼(주기 등) · 그리기 도구 모음 · 안내 … 최근으로 이동 · 차트 설정 */}
            <Stack direction="row" spacing={1} sx={{px: 2, pb: 1, alignItems: 'center', minHeight: 40}}>
                {toolbarStart}
                {toolbarStart && toolbarVisible && <Divider orientation="vertical" flexItem sx={{my: 1}}/>}
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
                        <ChartToolbarButton
                            aria-label="최근으로 이동"
                            onClick={() => engineRef.current?.scrollToLatest()}
                        >
                            <KeyboardDoubleArrowRightIcon/>
                        </ChartToolbarButton>
                    </Tooltip>
                )}
                <Tooltip title="차트 설정">
                    <ChartToolbarButton aria-label="차트 설정" onClick={() => setSettingsOpen(true)}>
                        <SettingsIcon/>
                    </ChartToolbarButton>
                </Tooltip>
            </Stack>
            <ChartSettingsDialog
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                indicatorOptions={indicatorOptions}
                onToggleIndicator={toggleIndicator}
                onParamsChange={setIndicatorParams}
                onParamsReset={key => setIndicatorParams(key, null)}
                drawingToolbar={toolbarVisible}
                onDrawingToolbarChange={setDrawingToolbar}
                flatByPrevClose={flatByPrevClose}
                onFlatByPrevCloseChange={setFlatByPrevClose}
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
                            height: height + paneCount * INDICATOR_PANE_HEIGHT,
                            '--chart-up': (theme.vars || theme).palette.error.main,
                            // 하락색은 info.main 대신 primary.main 을 쓴다. 라이트 모드의 info.main 은 밝은 하늘색이라
                            // 진한 빨강(error.main)과 무게가 맞지 않고 캔들이 흐려 보인다
                            '--chart-down': (theme.vars || theme).palette.primary.main,
                            '--chart-text': (theme.vars || theme).palette.text.secondary,
                            '--chart-grid': (theme.vars || theme).palette.divider,
                            '--chart-background': (theme.vars || theme).palette.background.paper,
                            '--chart-line-1': (theme.vars || theme).palette.success.main,
                            '--chart-line-2': (theme.vars || theme).palette.warning.main,
                            '--chart-line-3': (theme.vars || theme).palette.secondary.main,
                            '--chart-line-4': (theme.vars || theme).palette.grey[500],
                            '--chart-line-5': (theme.vars || theme).palette.text.primary,
                            '--chart-line-6': (theme.vars || theme).palette.info.main,
                        })}
                    />
                </Box>
            </Stack>
        </Box>
    );
};

export default CandleChart;
