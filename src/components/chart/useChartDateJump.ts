import {RefObject, useEffect, useRef, useState} from "react";
import type {CandleChartEngine} from "../../lib/chart/CandleChart.ts";
import {formatTime} from "../../lib/chart/scale.ts";
import type {Candle} from "../../lib/chart/types.ts";
import {useAlert} from "../../context/AlertContext.tsx";

// 날짜로 이동할 때 과거 구간을 이어 받는 최대 횟수. 분봉으로 먼 날짜를 고르면 요청이 끝없이 늘어나므로 막는다
const MAX_JUMP_PAGES = 20;

/** 진행 중인 날짜 이동 */
interface Jump {
    id: number,
    key: string | undefined,    // 시작할 때의 seriesKey. 종목·주기가 바뀌면 그만둔다
    target: number,             // 옮겨 갈 시각 (epoch ms). 기간이면 시작 시각이고, 이 시각까지 과거 구간을 받아 둔다
    end: number | null,         // 기간으로 옮기면 그 끝 시각. 날짜 하나로 옮기면 null
    pages: number,              // 지금까지 이어 받은 횟수
    waiting: boolean,           // 과거 구간을 받는 중
}

/**
 * 차트를 정한 시각(CandleChartEngine.scrollToTime)이나 기간(fitTimeRange)으로 옮긴다. 그 시각(기간이면 시작)이 받아 둔 캔들보다 과거면 닿을 때까지
 * 과거 구간을 이어 받은 뒤 옮긴다. 이어 받기는 MAX_JUMP_PAGES 번까지만 하고, 넘으면 받은 곳의 처음으로 옮기며 알린다.
 * 받는 중에 종목·주기가 바뀌면 그만둔다. jumping 은 과거 구간을 받는 중인지다(로딩 표시용).
 */
export const useChartDateJump = (
    engineRef: RefObject<CandleChartEngine | null>,
    candles: Candle[],
    seriesKey: string | undefined,
    hasOlder: boolean,
    loadOlder: (() => Promise<boolean>) | undefined,
) => {
    const showAlert = useAlert();
    const [jump, setJump] = useState<Jump | null>(null);
    const nextId = useRef(0);
    const active = jump?.key === seriesKey ? jump : null;

    useEffect(() => {
        if (!active || active.waiting) return;
        const first = candles[0];
        const range = active.end !== null;
        // 받아 둔 첫 캔들까지만 갈 수 있을 때: 날짜면 첫 캔들로, 기간이면 첫 캔들부터 맞춘다
        const fromFirst = range ? '첫 캔들부터 맞췄습니다' : '첫 캔들로 옮겼습니다';
        const finish = (message?: string) => {
            setJump(null);
            const engine = engineRef.current;
            if (!engine) return;
            const notes = [message];
            if (active.end === null) {
                engine.scrollToTime(active.target);
            } else {
                const {fits, empty} = engine.fitTimeRange(active.target, active.end);
                if (empty) notes.push('고른 기간에는 캔들이 없어 가장 가까운 앞 캔들을 보여 드립니다.');
                else if (!fits) notes.push('기간이 길어 화면에 다 들어가지 않아 가운데 부분을 보여 드립니다.');
            }
            const text = notes.filter(Boolean).join(' ');
            if (text) showAlert(text, 'info');
        };
        if (!first) {
            setJump(null);
            showAlert('표시할 차트가 없어 이동하지 않았습니다.', 'info');
        } else if (first.time <= active.target) {
            finish();
        } else if (!loadOlder) {
            finish(`이 차트는 지난 구간을 더 불러올 수 없어 ${fromFirst}.`);
        } else if (!hasOlder) {
            finish(`${formatTime(first.time, 'day')}부터 차트가 있어 ${fromFirst}.`);
        } else if (active.pages >= MAX_JUMP_PAGES) {
            finish(`이 주기로는 ${formatTime(first.time, 'day')}까지만 불러올 수 있어 ${fromFirst}. 더 긴 주기로 바꿔 보세요.`);
        } else {
            setJump({...active, waiting: true});
            loadOlder().then(received => {
                // 그사이 다른 날짜로 다시 옮기기 시작했거나 그만두었으면 건드리지 않는다.
                if (!received && nextId.current === active.id) {
                    showAlert('과거 차트를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 'warning');
                }
                setJump(current => current?.id !== active.id ? current
                    : received ? {...current, pages: current.pages + 1, waiting: false}
                    : null);
            });
        }
    }, [active, candles, hasOlder, loadOlder, engineRef, showAlert]);

    // 종목·주기가 바뀌어 그만둔 이동은 지운다. 번호도 넘겨, 받는 중이던 요청이 끝나도 알림을 띄우지 않게 한다.
    useEffect(() => {
        if (!jump || active) return;
        nextId.current += 1;
        setJump(null);
    }, [jump, active]);

    /** 시각 target 을 담은 캔들로 옮긴다. end 를 주면 target 부터 end 까지의 기간을 화면에 맞춘다 */
    const jumpTo = (target: number, end: number | null = null) => {
        nextId.current += 1;
        setJump({id: nextId.current, key: seriesKey, target, end, pages: 0, waiting: false});
    };

    return {jumpTo, jumping: active !== null};
};
