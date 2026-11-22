import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {queryOptions, useQuery, useQueryClient} from "@tanstack/react-query";
import {AxiosError, type AxiosRequestConfig, isAxiosError} from "axios";
import {requireOk} from "../../lib/apiResponse.ts";
import {
    fetchChartDrawings, fetchChartSetting, saveChartDrawings, saveChartSetting,
} from "../../api/chart/ChartApi.ts";
import type {AssetType} from "../../type/NotificationType.ts";
import type {ChartIndicatorSetting, ChartSetting} from "../../type/ChartType.ts";
import type {Drawing} from "../../lib/chart/types.ts";
import {loadDrawings, saveDrawings} from "../../lib/chart/drawingStorage.ts";
import {clearChartSettings, loadChartSettings} from "../../lib/chart/settingsStorage.ts";

// 마지막 변경 뒤 이만큼 기다렸다가 저장한다(그린 선과 설정 모두). 선을 끌어 옮기거나 설정을 이어서 바꾸는 동안은
// 저장하지 않는다. 그 전에 저장하려면 saveNow 를 부른다.
const SAVE_DELAY_MS = 5000;
const SETTINGS_KEY = ['chartSettings'];
const NO_DRAWINGS: Drawing[] = [];
// 아무것도 바꾸지 않은 상태
const DEFAULT_SETTING: ChartSetting = {
    indicators: {}, chartType: 'candle', logScale: false, percentScale: false, drawingToolbar: true,
    flatByPrevClose: false, magnet: 'off',
};
const LEGACY_TOOLBAR_KEY = 'drawingToolbar';    // 예전 브라우저 저장분에서 그리기 도구 모음을 숨겼다는 표시

const reportSaveError = (error: unknown) => console.error(error);

/**
 * 저장을 보내는 방식. quiet 는 실패해도 오류 창을 띄우지 않는다.
 * closing 은 탭이 가려지는 순간에 보내는 것으로, 페이지가 닫히거나 새로고침되어도 요청이 끊기지 않게 한다.
 */
type SaveMode = 'quiet' | 'closing';
/** 저장 한 번. 서버가 받아들이지 않으면 실패(reject)여야 한다 */
type SaveRun = (mode?: SaveMode) => Promise<unknown>;

// 페이지가 닫혀도 이어지는 요청(keepalive)은 브라우저가 본문 크기를 64KB 로 제한한다. 넘으면 보통 요청으로 보낸다
// (그 저장은 탭을 바꿀 때는 나가지만, 새로고침하거나 닫을 때는 끊길 수 있다).
const KEEPALIVE_BODY_LIMIT = 60_000;

/** 저장 요청에 붙일 설정. body 는 보낼 내용(크기를 재는 데만 쓴다) */
const saveConfig = (mode: SaveMode | undefined, body: unknown): AxiosRequestConfig => {
    if (mode === 'quiet') return {skipGlobalError: true};
    if (mode !== 'closing' || new Blob([JSON.stringify(body)]).size > KEEPALIVE_BODY_LIMIT) return {};
    // keepalive 는 fetch 로만 보낼 수 있다. fetch 를 쓸 수 없는 환경이면 보통 요청(xhr)으로 보낸다
    return {adapter: ['fetch', 'xhr'], fetchOptions: {keepalive: true}};
};

/**
 * 저장 요청을 mode 에 맞는 설정으로 보낸다. request 는 받은 설정으로 요청을 보내는 함수.
 * keepalive 요청은 진행 중인 것들의 본문을 합쳐 64KB 를 넘으면 브라우저가 보내지 않고 바로 거부한다(여러 차트가
 * 한꺼번에 저장할 때). 그렇게 응답 없이 실패하면 보통 요청으로 한 번 더 보낸다. 서버가 거부한 것은 다시 보내지 않는다.
 */
