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
import DashboardIcon from '@mui/icons-material/Dashboard';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import AnalyticsRoundedIcon from '@mui/icons-material/AnalyticsRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import FavoriteIcon from '@mui/icons-material/Favorite';
import DiamondIcon from '@mui/icons-material/Diamond';
import GroupIcon from '@mui/icons-material/Group';
import RecommendIcon from '@mui/icons-material/Recommend';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import NotificationsIcon from '@mui/icons-material/Notifications';
import {useLocation, useNavigate} from "react-router-dom";
import {Fragment, useEffect, useRef, useState} from "react";
import { Collapse } from "@mui/material";
import {ExpandLess, ExpandMore} from "@mui/icons-material";

const mainListItems = [
    { id: 1, text: '대시보드', icon: <DashboardIcon />, url: '/' },
    { id: 2, text: '주요 지수', icon: <AnalyticsRoundedIcon />, url: '/market-index/list' },
    { id: 3, text: '국내 주식', icon: <ShowChartIcon />,
        children: [
            { id: 4, text: '지수', icon: <AnalyticsRoundedIcon />, url: '/index/list' },
            { id: 5, text: '업종', icon: <HomeRoundedIcon />, url: '/sect/list/001' },
            { id: 6, text: '테마', icon: <GroupIcon />, url: '/theme/list' },
            { id: 7, text: '순위', icon: <ShowChartIcon />, url: '/stock/list/0' },
            { id: 8, text: '투자자별', icon: <GroupIcon />, url: '/investor/6/list/1' },
            { id: 9, text: '추천', icon: <RecommendIcon />, url: '/recommend/list' },
            { id: 10, text: '관심 종목', icon: <FavoriteIcon />, url: '/interest/list' },
            { id: 11, text: '보유 주식', icon: <PeopleRoundedIcon />, url: '/holding/list' },
        ]
    },
    { id: 12, text: '원자재', icon: <DiamondIcon />, url: '/commodity/list' },
    { id: 13, text: '암호화폐', icon: <CurrencyBitcoinIcon />,
        children: [
            { id: 14, text: '지수', icon: <AnalyticsRoundedIcon />, url: '/crypto/list' },
            { id: 15, text: '관심 종목', icon: <FavoriteIcon />, url: '/crypto-interest/list' },
        ]
    },
    { id: 16, text: '알림', icon: <NotificationsIcon />, url: '/notification/list' },
];

interface MenuContentProps {
    collapsed?: boolean;
}

export default function MenuContent({ collapsed = false }: MenuContentProps) {
    const location = useLocation();
    const navigate = useNavigate();

    const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);
    const [popoverMenu, setPopoverMenu] = useState<string | null>(null);
    const anchorRefs = useRef<Record<string, HTMLElement | null>>({});
    const popoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (collapsed) {
            setOpenSubMenu(null);
        }
    }, [collapsed]);

    const handleMainMenuClick = (item: any) => {
        if (item.children) {
            if (!collapsed) {
                setOpenSubMenu(openSubMenu === item.text ? null : item.text);
            }
        } else {
            navigate(item.url);
            setOpenSubMenu(null);
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

    return (
        <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
            <List dense>
                {mainListItems.map((item) => (
                    <Fragment key={item.id}>
                        <ListItem disablePadding sx={{ display: 'block' }}>
                            {collapsed && !item.children ? (
                                <Tooltip title={item.text} placement="right" arrow>
                                    <ListItemButton
                                        selected={location.pathname === item.url}
                                        onClick={() => handleMainMenuClick(item)}
                                        sx={{
                                            justifyContent: 'center',
                                            px: 1.5,
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center' }}>
                                            {item.icon}
                                        </ListItemIcon>
                                    </ListItemButton>
                                </Tooltip>
                            ) : collapsed && item.children ? (
                                <ListItemButton
                                    ref={(el) => { anchorRefs.current[item.text] = el; }}
                                    onMouseEnter={() => handlePopoverOpen(item.text)}
                                    onMouseLeave={handlePopoverClose}
                                    sx={{
                                        justifyContent: 'center',
                                        px: 1.5,
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center' }}>
                                        {item.icon}
                                    </ListItemIcon>
                                </ListItemButton>
                            ) : (
                                <ListItemButton
                                    selected={location.pathname === item.url}
                                    onClick={() => handleMainMenuClick(item)}
                                >
                                    <ListItemIcon>{item.icon}</ListItemIcon>
                                    <ListItemText primary={item.text} />
                                    {item.children ? (openSubMenu === item.text ? <ExpandLess /> : <ExpandMore />) : null}
                                </ListItemButton>
                            )}
                        </ListItem>

                        {/* 펼침: 기존 Collapse 서브메뉴 */}
                        {!collapsed && item.children && (
                            <Collapse in={openSubMenu === item.text} timeout="auto" unmountOnExit>
                                <List component="div" disablePadding>
                                    {item.children.map((child) => (
                                        <ListItem key={child.url} disablePadding>
                                            <ListItemButton selected={location.pathname === child.url} onClick={() => navigate(child.url)}>
                                                <ListItemIcon>{child.icon}</ListItemIcon>
                                                <ListItemText primary={child.text} />
                                            </ListItemButton>
                                        </ListItem>
                                    ))}
                                </List>
                            </Collapse>
                        )}

                        {/* 접힘: Hover 팝오버 서브메뉴 */}
                        {collapsed && item.children && (
                            <Popper
                                open={popoverMenu === item.text}
                                anchorEl={anchorRefs.current[item.text]}
                                placement="right-start"
                                sx={{ zIndex: 1300 }}
                            >
                                <ClickAwayListener onClickAway={() => setPopoverMenu(null)}>
                                    <Paper
                                        elevation={8}
                                        sx={{ py: 0.5, minWidth: 160 }}
                                        onMouseEnter={handlePopoverPaperEnter}
                                        onMouseLeave={handlePopoverClose}
                                    >
                                        <Typography variant="caption" sx={{ px: 2, py: 0.5, color: 'text.secondary', fontWeight: 600 }}>
                                            {item.text}
                                        </Typography>
                                        <List dense>
                                            {item.children.map((child) => (
                                                <ListItem key={child.url} disablePadding>
                                                    <ListItemButton
                                                        selected={location.pathname === child.url}
                                                        onClick={() => handleChildClick(child.url)}
                                                    >
                                                        <ListItemIcon sx={{ minWidth: 32 }}>{child.icon}</ListItemIcon>
                                                        <ListItemText primary={child.text} />
                                                    </ListItemButton>
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Paper>
                                </ClickAwayListener>
                            </Popper>
                        )}
                    </Fragment>
                ))}
            </List>
        </Stack>
    );
}
