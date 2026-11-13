import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {requireOk} from "../../lib/apiResponse.ts";
import {
    fetchChartDrawings, fetchChartSetting, saveChartDrawings, saveChartSetting,
} from "../../api/chart/ChartApi.ts";
import type {AssetType} from "../../type/NotificationType.ts";
import type {ChartSetting} from "../../type/ChartType.ts";
import type {Drawing} from "../../lib/chart/types.ts";
import {loadDrawings, saveDrawings} from "../../lib/chart/drawingStorage.ts";
import {clearChartSettings, loadChartSettings} from "../../lib/chart/settingsStorage.ts";

const SAVE_DELAY_MS = 500;      // 선을 끌어 옮기는 동안 매번 저장하지 않도록 마지막 변경 뒤 이만큼 기다린다
const SETTINGS_KEY = ['chartSettings'];
const NO_DRAWINGS: Drawing[] = [];
const NO_HIDDEN: string[] = [];

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
            {hidden: []},
        ),
        refetchOnWindowFocus: false,
        staleTime: Infinity,
    });
    const hidden = settingQuery.data?.hidden ?? NO_HIDDEN;
    const settingReady = settingQuery.isSuccess;

    const setVisible = (key: string, visible: boolean) => {
        if (!settingReady) return;
        const next: ChartSetting = {hidden: visible ? hidden.filter(item => item !== key) : [...hidden, key]};
        queryClient.setQueryData(SETTINGS_KEY, next);
        saveChartSetting(next).catch(reportSaveError);
    };

    // 예전에 브라우저에 저장해 둔 설정을 계정으로 한 번 옮긴다. 서버에 이미 설정이 있으면 서버 것을 쓴다.
    const serverSetting = settingQuery.data;
    useEffect(() => {
        if (!serverSetting) return;
        const legacy = loadChartSettings().hidden;
        if (legacy.length === 0) return;
        clearChartSettings();
        if (serverSetting.hidden.length > 0) return;
        const next: ChartSetting = {hidden: legacy};
        queryClient.setQueryData(SETTINGS_KEY, next);
        saveChartSetting(next).catch(reportSaveError);
    }, [serverSetting, queryClient]);

    return {drawings, updateDrawings, hidden, setVisible};
};
