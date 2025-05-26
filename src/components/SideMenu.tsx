import { styled } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuContent from './MenuContent';
import CardAlert from './CardAlert';
import {MouseEvent, useState} from "react";
import MuiMenuItem from "@mui/material/MenuItem";
import MenuButton from "./MenuButton.tsx";
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ListItemIcon, {listItemIconClasses} from "@mui/material/ListItemIcon";
import Divider, {dividerClasses} from "@mui/material/Divider";
import { ListItemText } from '@mui/material';
import {listClasses} from "@mui/material/List";
import {paperClasses} from "@mui/material/Paper";

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
    const handleClick = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

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
                    alt="Riley Carter"
                    src="/static/images/avatar/7.jpg"
                    sx={{ width: 36, height: 36 }}
                />
                <Box sx={{ mr: 'auto' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: '16px' }}>
                        Riley Carter
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        riley@email.com
                    </Typography>
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
                    <MenuItem onClick={handleClose}>Profile</MenuItem>
                    <MenuItem onClick={handleClose}>My account</MenuItem>
                    <Divider />
                    <MenuItem onClick={handleClose}>Add another account</MenuItem>
                    <MenuItem onClick={handleClose}>Settings</MenuItem>
                    <Divider />
                    <MenuItem
                        onClick={handleClose}
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