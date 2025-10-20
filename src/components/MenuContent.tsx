import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import AnalyticsRoundedIcon from '@mui/icons-material/AnalyticsRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import HelpRoundedIcon from '@mui/icons-material/HelpRounded';
import {useLocation, useNavigate} from "react-router-dom";

const mainListItems = [
    { id: 1, text: '대시보드', icon: <HomeRoundedIcon />, url: '/' },
    { id: 2, text: '주요 지수', icon: <AnalyticsRoundedIcon />, url: '/index' },
    { id: 3, text: '주식', icon: <ShowChartIcon />, url: '/stock' },
    { id: 4, text: '관심 종목', icon: <PeopleRoundedIcon />, url: '/favorite' },
    { id: 5, text: '보유 주식', icon: <PeopleRoundedIcon />, url: '/holding' },
];

const secondaryListItems = [
    { text: 'Settings', icon: <SettingsRoundedIcon />, url: '/setting' },
    { text: 'About', icon: <InfoRoundedIcon />, url: '/about' },
    { text: 'Feedback', icon: <HelpRoundedIcon />, url: '/feedback' },
];

export default function MenuContent() {
    const location = useLocation();
    const navigate = useNavigate();

    const onClick = (url: string) => {
        navigate(url);
    };

    return (
        <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
            <List dense>
                {mainListItems.map((item, index) => (
                    <ListItem key={index} disablePadding sx={{ display: 'block' }}>
                        <ListItemButton selected={location.pathname === item.url} onClick={() => onClick(item.url)}>
                            <ListItemIcon>{item.icon}</ListItemIcon>
                            <ListItemText primary={item.text} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
            <List dense>
                {secondaryListItems.map((item, index) => (
                    <ListItem key={index} disablePadding sx={{ display: 'block' }}>
                        <ListItemButton>
                            <ListItemIcon>{item.icon}</ListItemIcon>
                            <ListItemText primary={item.text} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Stack>
    );
}