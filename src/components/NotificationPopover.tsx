import {useNavigate} from 'react-router-dom';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import {useNotification} from '../context/NotificationContext';
import type {Notification} from '../type/NotificationType';

interface NotificationPopoverProps {
    anchorEl: HTMLElement | null;
    open: boolean;
    onClose: () => void;
}

function formatTime(createdAt: string) {
    const date = new Date(createdAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
}

function getNavigationPath(notification: Notification): string {
    if (notification.type === 'PRICE') {
        if (notification.assetType === 'STOCK') {
            return `/stock/detail/${notification.assetCode}`;
        }
        return `/crypto/detail/${notification.assetCode}`;
    }
    // TRADE 타입은 추후 매매 페이지로 이동
    return `/stock/detail/${notification.assetCode}`;
}

export default function NotificationPopover({anchorEl, open, onClose}: NotificationPopoverProps) {
    const navigate = useNavigate();
    const {notifications, handleMarkAsRead, handleMarkAllAsRead} = useNotification();

    const unreadNotifications = notifications.filter(n => !n.isRead);

    const handleClick = async (notification: Notification) => {
        if (!notification.isRead) {
            await handleMarkAsRead(notification.id);
        }
        onClose();
        navigate(getNavigationPath(notification));
    };

    const handleMarkAll = async () => {
        await handleMarkAllAsRead();
    };

    const handleViewAll = () => {
        onClose();
        navigate('/notification/list');
    };

    return (
        <Popover
            anchorEl={anchorEl}
            open={open}
            onClose={onClose}
            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'right'}}
            slotProps={{
                paper: {
                    sx: {width: 380, maxHeight: 480}
                }
            }}
        >
            <Box sx={{p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <Typography variant="subtitle1" fontWeight="bold">알림</Typography>
                {unreadNotifications.length > 0 && (
                    <Button size="small" onClick={handleMarkAll}>모두 읽음</Button>
                )}
            </Box>
            <Divider/>
            {unreadNotifications.length === 0 ? (
                <Box sx={{p: 4, textAlign: 'center'}}>
                    <Typography variant="body2" color="text.secondary">새로운 알림이 없습니다</Typography>
                </Box>
            ) : (
                <List disablePadding sx={{overflow: 'auto', maxHeight: 340}}>
                    {unreadNotifications.map((notification) => (
                        <ListItemButton
                            key={notification.id}
                            onClick={() => handleClick(notification)}
                            sx={{
                                bgcolor: 'action.hover',
                                '&:hover': {bgcolor: 'action.selected'},
                            }}
                        >
                            <Box sx={{mr: 1.5, display: 'flex', alignItems: 'center'}}>
                                {(notification.direction === 'UP' || notification.direction === 'UPPER_LIMIT' || notification.direction === 'HIGH_52W' || notification.direction === 'TARGET_ABOVE') ? (
                                    <TrendingUpIcon color="error" fontSize="small"/>
                                ) : (
                                    <TrendingDownIcon color="primary" fontSize="small"/>
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
                                        <Typography variant="body2" noWrap>
                                            {notification.assetName}
                                        </Typography>
                                    </Box>
                                }
                                secondary={
                                    <Box component="span" sx={{display: 'flex', justifyContent: 'space-between', mt: 0.5}}>
                                        <Typography variant="caption" color={
                                            (notification.direction === 'UP' || notification.direction === 'UPPER_LIMIT' || notification.direction === 'HIGH_52W' || notification.direction === 'TARGET_ABOVE') ? 'error' : 'primary'
                                        }>
                                            {notification.direction === 'HIGH_52W' ? `52주 신고가 달성 (${notification.fluRt.toLocaleString()}원)` :
                                             notification.direction === 'LOW_52W' ? `52주 신저가 달성 (${notification.fluRt.toLocaleString()}원)` :
                                             notification.direction === 'UPPER_LIMIT' ? '상한가 도달' :
                                             notification.direction === 'LOWER_LIMIT' ? '하한가 도달' :
                                             notification.direction === 'TARGET_ABOVE' ? `목표가 ${notification.threshold.toLocaleString()}원 이상 도달 (현재 ${notification.fluRt.toLocaleString()}원)` :
                                             notification.direction === 'TARGET_BELOW' ? `목표가 ${notification.threshold.toLocaleString()}원 이하 도달 (현재 ${notification.fluRt.toLocaleString()}원)` :
                                             `${notification.direction === 'UP' ? '+' : '-'}${notification.threshold}% 도달 (${notification.fluRt > 0 ? '+' : ''}${notification.fluRt.toFixed(2)}%)`}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatTime(notification.createdAt)}
                                        </Typography>
                                    </Box>
                                }
                            />
                        </ListItemButton>
                    ))}
                </List>
            )}
            <Divider/>
            <Box sx={{p: 1, textAlign: 'center'}}>
                <Button size="small" fullWidth onClick={handleViewAll}>
                    전체 알림 보기
                </Button>
            </Box>
        </Popover>
    );
}
