import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Typography from '@mui/material/Typography';
import {useLocation, useNavigate} from "react-router-dom";
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Collapse} from "@mui/material";
import {ExpandLess, ExpandMore} from "@mui/icons-material";
import {useAuth} from "../context/AuthContext";
import {useApiKeyStatus} from "../context/ApiKeyStatusContext";
import {fetchMyMenus} from "../api/menu/MenuApi";
import {getMenuIcon} from "./MenuIconMap";
import type {MenuRes} from "../type/MenuType";

interface MenuItemData {
    id: number;
    text: string;
    icon: React.ReactElement;
    url?: string;
    children?: MenuItemData[];
    /** API Key 의존성 미충족으로 비활성화 상태 */
    disabled: boolean;
    /** disabled 사유 (툴팁 메시지). disabled=true 일 때만 의미 있음 */
    disabledReason?: string;
}

interface MenuConversionContext {
    isSatisfied: (ids: number[]) => boolean;
    getBrokerNames: (ids: number[]) => string[];
}

const buildDisabledReason = (brokerNames: string[]): string =>
    brokerNames.length > 0
        ? `${brokerNames.join(', ')} API Key 등록이 필요합니다`
        : 'API Key 등록이 필요합니다';

const toMenuItemData = (menu: MenuRes, ctx: MenuConversionContext): MenuItemData => {
    const children = menu.children.length > 0
        ? menu.children.map((c) => toMenuItemData(c, ctx))
        : undefined;

    // 자기 자신의 broker 의존성 미충족
    const selfMissing = !ctx.isSatisfied(menu.requiredBrokerIds);
    // 자식이 있을 때 자식이 모두 disabled 면 부모도 disabled
    const allChildrenDisabled = !!children && children.length > 0 && children.every((c) => c.disabled);
    const disabled = selfMissing || allChildrenDisabled;

    // disabled 사유: 자기 자신의 미충족 broker 우선, 없으면 자식들의 의존 broker 합집합
    const missingIds = selfMissing
        ? menu.requiredBrokerIds
        : (allChildrenDisabled
            ? Array.from(new Set(menu.children.flatMap((c) => c.requiredBrokerIds)))
            : []);

    return {
        id: menu.id,
        text: menu.name,
        icon: getMenuIcon(menu.icon),
        url: menu.url || undefined,
        children,
        disabled,
        disabledReason: disabled ? buildDisabledReason(ctx.getBrokerNames(missingIds)) : undefined,
    };
};

interface MenuContentProps {
    collapsed?: boolean;
}

