import {useEffect, useState} from "react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import Divider from "@mui/material/Divider";
import type {SxProps, Theme} from "@mui/material/styles";
import MenuButton from "./MenuButton";
import {green, orange} from "./themePrimitives.ts";
import {
    expireSecondaryAuthIfDue, lockSecondaryAuth, requestSecondaryAuth, useSecondaryAuthExpiresAt, useSecondaryAuthKnown,
    useSecondaryAuthLockedContents, useSecondaryAuthSync, useSecondaryPasswordSuspendedState,
} from "../lib/secondaryAuth.ts";

const SECOND_MS = 1000;
const WARNING_SECONDS = 5 * 60;     // 남은 시간이 이 이하이면 자물쇠 옆에 시간을 적어 알린다

const MENU_ID = 'secondary-auth-menu';
// 상단 줄에서 뒤따르는 버튼 묶음과 나누는 선. 자물쇠를 그리지 않는 동안(상태를 모를 때)에는 선도 그리지 않도록 여기서 함께 그린다
const GROUP_DIVIDER = <Divider orientation="vertical" flexItem sx={{my: 1}}/>;

/**
 * 누를 수 있는 색 칩에 마우스를 올리거나 초점이 가면 MUI 가 바탕을 그 색의 가장 진한 값으로 바꿔 글자가 묻힌다.
 * 평소 바탕(테마의 칩: 밝은 모드 50, 어두운 모드 900)보다 한 단계만 진한 색을 직접 정한다.
 */
const chipSx = (shades: Record<number, string>): SxProps<Theme> => theme => ({
    fontVariantNumeric: 'tabular-nums',
    '&:hover, &.Mui-focusVisible': {
        backgroundColor: shades[100],
        ...theme.applyStyles('dark', {backgroundColor: shades[800]}),
    },
});
const SUCCESS_CHIP_SX = chipSx(green);
const WARNING_CHIP_SX = chipSx(orange);

const formatRemaining =(seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** 2차 인증이 풀리기까지 남은 초. 1초마다 다시 센다. 인증하지 않았으면 null */
const useRemainingSeconds = (expiresAt: number | null): number | null => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (expiresAt === null) return;
        setNow(Date.now());
        const timer = setInterval(() => {
            setNow(Date.now());
            // 탭이 잠들었다 깨어나 만료 타이머가 밀렸더라도, 시각이 지났으면 여기서 잠근다.
            expireSecondaryAuthIfDue();
        }, SECOND_MS);
        return () => clearInterval(timer);
    }, [expiresAt]);
    return expiresAt === null ? null : Math.max(0, Math.ceil((expiresAt - now) / SECOND_MS));
};

/**
 * 상단 줄의 2차 인증 자물쇠.
 * - 잠김: 누르면 지금 화면에서 2차 비밀번호 창이 뜬다. 이 화면에 인증이 없어 가려진 내용이 있으면 점을 찍어 알린다.
 * - 인증됨: 남은 시간을 적은 칩으로 바뀐다(5분 이하이면 경고색). 누르면 연장하거나 지금 잠글 수 있다.
 * 서버에 상태를 묻기 전(화면을 막 연 직후)에는 그리지 않는다. 잠긴 것으로 잘못 보이지 않게 하기 위해서다.
 */
export default function SecondaryAuthButton() {
    useSecondaryAuthSync();
    const known = useSecondaryAuthKnown();
    const expiresAt = useSecondaryAuthExpiresAt();
    const lockedContents = useSecondaryAuthLockedContents();
    const suspended = useSecondaryPasswordSuspendedState();
    const remaining = useRemainingSeconds(expiresAt);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    // 메뉴를 연 채로 잠기면 메뉴를 닫아 둔다. 닫지 않으면 다음에 인증됐을 때 사라진 버튼 자리에 메뉴가 다시 열린다.
    const unlocked = remaining !== null;
    useEffect(() => {
        if (!unlocked) setAnchorEl(null);
    }, [unlocked]);

    if (!known) return null;

    if (remaining === null) {
        const hidden = [...new Set(lockedContents)];
        const title = suspended
            ? '2차 비밀번호를 여러 번 틀려 정지되었습니다. 관리자에게 문의하세요.'
            : hidden.length > 0
                ? `이 화면의 ${hidden.join(', ')}가 잠겨 있습니다. 눌러서 2차 인증을 하세요.`
                : '2차 인증 전입니다. 눌러서 인증하세요.';
        return (
            <>
                <Tooltip title={title}>
                    <MenuButton showBadge={hidden.length > 0} aria-label="2차 인증" onClick={requestSecondaryAuth}>
                        <LockOutlinedIcon/>
                    </MenuButton>
                </Tooltip>
                {GROUP_DIVIDER}
            </>
        );
    }

    const closeMenu = () => setAnchorEl(null);
    const lockNow = () => {
        closeMenu();
        lockSecondaryAuth().catch(error => {
            console.error(error);
            // 2차 비밀번호 요청의 실패는 공통 오류 창이 뜨지 않으므로 여기서 알린다. 알리지 않으면 잠근 줄 알고 자리를 뜰 수 있다.
            window.dispatchEvent(new CustomEvent('show-global-error', {
                detail: {message: '2차 인증을 잠그지 못했습니다. 잠시 후 다시 시도해주세요.'},
            }));
        });
    };
    // 인증된 동안에는 남은 시간을 늘 보여 주는 칩으로 그린다. 5분 이하로 남으면 색을 바꿔 알린다.
    const warning = remaining <= WARNING_SECONDS;
    return (
        <>
            {/* 안내 문구는 이름(aria-label)을 덮지 않고 설명으로 붙인다. 이름은 초마다 바뀌지 않게 고정하고 시간은 보이는 글자에 맡긴다. */}
            <Tooltip title="2차 인증 남은 시간. 눌러서 연장하거나 잠글 수 있습니다." describeChild>
                <Chip
                    icon={<LockOpenOutlinedIcon/>}
                    label={formatRemaining(remaining)}
                    color={warning ? 'warning' : 'success'}
                    size="medium"
                    aria-label="2차 인증됨"
                    aria-haspopup="menu"
                    aria-expanded={anchorEl !== null ? 'true' : undefined}
                    aria-controls={anchorEl !== null ? MENU_ID : undefined}
                    onClick={event => setAnchorEl(event.currentTarget)}
                    sx={warning ? WARNING_CHIP_SX : SUCCESS_CHIP_SX}
                />
            </Tooltip>
            <Menu id={MENU_ID} anchorEl={anchorEl} open={anchorEl !== null} onClose={closeMenu}>
                <MenuItem
                    onClick={() => {
                        closeMenu();
                        requestSecondaryAuth();
                    }}
                >
                    연장 (2차 비밀번호 다시 입력)
                </MenuItem>
                <MenuItem onClick={lockNow}>지금 잠그기</MenuItem>
            </Menu>
            {GROUP_DIVIDER}
        </>
    );
}
