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
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import WalletIcon from '@mui/icons-material/Wallet';
import FlagIcon from '@mui/icons-material/Flag';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import type {ReactElement} from 'react';

const iconMap: Record<string, ReactElement> = {
    DashboardIcon: <DashboardIcon />,
    HomeRoundedIcon: <HomeRoundedIcon />,
    AnalyticsRoundedIcon: <AnalyticsRoundedIcon />,
    PeopleRoundedIcon: <PeopleRoundedIcon />,
    ShowChartIcon: <ShowChartIcon />,
    FavoriteIcon: <FavoriteIcon />,
    DiamondIcon: <DiamondIcon />,
    GroupIcon: <GroupIcon />,
    RecommendIcon: <RecommendIcon />,
    CurrencyBitcoinIcon: <CurrencyBitcoinIcon />,
    NotificationsIcon: <NotificationsIcon />,
    AdminPanelSettingsIcon: <AdminPanelSettingsIcon />,
    AssuredWorkloadIcon: <AssuredWorkloadIcon />,
    SettingsIcon: <SettingsIcon />,
    MenuIcon: <MenuIcon />,
    WalletIcon: <WalletIcon />,
    FlagIcon: <FlagIcon />,
    FormatListBulletedIcon: <FormatListBulletedIcon />,
    CalendarMonthIcon: <CalendarMonthIcon />,
};

export const getMenuIcon = (iconName: string | null): ReactElement => {
    if (!iconName) return <MenuIcon />;
    return iconMap[iconName] ?? <MenuIcon />;
};

export const iconOptions = Object.keys(iconMap);