export default function MenuContent({collapsed = false}: MenuContentProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const {user} = useAuth();
    const {isSatisfied, getBrokerNames} = useApiKeyStatus();
    const [apiMenus, setApiMenus] = useState<MenuRes[]>([]);

    const loadMenus = useCallback(async () => {
        try {
            const res = await fetchMyMenus();
            if (res.result) setApiMenus(res.result);
        } catch (error) {
            console.error(error);
        }
    }, []);

    useEffect(() => {
        if (user) loadMenus();
    }, [user, loadMenus]);

    // 메뉴 변경 이벤트 수신 시 재조회
    useEffect(() => {
        const handler = () => { loadMenus(); };
        window.addEventListener('menu-updated', handler);
        return () => window.removeEventListener('menu-updated', handler);
    }, [loadMenus]);

    const menuItems = useMemo(
        () => apiMenus.map((m) => toMenuItemData(m, {isSatisfied, getBrokerNames})),
        [apiMenus, isSatisfied, getBrokerNames]
    );

    const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());
    const [popoverMenu, setPopoverMenu] = useState<string | null>(null);
    const anchorRefs = useRef<Record<string, HTMLElement | null>>({});
    const popoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (collapsed) setOpenMenus(new Set());
    }, [collapsed]);

    const handleMainMenuClick = (item: MenuItemData) => {
        if (item.disabled) {
            navigate('/settings/api-keys');
            return;
        }
        if (item.children) {
            setOpenMenus(prev => {
                const next = new Set(prev);
                if (next.has(item.text)) {
                    next.delete(item.text);
                } else {
                    next.add(item.text);
                }
                return next;
            });
        } else {
            navigate(item.url!);
        }
    };

    const handlePopoverOpen = (text: string) => {
        if (popoverTimeout.current) {
            clearTimeout(popoverTimeout.current);
            popoverTimeout.current = null;
        }
        setPopoverMenu(text);
    };

    const handlePopoverClose = () => {
        popoverTimeout.current = setTimeout(() => {
            setPopoverMenu(null);
        }, 150);
    };

    const handlePopoverPaperEnter = () => {
        if (popoverTimeout.current) {
            clearTimeout(popoverTimeout.current);
            popoverTimeout.current = null;
        }
    };

    const handleChildClick = (url: string) => {
        navigate(url);
        setPopoverMenu(null);
    };

    const handleDisabledChildClick = () => {
        navigate('/settings/api-keys');
        setPopoverMenu(null);
    };

    // 재귀 메뉴 렌더링 (펼침 모드)
    const renderMenuItem = (item: MenuItemData, depth: number) => {
        const button = (
            <ListItemButton
                selected={location.pathname === item.url}
                onClick={() => handleMainMenuClick(item)}
                sx={{
                    pl: 2 + depth * 2,
                    ...(item.disabled && {
                        opacity: 0.5,
                        '& .MuiListItemText-primary': {color: 'text.disabled'},
                        '& .MuiListItemIcon-root': {color: 'text.disabled'},
                    }),
                }}
            >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
                {item.children ? (openMenus.has(item.text) ? <ExpandLess /> : <ExpandMore />) : null}
            </ListItemButton>
        );

        return (
            <Fragment key={item.id}>
                <ListItem disablePadding sx={{display: 'block'}}>
                    {item.disabled
                        ? <Tooltip title={item.disabledReason ?? ''} placement="right" arrow>{button}</Tooltip>
                        : button}
                </ListItem>
                {item.children && !item.disabled && (
                    <Collapse in={openMenus.has(item.text)} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                            {item.children.map(child => renderMenuItem(child, depth + 1))}
                        </List>
                    </Collapse>
                )}
            </Fragment>
        );
    };

    // 중첩 팝오버 아이템 (접힘 모드)
    const NestedPopoverItem = ({item}: {item: MenuItemData}) => {
        const ref = useRef<HTMLElement | null>(null);
        const [open, setOpen] = useState(false);
        const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

        const handleEnter = () => {
            if (timeout.current) { clearTimeout(timeout.current); timeout.current = null; }
            setOpen(true);
        };
        const handleLeave = () => {
            timeout.current = setTimeout(() => setOpen(false), 150);
        };

        const disabledStyle = item.disabled ? {
            opacity: 0.5,
            '& .MuiListItemText-primary': {color: 'text.disabled'},
            '& .MuiListItemIcon-root': {color: 'text.disabled'},
        } : {};

        if (!item.children) {
            const button = (
                <ListItemButton
                    selected={location.pathname === item.url}
                    onClick={() => {
                        if (item.disabled) handleDisabledChildClick();
                        else if (item.url) handleChildClick(item.url);
                    }}
                    sx={disabledStyle}
                >
                    <ListItemIcon sx={{minWidth: 32}}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                </ListItemButton>
            );
            return (
                <ListItem disablePadding>
                    {item.disabled
                        ? <Tooltip title={item.disabledReason ?? ''} placement="right" arrow>{button}</Tooltip>
                        : button}
                </ListItem>
            );
        }

        // 자식이 있는 항목: disabled 면 sub-popper 도 열지 않고 클릭 시 등록 페이지 이동
        if (item.disabled) {
            return (
                <ListItem disablePadding>
                    <Tooltip title={item.disabledReason ?? ''} placement="right" arrow>
                        <ListItemButton onClick={handleDisabledChildClick} sx={disabledStyle}>
                            <ListItemIcon sx={{minWidth: 32}}>{item.icon}</ListItemIcon>
                            <ListItemText primary={item.text} />
                            <ExpandMore fontSize="small" sx={{color: 'text.secondary'}} />
                        </ListItemButton>
                    </Tooltip>
                </ListItem>
            );
        }

        return (
            <ListItem
                disablePadding
                ref={ref as any}
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
            >
                <ListItemButton>
                    <ListItemIcon sx={{minWidth: 32}}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                    <ExpandMore fontSize="small" sx={{color: 'text.secondary'}} />
                </ListItemButton>
                <Popper
                    open={open}
                    anchorEl={ref.current}
                    placement="right-start"
                    sx={{zIndex: 1301}}
                >
                    <Paper
                        elevation={8}
                        sx={{py: 0.5, minWidth: 160}}
                        onMouseEnter={handleEnter}
                        onMouseLeave={handleLeave}
                    >
                        <List dense>
                            {item.children.map(child => (
                                <NestedPopoverItem key={child.id} item={child} />
                            ))}
                        </List>
                    </Paper>
                </Popper>
            </ListItem>
        );
    };

    return (
        <Stack sx={{flexGrow: 1, p: 1, justifyContent: 'space-between'}}>
            <List dense>
                {menuItems.map((item) => (
                    <Fragment key={item.id}>
                        {/* 접힘 모드: 아이콘만 표시 */}
                        {collapsed ? (
                            <>
                                <ListItem disablePadding sx={{display: 'block'}}>
                                    {item.children ? (
                                        item.disabled ? (
                                            <Tooltip title={item.disabledReason ?? ''} placement="right" arrow>
                                                <ListItemButton
                                                    onClick={() => navigate('/settings/api-keys')}
                                                    sx={{
                                                        justifyContent: 'center', px: 1.5,
                                                        opacity: 0.5,
                                                        '& .MuiListItemIcon-root': {color: 'text.disabled'},
                                                    }}
                                                >
                                                    <ListItemIcon sx={{minWidth: 0, justifyContent: 'center'}}>
                                                        {item.icon}
                                                    </ListItemIcon>
                                                </ListItemButton>
                                            </Tooltip>
                                        ) : (
                                            <ListItemButton
                                                ref={(el) => { anchorRefs.current[item.text] = el; }}
                                                onMouseEnter={() => handlePopoverOpen(item.text)}
                                                onMouseLeave={handlePopoverClose}
                                                sx={{justifyContent: 'center', px: 1.5}}
                                            >
                                                <ListItemIcon sx={{minWidth: 0, justifyContent: 'center'}}>
                                                    {item.icon}
                                                </ListItemIcon>
                                            </ListItemButton>
                                        )
                                    ) : (
                                        <Tooltip
                                            title={item.disabled ? (item.disabledReason ?? '') : item.text}
                                            placement="right"
                                            arrow
                                        >
                                            <ListItemButton
                                                selected={location.pathname === item.url}
                                                onClick={() => handleMainMenuClick(item)}
                                                sx={{
                                                    justifyContent: 'center', px: 1.5,
                                                    ...(item.disabled && {
                                                        opacity: 0.5,
                                                        '& .MuiListItemIcon-root': {color: 'text.disabled'},
                                                    }),
                                                }}
                                            >
                                                <ListItemIcon sx={{minWidth: 0, justifyContent: 'center'}}>
                                                    {item.icon}
                                                </ListItemIcon>
                                            </ListItemButton>
                                        </Tooltip>
                                    )}
                                </ListItem>
                                {item.children && !item.disabled && (
                                    <Popper
                                        open={popoverMenu === item.text}
                                        anchorEl={anchorRefs.current[item.text]}
                                        placement="right-start"
                                        sx={{zIndex: 1300}}
                                    >
                                        <ClickAwayListener onClickAway={() => setPopoverMenu(null)}>
                                            <Paper
                                                elevation={8}
                                                sx={{py: 0.5, minWidth: 160}}
                                                onMouseEnter={handlePopoverPaperEnter}
                                                onMouseLeave={handlePopoverClose}
                                            >
                                                <Typography variant="caption" sx={{px: 2, py: 0.5, color: 'text.secondary', fontWeight: 600}}>
                                                    {item.text}
                                                </Typography>
                                                <List dense>
                                                    {item.children.map(child => (
                                                        <NestedPopoverItem key={child.id} item={child} />
                                                    ))}
                                                </List>
                                            </Paper>
                                        </ClickAwayListener>
                                    </Popper>
                                )}
                            </>
                        ) : (
                            /* 펼침 모드: 재귀 렌더링 */
                            renderMenuItem(item, 0)
                        )}
                    </Fragment>
                ))}
            </List>
        </Stack>
    );
}
