import {type PointerEvent, useRef, useState} from 'react';
import Box from '@mui/material/Box';
import Drawer, {drawerClasses} from '@mui/material/Drawer';
import {useAssistant} from '../../context/AssistantContext';
import AssistantPanel from './AssistantPanel';

export const ASSISTANT_DRAWER_WIDTH = 640;   // 기본 너비. 2026-09-16 사용자 요청으로 480 → 640 (채팅 가독성)
const MIN_WIDTH = 420;
const MAX_WIDTH_RATIO = 0.92;   // 아래 maxWidth: '92vw' 와 같은 값
const WIDTH_KEY = 'assistantDrawerWidth';

const clampWidth = (w: number) => Math.round(Math.min(Math.max(w, MIN_WIDTH), Math.max(MIN_WIDTH, window.innerWidth * MAX_WIDTH_RATIO)));

const loadWidth = () => {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(saved) && saved > 0 ? clampWidth(saved) : ASSISTANT_DRAWER_WIDTH;
};

/** 데스크톱 우측 드로어. 모바일은 /assistant 전체 화면 (AssistantPage) */
export default function AssistantDrawer() {
    const {drawerOpen, closeDrawer} = useAssistant();
    // 왼쪽 가장자리를 끌어 너비 조절 (2026-10-13). 조절한 값은 브라우저에 기억하고, 더블클릭하면 기본 너비로 되돌린다
    const [width, setWidth] = useState(loadWidth);
    const draggingRef = useRef(false);

    const widthAt = (e: PointerEvent) => clampWidth(window.innerWidth - e.clientX);

    const startResize = (e: PointerEvent<HTMLDivElement>) => {
        e.preventDefault();   // 끄는 동안 본문 글자가 선택되지 않게
        e.currentTarget.setPointerCapture(e.pointerId);
        draggingRef.current = true;
    };
    const resize = (e: PointerEvent<HTMLDivElement>) => {
        if (draggingRef.current) setWidth(widthAt(e));
    };
    const endResize = (e: PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
        localStorage.setItem(WIDTH_KEY, String(width));
    };
    const resetWidth = () => {
        setWidth(ASSISTANT_DRAWER_WIDTH);
        localStorage.removeItem(WIDTH_KEY);
    };

    return (
        <Drawer
            anchor="right"
            open={drawerOpen}
            onClose={closeDrawer}
            sx={{
                zIndex: (theme) => theme.zIndex.drawer + 1,
                [`& .${drawerClasses.paper}`]: {
                    width,
                    maxWidth: '92vw',
                    backgroundImage: 'none',
                    backgroundColor: 'background.default',   // 비서만 흰 바탕. 테마 paper 는 사이드 메뉴 등이 공유하므로 건드리지 않는다
                },
            }}
        >
            <Box
                role="separator"
                aria-orientation="vertical"
                aria-label="비서 창 너비 조절"
                onPointerDown={startResize}
                onPointerMove={resize}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                onDoubleClick={resetWidth}
                sx={{
                    position: 'absolute', top: 0, bottom: 0, left: 0, width: 6, zIndex: 1,
                    cursor: 'col-resize', touchAction: 'none',
                    transition: 'background-color 0.15s',
                    '&:hover, &:active': {bgcolor: 'primary.main', opacity: 0.35},
                }}
            />
            <AssistantPanel variant="drawer" onClose={closeDrawer}/>
        </Drawer>
    );
}
