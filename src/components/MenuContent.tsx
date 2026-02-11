import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import DashboardIcon from '@mui/icons-material/Dashboard';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import AnalyticsRoundedIcon from '@mui/icons-material/AnalyticsRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import HelpRoundedIcon from '@mui/icons-material/HelpRounded';
import DiamondIcon from '@mui/icons-material/Diamond';
import GroupIcon from '@mui/icons-material/Group';
import {useLocation, useNavigate} from "react-router-dom";
import {Fragment, useState} from "react";
import { Collapse } from "@mui/material";
import {ExpandLess, ExpandMore} from "@mui/icons-material";

const mainListItems = [
    { id: 1, text: '대시보드', icon: <DashboardIcon />, url: '/' },
    { id: 2, text: '주요 지수', icon: <AnalyticsRoundedIcon />, url: '/index/list' },
    { id: 3, text: '업종', icon: <HomeRoundedIcon />, url: '/sect/list/001' },
    { id: 4, text: '테마', icon: <GroupIcon />, url: '/theme/list' },
    { id: 5, text: '주식', icon: <ShowChartIcon />, url: '/stock/list/0' },
    { id: 6, text: '투자자별', icon: <GroupIcon />,
        children: [
            { id: 10, text: '장중 매매 순위', url: '/investor/6/list/1', icon: <GroupIcon /> },
            { id: 11, text: '장마감 후 매매 순위', url: '/investor/7/list/1', icon: <GroupIcon /> },
        ]
    },
    { id: 7, text: '원자재', icon: <DiamondIcon />, url: '/commodity/list' },
    { id: 8, text: '관심 종목', icon: <PeopleRoundedIcon />, url: '/favorite/list' },
    { id: 9, text: '보유 주식', icon: <PeopleRoundedIcon />, url: '/holding/list' },
];

// const secondaryListItems = [
//     { text: 'Settings', icon: <SettingsRoundedIcon />, url: '/setting' },
//     { text: 'About', icon: <InfoRoundedIcon />, url: '/about' },
//     { text: 'Feedback', icon: <HelpRoundedIcon />, url: '/feedback' },
// ];

export default function MenuContent() {
    const location = useLocation();
    const navigate = useNavigate();

    const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);

    const handleMainMenuClick = (item: any) => {
        if (item.children) {
            setOpenSubMenu(openSubMenu === item.text ? null : item.text);
        } else {
            navigate(item.url);
            setOpenSubMenu(null);
        }
    };

    return (
        <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
            <List dense>
                {mainListItems.map((item) => (
                    <Fragment key={item.id}>
                        <ListItem disablePadding sx={{ display: 'block' }}>
                            <ListItemButton
                                selected={location.pathname === item.url}
                                onClick={() => handleMainMenuClick(item)}
                            >
                                <ListItemIcon>{item.icon}</ListItemIcon>
                                <ListItemText primary={item.text} />
                                {item.children ? (openSubMenu === item.text ? <ExpandLess /> : <ExpandMore />) : null}
                            </ListItemButton>
                        </ListItem>

                        {item.children && (
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
                    </Fragment>
                ))}
            </List>

            {/*<List dense>*/}
            {/*    {secondaryListItems.map((item, index) => (*/}
            {/*        <ListItem key={index} disablePadding sx={{ display: 'block' }}>*/}
            {/*            <ListItemButton>*/}
            {/*                <ListItemIcon>{item.icon}</ListItemIcon>*/}
            {/*                <ListItemText primary={item.text} />*/}
            {/*            </ListItemButton>*/}
            {/*        </ListItem>*/}
            {/*    ))}*/}
            {/*</List>*/}
        </Stack>
    );
}