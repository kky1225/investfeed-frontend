import Drawer, {drawerClasses} from '@mui/material/Drawer';
import {useAssistant} from '../../context/AssistantContext';
import AssistantPanel from './AssistantPanel';

export const ASSISTANT_DRAWER_WIDTH = 640;   // 2026-09-16 사용자 요청으로 480 → 640 (채팅 가독성)

/** 데스크톱 우측 드로어. 모바일은 /assistant 전체 화면 (AssistantPage) */
export default function AssistantDrawer() {
    const {drawerOpen, closeDrawer} = useAssistant();
    return (
        <Drawer
            anchor="right"
            open={drawerOpen}
            onClose={closeDrawer}
            sx={{
                zIndex: (theme) => theme.zIndex.drawer + 1,
                [`& .${drawerClasses.paper}`]: {
                    width: ASSISTANT_DRAWER_WIDTH,
                    maxWidth: '92vw',
                    backgroundImage: 'none',
                    backgroundColor: 'background.default',   // 비서만 흰 바탕. 테마 paper 는 사이드 메뉴 등이 공유하므로 건드리지 않는다
                },
            }}
        >
            <AssistantPanel variant="drawer" onClose={closeDrawer}/>
        </Drawer>
    );
}
