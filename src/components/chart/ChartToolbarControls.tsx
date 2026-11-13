import IconButton from "@mui/material/IconButton";
import {styled, Theme} from "@mui/material/styles";
import {svgIconClasses} from "@mui/material/SvgIcon";
import {toggleButtonClasses} from "@mui/material/ToggleButton";
import ToggleButtonGroup, {toggleButtonGroupClasses} from "@mui/material/ToggleButtonGroup";

const BUTTON_SIZE = 32;
const ICON_SIZE = 20;

// 차트 위쪽 줄의 모든 버튼이 함께 쓰는 평평한 모양: 테두리·그림자 없이, 올렸을 때와 골랐을 때만 옅은 배경
const flatButton = (theme: Theme) => ({
    height: BUTTON_SIZE,
    minWidth: BUTTON_SIZE,
    margin: 0,
    border: 0,
    borderRadius: theme.shape.borderRadius,
    boxShadow: 'none',
    backgroundColor: 'transparent',
    color: (theme.vars || theme).palette.text.secondary,
    [`& .${svgIconClasses.root}`]: {fontSize: ICON_SIZE},
    '&:hover': {
        backgroundColor: (theme.vars || theme).palette.action.hover,
    },
});

const groupStyle = (theme: Theme) => ({
    border: 'none',
    boxShadow: 'none',
    gap: 2,
    [`& .${toggleButtonGroupClasses.grouped}`]: {
        ...flatButton(theme),
        padding: '0 8px',
        [`&.${toggleButtonClasses.selected}`]: {
            color: (theme.vars || theme).palette.primary.main,
            backgroundColor: (theme.vars || theme).palette.action.selected,
        },
    },
});

/**
 * 차트 위쪽 줄의 버튼 묶음 (주기, 차트 종류, 그리기 도구).
 * 테마가 다크 모드에 따로 입히는 그림자와 색은 일반 규칙으로 지워지지 않아, 같은 모양을 다크 모드 규칙으로 한 번 더 적용한다.
 */
export const ChartToolbarGroup = styled(ToggleButtonGroup)(({theme}) => ({
    ...groupStyle(theme),
    ...theme.applyStyles('dark', groupStyle(theme)),
}));

/** 차트 위쪽 줄의 낱개 아이콘 버튼 (최근으로 이동, 차트 설정). 버튼 묶음과 같은 크기·모양이다. */
export const ChartToolbarButton = styled(IconButton)(({theme}) => {
    const style = {...flatButton(theme), width: BUTTON_SIZE, padding: 0};
    return {...style, ...theme.applyStyles('dark', style)};
});
