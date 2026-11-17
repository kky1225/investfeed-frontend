import {useCallback, useState} from "react";
import type {MiniChartMode} from "../../lib/chart/MiniChart.ts";

// 목록 카드의 차트를 선으로 볼지 캔들로 볼지. 목록 화면들이 함께 쓰고 브라우저(localStorage)에 기억한다.

const STORAGE_KEY = 'listChartMode';
const MODES: MiniChartMode[] = ['line', 'candle'];
const INITIAL_MODE: MiniChartMode = 'line';

const loadMode = (): MiniChartMode => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return MODES.find(mode => mode === saved) ?? INITIAL_MODE;
    } catch {
        // 저장소를 못 쓰는 환경에서는 처음 값으로 둔다.
        return INITIAL_MODE;
    }
};

/** [지금 모양, 모양 바꾸기]. 바꾼 모양은 다른 목록 화면에도 이어진다. */
export const useMiniChartMode = (): [MiniChartMode, (mode: MiniChartMode) => void] => {
    const [mode, setMode] = useState<MiniChartMode>(loadMode);
    const change = useCallback((next: MiniChartMode) => {
        setMode(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // 저장하지 못해도 이번에 연 동안은 적용한다.
        }
    }, []);
    return [mode, change];
};