const sendSave = <T, >(mode: SaveMode | undefined, body: unknown, request: (config: AxiosRequestConfig) => Promise<T>) => {
    const config = saveConfig(mode, body);
    if (!config.fetchOptions) return request(config);
    // 첫 시도의 실패는 다시 보낼 수 있으므로 오류 창을 띄우지 않는다
    return request({...config, skipGlobalError: true}).catch((error: unknown) => {
        // 보내지 못한 것(네트워크 오류)만 다시 보낸다. 응답이 늦어 끊긴 것(타임아웃)은 다시 보내지 않는다.
        // 그 사이 더 새로운 저장이 나갔을 수 있어, 늦게 다시 보내면 예전 내용으로 덮어쓴다.
        // 다시 보낸 보통 요청은 페이지가 닫히면 끊기므로, 이 경우는 탭을 바꿀 때만 저장된다.
        if (!isAxiosError(error) || error.code !== AxiosError.ERR_NETWORK) throw error;
        return request({});
    });
};

// 차트 설정 조회. 회원당 하나라 모든 차트가 같은 조회를 함께 쓴다
const settingQueryOptions = queryOptions<ChartSetting>({
    queryKey: SETTINGS_KEY,
    queryFn: async ({signal}) => requireOk(
        await fetchChartSetting({signal, skipGlobalError: true}),
        DEFAULT_SETTING,
    ),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
});

/** "내 매매 표시"를 켜 두었는지. 차트 밖(조회를 맡는 화면)에서 설정 창의 스위치를 따라가려고 쓴다 */
export const useChartTradesSetting = (): boolean => useQuery(settingQueryOptions).data?.trades ?? false;

/**
 * 저장을 모아서 보낸다. schedule 로 맡긴 저장은 마지막으로 맡긴 뒤 delayMs 가 지나면 한 번만 실행되고,
 * 그 사이에 다시 맡기면 앞의 것은 버린다. flush 는 밀린 저장을 기다리지 않고 바로 실행한다.
 * waiting 은 아직 저장이 끝나지 않은 것이 있는지(보내지 않았거나, 보내고 응답을 기다리는 중).
 * 보낸 저장이 실패하면 failed 가 true 가 되고, 그 저장은 다음 flush 때 다시 보낸다(스스로 되풀이해 보내지는 않는다.
 * 선이 너무 많은 경우처럼 다시 보내도 실패하는 저장이 있기 때문이다). 그 뒤의 저장이 성공하면 failed 가 풀린다.
 * leave 는 저장하던 대상을 떠날 때(종목이 바뀜, 화면을 나감) 부른다. 밀린 저장을 바로 보내고 실패한 저장은 조용히
 * 한 번 더 보낸 뒤, 그 결과는 더 따라가지 않는다(다음 대상의 저장 표시에 섞이지 않게).
 * flushClosing 은 탭이 가려질 때 부른다. 밀린 저장을 페이지가 닫혀도 끊기지 않는 요청으로 바로 보낸다.
 * 밀린 것은 없지만 보통 요청으로 보내고 아직 응답을 받지 못한 저장이 있으면, 그 요청은 페이지가 닫힐 때 끊기므로
 * 같은 저장을 끊기지 않는 요청으로 한 번 더 보낸다(전체를 바꿔 넣는 저장이라 두 번 가도 결과가 같다).
 */
