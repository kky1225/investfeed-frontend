import { styled } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuContent from './MenuContent';
import CardAlert from './CardAlert';
import { MouseEvent, useState } from "react";
import MuiMenuItem from "@mui/material/MenuItem";
import MenuButton from "./MenuButton.tsx";
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ListItemIcon, { listItemIconClasses } from "@mui/material/ListItemIcon";
import Divider, { dividerClasses } from "@mui/material/Divider";
import { ListItemText } from '@mui/material';
import { listClasses } from "@mui/material/List";
import { paperClasses } from "@mui/material/Paper";
import { useAuth } from '../context/AuthContext';
import { logout } from '../api/auth/AuthApi';
import { useNavigate } from 'react-router-dom';

const drawerWidth = 240;

const Drawer = styled(MuiDrawer)({
    width: drawerWidth,
    flexShrink: 0,
    boxSizing: 'border-box',
    mt: 10,
    [`& .${drawerClasses.paper}`]: {
        width: drawerWidth,
        boxSizing: 'border-box',
    },
});

const MenuItem = styled(MuiMenuItem)({
    margin: '2px 0',
});

export default function SideMenu() {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
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
        } catch {
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
            sx={{
                display: { xs: 'none', md: 'block' },
                [`& .${drawerClasses.paper}`]: {
                    backgroundColor: 'background.paper',
                },
            }}
        >
            <Box
                sx={{
                    overflow: 'auto',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <MenuContent />
                <CardAlert />
            </Box>
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
                <Avatar
                    sizes="small"
                    sx={{ width: 36, height: 36 }}
                >
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
                    id="menu"
                    open={open}
                    onClose={handleClose}
                    onClick={handleClose}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
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
                        onClick={handleLogout}
                        sx={{
                            [`& .${listItemIconClasses.root}`]: {
                                ml: 'auto',
                                minWidth: 0,
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
        </Drawer>
    );
}
