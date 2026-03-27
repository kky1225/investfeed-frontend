import {useCallback, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import {fetchNotifications, markAsRead, markAllAsRead} from '../../api/notification/NotificationApi';
import {useNotification} from '../../context/NotificationContext';
import type {Notification, AssetType} from '../../type/NotificationType';

type TabFilter = 'ALL' | AssetType;

function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = today.getTime() - target.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '오늘';
    if (days === 1) return '어제';
    if (days < 7) return `${days}일 전`;
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function groupByDate(notifications: Notification[]): Map<string, Notification[]> {
    const groups = new Map<string, Notification[]>();
    for (const n of notifications) {
        const key = formatDate(n.createdAt);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(n);
    }
    return groups;
}

function getNavigationPath(notification: Notification): string {
    if (notification.type === 'PRICE') {
        if (notification.assetType === 'STOCK') {
            return `/stock/detail/${notification.assetCode}`;
        }
        return `/crypto/detail/${notification.assetCode}`;
    }
    return `/stock/detail/${notification.assetCode}`;
}

export default function NotificationList() {
    const navigate = useNavigate();
    const {loadNotifications: refreshContext} = useNotification();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [tabFilter, setTabFilter] = useState<TabFilter>('ALL');
    const [unreadOnly, setUnreadOnly] = useState(false);

    const loadData = useCallback(async () => {
        const assetType = tabFilter === 'ALL' ? undefined : tabFilter;
        const res = await fetchNotifications(assetType);
        setNotifications(res.result ?? []);
    }, [tabFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleClick = async (notification: Notification) => {
        if (!notification.isRead) {
            await markAsRead(notification.id);
            setNotifications(prev => prev.map(n => n.id === notification.id ? {...n, isRead: true} : n));
            refreshContext();
        }
        navigate(getNavigationPath(notification));
    };

    const handleMarkAll = async () => {
        await markAllAsRead();
        setNotifications(prev => prev.map(n => ({...n, isRead: true})));
        refreshContext();
    };

    const filtered = unreadOnly ? notifications.filter(n => !n.isRead) : notifications;
    const grouped = groupByDate(filtered);
    const hasUnread = notifications.some(n => !n.isRead);

    return (
        <Box sx={{width: '100%', maxWidth: 700, mx: 'auto'}}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Typography variant="h5" fontWeight="bold">알림</Typography>
                {hasUnread && (
                    <Button size="small" onClick={handleMarkAll}>모두 읽음</Button>
                )}
            </Box>

            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
                <Tabs
                    value={tabFilter}
                    onChange={(_, v) => setTabFilter(v)}
                    sx={{minHeight: 36}}
                >
                    <Tab label="전체" value="ALL" sx={{minHeight: 36, py: 0}}/>
                    <Tab label="주식" value="STOCK" sx={{minHeight: 36, py: 0}}/>
                    <Tab label="코인" value="CRYPTO" sx={{minHeight: 36, py: 0}}/>
                </Tabs>
                <FormControlLabel
                    control={<Switch size="small" checked={unreadOnly} onChange={(_, v) => setUnreadOnly(v)}/>}
                    label={<Typography variant="caption">안읽음만</Typography>}
                    sx={{mr: 0}}
                />
            </Box>

            <Divider/>

            {filtered.length === 0 ? (
                <Box sx={{py: 8, textAlign: 'center'}}>
                    <NotificationsNoneIcon sx={{fontSize: 48, color: 'text.disabled', mb: 1}}/>
                    <Typography variant="body2" color="text.secondary">
                        {unreadOnly ? '안읽은 알림이 없습니다' : '알림이 없습니다'}
                    </Typography>
                </Box>
            ) : (
                Array.from(grouped.entries()).map(([dateLabel, items]) => (
                    <Box key={dateLabel}>
                        <Typography variant="caption" color="text.secondary" sx={{display: 'block', px: 2, pt: 2, pb: 0.5}}>
                            {dateLabel}
                        </Typography>
                        <List disablePadding>
                            {items.map((notification) => (
                                <ListItemButton
                                    key={notification.id}
                                    onClick={() => handleClick(notification)}
                                    sx={{
                                        bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                                        opacity: notification.isRead ? 0.5 : 1,
                                        '&:hover': {bgcolor: 'action.selected', opacity: 1},
                                        borderRadius: 1,
                                        my: 0.5,
                                        mx: 1,
                                    }}
                                >
                                    <Box sx={{mr: 1.5, display: 'flex', alignItems: 'center'}}>
                                        {notification.direction === 'UP' ? (
                                            <TrendingUpIcon color={notification.isRead ? 'disabled' : 'error'} fontSize="small"/>
                                        ) : (
                                            <TrendingDownIcon color={notification.isRead ? 'disabled' : 'primary'} fontSize="small"/>
                                        )}
                                    </Box>
                                    <ListItemText
                                        primary={
                                            <Box component="span" sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                                <Chip
                                                    label={notification.assetType === 'STOCK' ? '주식' : '코인'}
                                                    size="small"
                                                    color="default"
                                                    sx={{fontSize: '0.6rem', height: 18}}
                                                />
                                                <Typography variant="body2" component="span" noWrap color={notification.isRead ? 'text.disabled' : 'text.primary'}>
                                                    {notification.assetName}
                                                </Typography>
                                            </Box>
                                        }
                                        secondary={
                                            <Box component="span" sx={{display: 'flex', justifyContent: 'space-between', mt: 0.5}}>
                                                <Typography variant="caption" component="span" color={notification.isRead ? 'text.disabled' : (notification.direction === 'UP' ? 'error' : 'primary')}>
                                                    {notification.direction === 'UP' ? '+' : '-'}{notification.threshold}% 도달
                                                    ({notification.fluRt > 0 ? '+' : ''}{notification.fluRt.toFixed(2)}%)
                                                </Typography>
                                                <Typography variant="caption" component="span" color="text.disabled">
                                                    {formatTime(notification.createdAt)}
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                        <Divider/>
                    </Box>
                ))
            )}
        </Box>
    );
}
