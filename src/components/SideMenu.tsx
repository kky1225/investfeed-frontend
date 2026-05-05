import { styled } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuContent from './MenuContent';
import CardAlert from './CardAlert';
import { MouseEvent, useState, lazy, Suspense } from "react";
import MuiMenuItem from "@mui/material/MenuItem";
import MenuButton from "./MenuButton.tsx";
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import LockResetIcon from '@mui/icons-material/LockReset';
import PinIcon from '@mui/icons-material/Pin';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItemIcon, { listItemIconClasses } from "@mui/material/ListItemIcon";
import Divider, { dividerClasses } from "@mui/material/Divider";
import { ListItemText } from '@mui/material';
import { listClasses } from "@mui/material/List";
import { paperClasses } from "@mui/material/Paper";
import {useAlert} from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';
import { logout } from '../api/auth/AuthApi';
import { useNavigate } from 'react-router-dom';
import IconButton from '@mui/material/IconButton';

const ChangeSecondaryPasswordDialog = lazy(() => import('./ChangeSecondaryPasswordDialog'));

const drawerWidthOpen = 240;
const drawerWidthClosed = 64;

const Drawer = styled(MuiDrawer, {
    shouldForwardProp: (prop) => prop !== 'collapsed',
})<{ collapsed?: boolean }>(({ collapsed }) => ({
    width: collapsed ? drawerWidthClosed : drawerWidthOpen,
    flexShrink: 0,
    boxSizing: 'border-box',
    transition: 'width 0.2s ease-in-out',
    [`& .${drawerClasses.paper}`]: {
        width: collapsed ? drawerWidthClosed : drawerWidthOpen,
        boxSizing: 'border-box',
        overflowX: 'hidden',
        transition: 'width 0.2s ease-in-out',
    },
}));

const MenuItem = styled(MuiMenuItem)({
    margin: '2px 0',
});