const useDelayedSave = (delayMs: number) => {
    const pending = useRef<{ timer: ReturnType<typeof setTimeout>, run: SaveRun } | null>(null);
    const failedRun = useRef<SaveRun | null>(null);     // 보냈다가 실패해 다시 보내야 하는 저장
    const sendCount = useRef(0);    // 가장 나중에 보낸 저장의 결과만 반영하려고 센다
    // 보내고 아직 응답을 받지 못한 저장
    const inFlight = useRef<{ order: number, run: SaveRun, mode: SaveMode | undefined } | null>(null);
    const [waiting, setWaiting] = useState(false);
    const [failed, setFailed] = useState(false);
    const send = useCallback((run: SaveRun, mode?: SaveMode) => {
        const order = ++sendCount.current;
        failedRun.current = null;
        inFlight.current = {order, run, mode};
        setWaiting(true);
        const landed = () => {
            if (inFlight.current?.order === order) inFlight.current = null;
        };
        // 응답을 받으면 기다림을 푼다. 그 사이 새 저장을 맡겼으면 그 저장이 끝날 때까지 그대로 둔다.
        const settle = () => {
            if (!pending.current) setWaiting(false);
        };
        run(mode).then(() => {
            landed();
            if (order !== sendCount.current) return;
            setFailed(false);
            settle();
        }).catch((error: unknown) => {
            console.error(error);
            landed();
            if (order !== sendCount.current) return;
            failedRun.current = run;
            setFailed(true);
            settle();
        });
    }, []);
    const flush = useCallback(() => {
        const current = pending.current;
        if (current) {
            clearTimeout(current.timer);
            pending.current = null;
            send(current.run);
        } else if (failedRun.current) {
            send(failedRun.current);
        }
    }, [send]);
    const flushClosing = useCallback(() => {
        const current = pending.current;
        const sent = inFlight.current;
        if (current) {
            clearTimeout(current.timer);
            pending.current = null;
            send(current.run, 'closing');
        } else if (sent && sent.mode !== 'closing') {
            send(sent.run, 'closing');
        }
    }, [send]);
    const leave = useCallback(() => {
        const current = pending.current;
        const retry = failedRun.current;
        if (current) clearTimeout(current.timer);
        pending.current = null;
        failedRun.current = null;
        inFlight.current = null;
        sendCount.current++;    // 보내 둔 저장의 결과도 더는 반영하지 않는다
        setWaiting(false);
        setFailed(false);
        // 밀린 저장은 보내는 시점의 내용을 보내므로 실패한 저장의 내용도 담고 있다
        if (current) current.run().catch(reportSaveError);
        else if (retry) retry('quiet').catch(reportSaveError);
    }, []);
    const schedule = useCallback((run: SaveRun) => {
        if (pending.current) clearTimeout(pending.current.timer);
        setWaiting(true);
        pending.current = {
            run,
            timer: setTimeout(() => {
                pending.current = null;
                send(run);
            }, delayMs),
        };
    }, [delayMs, send]);
    return {schedule, flush, flushClosing, leave, waiting, failed};
};

/**
 * 차트 설정과 그린 선을 계정에 저장한다. (설정은 회원당 하나, 선은 회원 + 종목별)
 * 화면은 먼저 바꾸고 저장은 뒤에서 모아서 한다(마지막 변경 5초 뒤. saveNow 로 바로 보낼 수 있다). 조회가 끝나기 전이나 실패했을 때의 변경은 저장하지 않는다
 * (서버에 있던 내용을 덮어쓰지 않기 위함).
 * 종목을 주지 않으면 그린 선은 이 화면에서만 유지한다.
 */
