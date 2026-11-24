import {ReactNode} from "react";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import ReorderIcon from "@mui/icons-material/Reorder";
import StraightenIcon from "@mui/icons-material/Straighten";
import TitleIcon from "@mui/icons-material/Title";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import {DrawingTool} from "../../lib/chart/types.ts";

// 도형의 이름과 아이콘. 그리기 도구 모음과 그린 선 목록이 함께 쓴다.

export const DRAWING_LABELS: Record<DrawingTool, string> = {
    trend: '추세선',
    ray: '반직선',
    horizontal: '수평선',
    vertical: '수직선',
    rectangle: '사각형',
    channel: '평행 채널',
    fibonacci: '피보나치 되돌림',
    measure: '가격 범위 측정',
    text: '글자',
};

export const DRAWING_ICONS: Record<DrawingTool, ReactNode> = {
    trend: <ShowChartIcon/>,
    ray: <NorthEastIcon/>,
    horizontal: <HorizontalRuleIcon/>,
    vertical: <HorizontalRuleIcon sx={{transform: 'rotate(90deg)'}}/>,
    rectangle: <CropSquareIcon/>,
    channel: <DragHandleIcon sx={{transform: 'rotate(-30deg)'}}/>,
    fibonacci: <ReorderIcon/>,
    measure: <StraightenIcon/>,
    text: <TitleIcon/>,
};