export default function SideMenu() {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [changeSecondaryOpen, setChangeSecondaryOpen] = useState(false);
    const showAlert = useAlert();
    const open = Boolean(anchorEl);
    const { user, clearAuth } = useAuth();
    const navigate = useNavigate();

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        handleClose();
        try {
            await logout();
        } catch (error) {
            console.error(error);
            // 서버 오류여도 로컬 상태는 초기화
        } finally {
            clearAuth();
            navigate('/login');
        }
    };

    const displayName = user?.nickname ?? user?.loginId ?? '';
    const displayEmail = user?.email ?? '';
    const initials = displayName.charAt(0).toUpperCase();

    return (
        <Drawer
            variant="permanent"
            collapsed={collapsed}
            sx={{
                display: { xs: 'none', md: 'block' },
                [`& .${drawerClasses.paper}`]: {
                    backgroundColor: 'background.paper',
                },
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: collapsed ? 'center' : 'flex-end',
                    p: 1,
                }}
            >
                <IconButton onClick={() => setCollapsed(!collapsed)} size="small">
                    {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                </IconButton>
            </Box>
            <Box
                sx={{
                    overflow: 'auto',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <MenuContent collapsed={collapsed} />
                {!collapsed && <CardAlert />}
            </Box>
            <Stack
                direction="row"
                sx={{
                    p: collapsed ? 1 : 2,
                    gap: 1,
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                }}
            >
                {collapsed ? (
                    <IconButton onClick={handleClick} sx={{ p: 0 }}>
                        <Avatar sizes="small" sx={{ width: 36, height: 36, cursor: 'pointer' }}>
                            {initials}
                        </Avatar>
                    </IconButton>
                ) : (
                    <>
                        <Avatar sizes="small" sx={{ width: 36, height: 36 }}>
                            {initials}
                        </Avatar>
                        <Box sx={{ mr: 'auto' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: '16px' }}>
                                {displayName}
                            </Typography>
                            {displayEmail && (
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {displayEmail}
                                </Typography>
                            )}
                        </Box>
                        <MenuButton
                            aria-label="Open menu"
                            onClick={handleClick}
                            sx={{ borderColor: 'transparent' }}
                        >
                            <MoreVertRoundedIcon />
                        </MenuButton>
                    </>
                )}
                <Menu
                    anchorEl={anchorEl}
                    id="menu"
                    open={open}
                    onClose={handleClose}
                    onClick={handleClose}
                    transformOrigin={collapsed
                        ? { horizontal: 'left', vertical: 'bottom' }
                        : { horizontal: 'right', vertical: 'top' }
                    }
                    anchorOrigin={collapsed
                        ? { horizontal: 'right', vertical: 'center' }
                        : { horizontal: 'right', vertical: 'bottom' }
                    }
                    sx={{
                        [`& .${listClasses.root}`]: {
                            padding: '4px',
                        },
                        [`& .${paperClasses.root}`]: {
                            padding: 0,
                        },
                        [`& .${dividerClasses.root}`]: {
                            margin: '4px -4px',
                        },
                    }}
                >
                    {collapsed && (
                        <Box sx={{ px: 2, py: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {displayName}
                            </Typography>
                            {displayEmail && (
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {displayEmail}
                                </Typography>
                            )}
                        </Box>
                    )}
                    <Divider />
                    <MenuItem
                        onClick={() => { handleClose(); navigate('/settings/profile'); }}
                        sx={{
                            [`& .${listItemIconClasses.root}`]: {
                                ml: 'auto',
                                minWidth: 0,
                                pl: 1,
                            },
                        }}
                    >
                        <ListItemText>회원정보 수정</ListItemText>
                        <ListItemIcon>
                            <AccountCircleIcon fontSize="small" />
                        </ListItemIcon>
                    </MenuItem>
                    <MenuItem
                        onClick={() => { handleClose(); navigate('/settings/change-password'); }}
                        sx={{
                            [`& .${listItemIconClasses.root}`]: {
                                ml: 'auto',
                                minWidth: 0,
                                pl: 1,
                            },
                        }}
                    >
                        <ListItemText>비밀번호 변경</ListItemText>
                        <ListItemIcon>
                            <LockResetIcon fontSize="small" />
                        </ListItemIcon>
                    </MenuItem>
                    {user?.secondaryPasswordEnabled && (
                        <MenuItem
                            onClick={() => { handleClose(); setChangeSecondaryOpen(true); }}
                            sx={{
                                [`& .${listItemIconClasses.root}`]: {
                                    ml: 'auto',
                                    minWidth: 0,
                                    pl: 1,
                                },
                            }}
                        >
                            <ListItemText>2차 비밀번호 변경</ListItemText>
                            <ListItemIcon>
                                <PinIcon fontSize="small" />
                            </ListItemIcon>
                        </MenuItem>
                    )}
                    <MenuItem
                        onClick={() => { handleClose(); navigate('/settings/api-keys'); }}
                        sx={{
                            [`& .${listItemIconClasses.root}`]: {
                                ml: 'auto',
                                minWidth: 0,
                                pl: 1,
                            },
                        }}
                    >
                        <ListItemText>API Key 관리</ListItemText>
                        <ListItemIcon>
                            <VpnKeyIcon fontSize="small" />
                        </ListItemIcon>
                    </MenuItem>
                    <MenuItem
                        onClick={handleLogout}
                        sx={{
                            [`& .${listItemIconClasses.root}`]: {
                                ml: 'auto',
                                minWidth: 0,
                                pl: 1,
                            },
                        }}
                    >
                        <ListItemText>Logout</ListItemText>
                        <ListItemIcon>
                            <LogoutRoundedIcon fontSize="small" />
                        </ListItemIcon>
                    </MenuItem>
                </Menu>
            </Stack>
            <Suspense>
                <ChangeSecondaryPasswordDialog
                    open={changeSecondaryOpen}
                    onSuccess={() => {
                        setChangeSecondaryOpen(false);
                        showAlert('2차 비밀번호가 변경되었습니다.', 'success');
                    }}
                    onClose={() => setChangeSecondaryOpen(false)}
                />
            </Suspense>
        </Drawer>
    );
}