export const useChartStorage = (assetType: AssetType | undefined, assetCode: string | undefined) => {
    const queryClient = useQueryClient();
    const hasAsset = Boolean(assetType && assetCode);

    // ---------- 그린 선 ----------
    const drawingsKey = useMemo(() => ['chartDrawings', assetType, assetCode], [assetType, assetCode]);
    const drawingsQuery = useQuery<Drawing[]>({
        queryKey: drawingsKey,
        queryFn: async ({signal}) => requireOk(
            await fetchChartDrawings(assetType as AssetType, assetCode as string, {signal, skipGlobalError: true}),
            {drawings: []},
        ).drawings,
        enabled: hasAsset,
        refetchOnWindowFocus: false,
        staleTime: Infinity,    // 이 화면에서 바꾼 내용이 곧 최신이라 다시 조회하지 않는다
    });
    // 서버 조회가 끝나기 전이나 실패했을 때는 이 화면에서만 유지한다(저장하지 않음).
    // 어느 종목에 그은 것인지 함께 두어, 종목이 바뀌면 앞 종목의 선이 보이지 않게 한다.
    const [local, setLocal] = useState<{
        assetType: AssetType | undefined, assetCode: string | undefined, drawings: Drawing[],
    } | null>(null);
    const localDrawings = local && local.assetType === assetType && local.assetCode === assetCode
        ? local.drawings : NO_DRAWINGS;
    const setLocalDrawings = (next: Drawing[]) => setLocal({assetType, assetCode, drawings: next});
    const drawingsReady = hasAsset && drawingsQuery.isSuccess;
    const drawings = drawingsReady ? drawingsQuery.data ?? NO_DRAWINGS : localDrawings;

    // 밀린 저장. 종목이 바뀌거나 화면을 떠날 때는 기다리지 않고 바로 보낸다.
    const {
        schedule: scheduleDrawingSave, flush: flushDrawingSave, flushClosing: flushClosingDrawingSave,
        leave: leaveDrawingSave,
        waiting: drawingSaveWaiting, failed: drawingSaveFailed,
    } = useDelayedSave(SAVE_DELAY_MS);
    useEffect(() => leaveDrawingSave, [leaveDrawingSave, drawingsKey]);

    /**
     * 선 목록을 바꾸고, 화면이 쓰게 되는 목록을 돌려준다.
     * (조회 캐시는 받은 배열을 그대로 두지 않고 이전 것과 견줘 새 배열로 바꿔 넣으므로, 받은 배열과 다를 수 있다)
     */
    const updateDrawings = (next: Drawing[]): Drawing[] => {
        if (!assetType || !assetCode || !drawingsReady) {
            setLocalDrawings(next);
            return next;
        }
        const stored = queryClient.setQueryData<Drawing[]>(drawingsKey, next) ?? next;
        scheduleDrawingSave(mode => {
            // 보내는 시점에 화면이 쓰고 있는 목록을 보낸다. 같은 종목을 다른 차트(멀티뷰 패널과 자세히 보기 창)에서
            // 함께 열면 목록을 같이 쓰므로, 맡길 때의 목록을 보내면 그 사이 다른 차트에서 그은 선이 지워진다.
            const latest = queryClient.getQueryData<Drawing[]>(drawingsKey) ?? next;
            return sendSave(mode, latest, config => saveChartDrawings(assetType, assetCode, latest, config))
                .then(res => requireOk(res, '그린 선 저장'));
        });
        return stored;
    };

    // 예전에 브라우저에 저장해 둔 선을 계정으로 한 번 옮긴다. 서버에 이미 선이 있으면 서버 것을 쓴다.
    const serverDrawings = drawingsQuery.data;
    useEffect(() => {
        if (!assetType || !assetCode || !serverDrawings) return;
        const legacy = loadDrawings(assetCode);
        if (legacy.length === 0) return;
        saveDrawings(assetCode, []);
        if (serverDrawings.length > 0) return;
        queryClient.setQueryData(drawingsKey, legacy);
        saveChartDrawings(assetType, assetCode, legacy).catch(reportSaveError);
    }, [assetType, assetCode, serverDrawings, drawingsKey, queryClient]);

    // ---------- 차트 설정 ----------
    const settingQuery = useQuery(settingQueryOptions);
    const settingReady = settingQuery.isSuccess;
    // 지표별로 기본 상태에서 바꾼 것. 바꾸지 않은 지표는 없다
    const indicators = settingQuery.data?.indicators ?? DEFAULT_SETTING.indicators;
    const chartType = settingQuery.data?.chartType ?? DEFAULT_SETTING.chartType;
    const logScale = settingQuery.data?.logScale ?? DEFAULT_SETTING.logScale;
    const percentScale = settingQuery.data?.percentScale ?? DEFAULT_SETTING.percentScale;
    const drawingToolbar = settingQuery.data?.drawingToolbar ?? DEFAULT_SETTING.drawingToolbar;
    const flatByPrevClose = settingQuery.data?.flatByPrevClose ?? DEFAULT_SETTING.flatByPrevClose;
    const magnet = settingQuery.data?.magnet ?? DEFAULT_SETTING.magnet;
    const magnetIndicators = settingQuery.data?.magnetIndicators ?? false;
    const grid = settingQuery.data?.grid ?? true;
    const trades = settingQuery.data?.trades ?? false;
    // 영역 크기. 바꾼 적이 없으면 null 이고 차트가 기본 크기를 쓴다
    const volumeRatio = settingQuery.data?.volumeRatio ?? null;
    const mainHeight = settingQuery.data?.mainHeight ?? null;
    // 별도 영역 지표를 놓는 순서. 바꾼 적이 없으면 null 이고 정해진 순서를 쓴다
    const paneOrder = settingQuery.data?.paneOrder ?? null;

    // 밀린 설정 저장. 화면을 떠날 때는 기다리지 않고 바로 보낸다.
    const {
        schedule: scheduleSettingSave, flush: flushSettingSave, flushClosing: flushClosingSettingSave,
        leave: leaveSettingSave,
        waiting: settingSaveWaiting, failed: settingSaveFailed,
    } = useDelayedSave(SAVE_DELAY_MS);
    useEffect(() => leaveSettingSave, [leaveSettingSave]);

    // 탭이 가려지면(다른 탭으로 감, 새로고침, 탭·창 닫기) 밀린 저장을 기다리지 않고 보낸다.
    // 새로고침이나 닫기에서는 화면을 떠날 때의 정리가 실행되지 않아, 5초를 기다리던 저장이 그대로 사라지기 때문이다.
    useEffect(() => {
        const sendPending = () => {
            flushClosingDrawingSave();
            flushClosingSettingSave();
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') sendPending();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('pagehide', sendPending);   // visibilitychange 없이 닫히는 브라우저용
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('pagehide', sendPending);
        };
    }, [flushClosingDrawingSave, flushClosingSettingSave]);

    // 아직 저장되지 않은 것이 있는지(보내지 않았거나 보냈다가 실패함)와, 기다리지 않고 지금 보내기
    // (저장 버튼, 설정 창을 닫을 때). 실패한 저장도 이때 다시 보낸다.
    const saveFailed = drawingSaveFailed || settingSaveFailed;
    const unsaved = drawingSaveWaiting || settingSaveWaiting || saveFailed;
    const saveNow = useCallback(() => {
        flushDrawingSave();
        flushSettingSave();
    }, [flushDrawingSave, flushSettingSave]);

    // 설정은 통째로 저장하므로, 바꾸는 항목 말고는 지금 값을 그대로 실어 보낸다.
    // 화면은 바로 바꾸고, 저장은 연달아 바꾼 것을 모아 마지막 상태만 한 번 보낸다.
    const saveSetting = (change: Partial<ChartSetting>) => {
        if (!settingReady) return;
        const next: ChartSetting = {
            indicators, chartType, logScale, percentScale, drawingToolbar, flatByPrevClose, magnet,
            magnetIndicators, grid, trades, volumeRatio, mainHeight, paneOrder, ...change,
        };
        queryClient.setQueryData(SETTINGS_KEY, next);
        scheduleSettingSave(mode => {
            // 보내는 시점에 화면이 쓰고 있는 설정을 보낸다
            const latest = queryClient.getQueryData<ChartSetting>(SETTINGS_KEY) ?? next;
            return sendSave(mode, latest, config => saveChartSetting(latest, config))
                .then(res => requireOk(res, '차트 설정 저장'));
        });
    };

    /** 지표 하나의 바꾼 내용을 고친다. 바꾼 것이 하나도 남지 않으면 그 지표를 목록에서 뺀다. */
    const changeIndicator = (key: string, change: ChartIndicatorSetting) => {
        const merged = {...indicators[key], ...change};
        const rest = Object.fromEntries(Object.entries(indicators).filter(([name]) => name !== key));
        const hasOverride = typeof merged.on === 'boolean' || Array.isArray(merged.params) || Array.isArray(merged.colors)
            || Array.isArray(merged.widths) || Array.isArray(merged.dashes) || typeof merged.height === 'number';
        saveSetting({indicators: hasOverride ? {...rest, [key]: merged} : rest});
    };

    /** 지표를 켜거나 끈다. 그 지표의 기본 상태(defaultOn)와 같아지면 저장한 값을 지운다. */
    const setIndicatorOn = (key: string, on: boolean, defaultOn: boolean) => {
        changeIndicator(key, {on: on === defaultOn ? null : on});
    };

    /**
     * 지표의 설정값(기간 등)이나 선 모양(색·굵기·점선)을 바꾼다. 준 항목만 바뀌고, null 을 주면 저장한 값을 지워
     * 기본값으로 돌린다. 선을 지울 때처럼 여럿이 함께 바뀌는 경우는 한 번에 준다.
     */
    const setIndicatorValues = (
        key: string, change: Pick<ChartIndicatorSetting, 'params' | 'colors' | 'widths' | 'dashes'>,
    ) => {
        changeIndicator(key, change);
    };

    /** 지표에 대해 저장해 둔 것(켜짐·설정값·선 모양·영역 높이)을 모두 지운다. 하나 더 추가한 지표를 지울 때 쓴다. */
    const removeIndicator = (key: string) => {
        changeIndicator(key, {on: null, params: null, colors: null, widths: null, dashes: null, height: null});
    };

    const setChartType = (type: string) => saveSetting({chartType: type});
    const setLogScale = (enabled: boolean) => saveSetting({logScale: enabled});
    const setPercentScale = (enabled: boolean) => saveSetting({percentScale: enabled});
    const setDrawingToolbar = (visible: boolean) => saveSetting({drawingToolbar: visible});
    const setFlatByPrevClose = (enabled: boolean) => saveSetting({flatByPrevClose: enabled});
    const setMagnet = (mode: string) => saveSetting({magnet: mode});
    const setMagnetIndicators = (enabled: boolean) => saveSetting({magnetIndicators: enabled});
    const setGrid = (visible: boolean) => saveSetting({grid: visible});
    const setTrades = (visible: boolean) => saveSetting({trades: visible});
    // 영역 크기. null 을 주면 저장한 값을 지워 기본 크기로 돌린다
    const setVolumeRatio = (ratio: number | null) => saveSetting({volumeRatio: ratio});
    const setMainHeight = (height: number | null) => saveSetting({mainHeight: height});
    const setIndicatorHeight = (key: string, height: number | null) => changeIndicator(key, {height});
    const setPaneOrder = (order: string[]) => saveSetting({paneOrder: order});

    // 예전에 브라우저에 저장해 둔 설정(끈 항목 목록)을 계정으로 한 번 옮긴다. 서버에 이미 설정이 있으면 서버 것을 쓴다.
    const serverSetting = settingQuery.data;
    useEffect(() => {
        if (!serverSetting) return;
        const legacy = loadChartSettings().hidden;
        if (legacy.length === 0) return;
        clearChartSettings();
        const untouched = Object.keys(serverSetting.indicators ?? {}).length === 0
            && (serverSetting.drawingToolbar ?? true);
        if (!untouched) return;
        const next: ChartSetting = {
            ...DEFAULT_SETTING,
            ...serverSetting,
            indicators: Object.fromEntries(
                legacy.filter(key => key !== LEGACY_TOOLBAR_KEY).map(key => [key, {on: false}]),
            ),
            drawingToolbar: !legacy.includes(LEGACY_TOOLBAR_KEY),
        };
        queryClient.setQueryData(SETTINGS_KEY, next);
        saveChartSetting(next).catch(reportSaveError);
    }, [serverSetting, queryClient]);

    return {
        drawings, updateDrawings, drawingsReady,
        indicators, setIndicatorOn, setIndicatorValues, removeIndicator,
        chartType, setChartType,
        logScale, setLogScale,
        percentScale, setPercentScale,
        drawingToolbar, setDrawingToolbar,
        flatByPrevClose, setFlatByPrevClose,
        magnet, setMagnet,
        magnetIndicators, setMagnetIndicators,
        grid, setGrid,
        trades, setTrades,
        volumeRatio, setVolumeRatio,
        mainHeight, setMainHeight,
        setIndicatorHeight,
        paneOrder, setPaneOrder,
        unsaved, saveFailed, saveNow,
    };
};
