import { MouseEvent, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider, { dividerClasses } from '@mui/material/Divider';
import Drawer, { drawerClasses } from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MuiMenuItem from '@mui/material/MenuItem';
import { styled } from '@mui/material/styles';
import { ListItemText } from '@mui/material';
import ListItemIcon, { listItemIconClasses } from '@mui/material/ListItemIcon';
import { listClasses } from '@mui/material/List';
import { paperClasses } from '@mui/material/Paper';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import LockResetIcon from '@mui/icons-material/LockReset';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import MenuButton from './MenuButton';
import MenuContent from './MenuContent';
import CardAlert from './CardAlert';
import { useAuth } from '../context/AuthContext';
import { logout } from '../api/auth/AuthApi';
import { useNavigate } from 'react-router-dom';

const MenuItem = styled(MuiMenuItem)({
    margin: '2px 0',
});

interface SideMenuMobileProps {
    open: boolean | undefined;
    toggleDrawer: (newOpen: boolean) => () => void;
}

export default function SideMenuMobile({ open, toggleDrawer }: SideMenuMobileProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(anchorEl);
    const { user, clearAuth } = useAuth();
    const navigate = useNavigate();

    const displayName = user?.nickname ?? user?.loginId ?? '';
    const displayEmail = user?.email ?? '';
    const initials = displayName.charAt(0).toUpperCase();

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
        } catch {
            // 서버 오류여도 로컬 상태는 초기화
        } finally {
            clearAuth();
            navigate('/login');
        }
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={toggleDrawer(false)}
            sx={{
                zIndex: (theme) => theme.zIndex.drawer + 1,
                [`& .${drawerClasses.paper}`]: {
                    backgroundImage: 'none',
                    backgroundColor: 'background.paper',
                },
            }}
        >
            <Stack
                sx={{
                    maxWidth: '70dvw',
                    height: '100%',
                }}
            >
                <Stack sx={{ flexGrow: 1, overflow: 'auto' }}>
                    <MenuContent />
                </Stack>
                <CardAlert />
                <Stack
                    direction="row"
                    sx={{
                        p: 2,
                        gap: 1,
                        alignItems: 'center',
                        borderTop: '1px solid',
                        borderColor: 'divider',
                    }}
                >
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
                    <Menu
                        anchorEl={anchorEl}
                        id="mobile-user-menu"
                        open={menuOpen}
                        onClose={handleClose}
                        onClick={handleClose}
                        transformOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
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
                        <Divider />
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
            </Stack>
        </Drawer>
    );
}
