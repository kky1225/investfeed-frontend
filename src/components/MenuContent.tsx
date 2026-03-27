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
import {fetchMyMenus} from "../api/menu/MenuApi";
import {getMenuIcon} from "./MenuIconMap";
import type {MenuRes} from "../type/MenuType";

interface MenuItemData {
    id: number;
    text: string;
    icon: React.ReactElement;
    url?: string;
    children?: MenuItemData[];
}

const toMenuItemData = (menu: MenuRes): MenuItemData => ({
    id: menu.id,
    text: menu.name,
    icon: getMenuIcon(menu.icon),
    url: menu.url || undefined,
    children: menu.children.length > 0 ? menu.children.map(toMenuItemData) : undefined,
});

interface MenuContentProps {
    collapsed?: boolean;
}

export default function MenuContent({collapsed = false}: MenuContentProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const {user} = useAuth();
    const [apiMenus, setApiMenus] = useState<MenuRes[]>([]);

    const loadMenus = useCallback(async () => {
        try {
            const res = await fetchMyMenus();
            if (res.result) setApiMenus(res.result);
        } catch {
            // 메뉴 로딩 실패 시 빈 메뉴
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

    const menuItems = useMemo(() => apiMenus.map(toMenuItemData), [apiMenus]);

    const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());
    const [popoverMenu, setPopoverMenu] = useState<string | null>(null);
    const anchorRefs = useRef<Record<string, HTMLElement | null>>({});
    const popoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (collapsed) setOpenMenus(new Set());
    }, [collapsed]);

    const handleMainMenuClick = (item: MenuItemData) => {
        if (item.children) {
            setOpenMenus(prev => {
                const next = new Set(prev);
                next.has(item.text) ? next.delete(item.text) : next.add(item.text);
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

    // 재귀 메뉴 렌더링 (펼침 모드)
    const renderMenuItem = (item: MenuItemData, depth: number) => (
        <Fragment key={item.id}>
            <ListItem disablePadding sx={{display: 'block'}}>
                <ListItemButton
                    selected={location.pathname === item.url}
                    onClick={() => handleMainMenuClick(item)}
                    sx={{pl: 2 + depth * 2}}
                >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                    {item.children ? (openMenus.has(item.text) ? <ExpandLess /> : <ExpandMore />) : null}
                </ListItemButton>
            </ListItem>
            {item.children && (
                <Collapse in={openMenus.has(item.text)} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        {item.children.map(child => renderMenuItem(child, depth + 1))}
                    </List>
                </Collapse>
            )}
        </Fragment>
    );

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

        if (!item.children) {
            return (
                <ListItem disablePadding>
                    <ListItemButton
                        selected={location.pathname === item.url}
                        onClick={() => item.url && handleChildClick(item.url)}
                    >
                        <ListItemIcon sx={{minWidth: 32}}>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.text} />
                    </ListItemButton>
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
                                    ) : (
                                        <Tooltip title={item.text} placement="right" arrow>
                                            <ListItemButton
                                                selected={location.pathname === item.url}
                                                onClick={() => handleMainMenuClick(item)}
                                                sx={{justifyContent: 'center', px: 1.5}}
                                            >
                                                <ListItemIcon sx={{minWidth: 0, justifyContent: 'center'}}>
                                                    {item.icon}
                                                </ListItemIcon>
                                            </ListItemButton>
                                        </Tooltip>
                                    )}
                                </ListItem>
                                {item.children && (
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
