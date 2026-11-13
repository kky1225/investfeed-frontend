import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {requireOk} from "../../lib/apiResponse.ts";
import {
    fetchChartDrawings, fetchChartSetting, saveChartDrawings, saveChartSetting,
} from "../../api/chart/ChartApi.ts";
import type {AssetType} from "../../type/NotificationType.ts";
import type {ChartIndicatorSetting, ChartSetting} from "../../type/ChartType.ts";
import type {Drawing} from "../../lib/chart/types.ts";
import {loadDrawings, saveDrawings} from "../../lib/chart/drawingStorage.ts";
import {clearChartSettings, loadChartSettings} from "../../lib/chart/settingsStorage.ts";

const SAVE_DELAY_MS = 500;      // 선을 끌어 옮기는 동안 매번 저장하지 않도록 마지막 변경 뒤 이만큼 기다린다
const SETTINGS_KEY = ['chartSettings'];
const NO_DRAWINGS: Drawing[] = [];
// 아무것도 바꾸지 않은 상태
const DEFAULT_SETTING: ChartSetting = {indicators: {}, drawingToolbar: true, flatByPrevClose: false};
const LEGACY_TOOLBAR_KEY = 'drawingToolbar';    // 예전 브라우저 저장분에서 그리기 도구 모음을 숨겼다는 표시

const reportSaveError = (error: unknown) => console.error(error);

/**
 * 차트 설정과 그린 선을 계정에 저장한다. (설정은 회원당 하나, 선은 회원 + 종목별)
 * 화면은 먼저 바꾸고 저장은 뒤에서 한다. 조회가 끝나기 전이나 실패했을 때의 변경은 저장하지 않는다
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
    const [localDrawings, setLocalDrawings] = useState<Drawing[]>(NO_DRAWINGS);
    // 서버 조회가 끝나기 전이나 실패했을 때는 이 화면에서만 유지한다(저장하지 않음).
    const drawingsReady = hasAsset && drawingsQuery.isSuccess;
    const drawings = drawingsReady ? drawingsQuery.data ?? NO_DRAWINGS : localDrawings;

    // 밀린 저장. 종목이 바뀌거나 화면을 떠날 때는 기다리지 않고 바로 보낸다.
    const pendingSave = useRef<{ timer: ReturnType<typeof setTimeout>, run: () => void } | null>(null);
    const flushSave = useCallback(() => {
        const pending = pendingSave.current;
        if (!pending) return;
        clearTimeout(pending.timer);
        pendingSave.current = null;
        pending.run();
    }, []);
    useEffect(() => flushSave, [flushSave, drawingsKey]);

    const updateDrawings = (next: Drawing[]) => {
        if (!assetType || !assetCode || !drawingsReady) {
            setLocalDrawings(next);
            return;
        }
        queryClient.setQueryData(drawingsKey, next);
        if (pendingSave.current) clearTimeout(pendingSave.current.timer);
        const run = () => {
            saveChartDrawings(assetType, assetCode, next).catch(reportSaveError);
        };
        pendingSave.current = {
            run,
            timer: setTimeout(() => {
                pendingSave.current = null;
                run();
            }, SAVE_DELAY_MS),
        };
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
    const settingQuery = useQuery<ChartSetting>({
        queryKey: SETTINGS_KEY,
        queryFn: async ({signal}) => requireOk(
            await fetchChartSetting({signal, skipGlobalError: true}),
            DEFAULT_SETTING,
        ),
        refetchOnWindowFocus: false,
        staleTime: Infinity,
    });
    const settingReady = settingQuery.isSuccess;
    // 지표별로 기본 상태에서 바꾼 것. 바꾸지 않은 지표는 없다
    const indicators = settingQuery.data?.indicators ?? DEFAULT_SETTING.indicators;
    const drawingToolbar = settingQuery.data?.drawingToolbar ?? DEFAULT_SETTING.drawingToolbar;
    const flatByPrevClose = settingQuery.data?.flatByPrevClose ?? DEFAULT_SETTING.flatByPrevClose;

    // 설정은 통째로 저장하므로, 바꾸는 항목 말고는 지금 값을 그대로 실어 보낸다.
    const saveSetting = (change: Partial<ChartSetting>) => {
        if (!settingReady) return;
        const next: ChartSetting = {indicators, drawingToolbar, flatByPrevClose, ...change};
        queryClient.setQueryData(SETTINGS_KEY, next);
        saveChartSetting(next).catch(reportSaveError);
    };

    /** 지표 하나의 바꾼 내용을 고친다. 바꾼 것이 하나도 남지 않으면 그 지표를 목록에서 뺀다. */
    const changeIndicator = (key: string, change: ChartIndicatorSetting) => {
        const merged = {...indicators[key], ...change};
        const rest = Object.fromEntries(Object.entries(indicators).filter(([name]) => name !== key));
        const hasOverride = typeof merged.on === 'boolean' || Array.isArray(merged.params);
        saveSetting({indicators: hasOverride ? {...rest, [key]: merged} : rest});
    };

    /** 지표를 켜거나 끈다. 그 지표의 기본 상태(defaultOn)와 같아지면 저장한 값을 지운다. */
    const setIndicatorOn = (key: string, on: boolean, defaultOn: boolean) => {
        changeIndicator(key, {on: on === defaultOn ? null : on});
    };

    /** 지표의 설정값을 바꾼다. null 이면 저장한 값을 지워 기본값으로 돌린다. */
    const setIndicatorParams = (key: string, values: number[] | null) => {
        changeIndicator(key, {params: values});
    };

    const setDrawingToolbar = (visible: boolean) => saveSetting({drawingToolbar: visible});
    const setFlatByPrevClose = (enabled: boolean) => saveSetting({flatByPrevClose: enabled});

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
        drawings, updateDrawings,
        indicators, setIndicatorOn, setIndicatorParams,
        drawingToolbar, setDrawingToolbar,
        flatByPrevClose, setFlatByPrevClose,
    };
};
