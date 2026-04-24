import {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import SearchIcon from '@mui/icons-material/Search';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import SettingsIcon from '@mui/icons-material/Settings';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {useNotification} from '../../context/NotificationContext';
import {fetchPriceTargets, deletePriceTarget} from '../../api/notification/NotificationApi';
import {fetchTimeNow} from '../../api/time/TimeApi';
import {MarketType} from '../../type/timeType';
import type {Notification, AssetType, PriceTarget} from '../../type/NotificationType';
import FreshnessIndicator from '../../components/FreshnessIndicator';

type TabFilter = 'ALL' | AssetType;
type TypeFilter = 'ALL' | '가격' | '목표' | '리밸런싱' | 'API_KEY';
type PeriodFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH';

function matchesTypeFilter(notificationType: string, filter: TypeFilter): boolean {
    if (filter === 'ALL') return true;
    if (filter === '가격') return ['PRICE', 'TRADE', 'TARGET_PRICE'].includes(notificationType);
    if (filter === '목표') return notificationType === 'GOAL';
    if (filter === '리밸런싱') return notificationType === 'REBALANCING';
    if (filter === 'API_KEY') return notificationType === 'API_KEY';
    return true;
}

function matchesPeriod(createdAt: string, period: PeriodFilter): boolean {
    if (period === 'ALL') return true;
    const d = new Date(createdAt);
    const now = new Date();
    if (period === 'TODAY') {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }
    if (period === 'WEEK') {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        return d >= sevenDaysAgo;
    }
    if (period === 'MONTH') {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return d >= thirtyDaysAgo;
    }
    return true;
}

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
    if (notification.type === 'GOAL') {
        return '/dashboard';
    }
    if (notification.type === 'REBALANCING') {
        return '/rebalancing';
    }
    if (notification.type === 'API_KEY') {
        return '/settings';
    }
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
    const {notifications, loading, loadNotifications, handleMarkAsRead, handleMarkAllAsRead} = useNotification();
    const [tabFilter, setTabFilter] = useState<TabFilter>('ALL');
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [priceTargets, setPriceTargets] = useState<PriceTarget[]>([]);
    const [priceTargetDialogOpen, setPriceTargetDialogOpen] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [pollError, setPollError] = useState(false);
    const chartTimer = useRef<number>(0);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetchPriceTargets();
                setPriceTargets(res.result ?? []);
            } catch (e) {
                console.error(e);
            }
        })();
    }, []);

    // 서버 시간과 클라이언트 시간 오차 보정 (다른 폴링 페이지와 동일 패턴)
    const syncServerTime = async () => {
        try {
            const startTime = Date.now();
            const data = await fetchTimeNow({marketType: MarketType.STOCK});
            if (data.code !== '0000') return;
            const endTime = Date.now();
            const delayTime = endTime - startTime;
            const revisionServerTime = data.result.time + delayTime / 2;
            chartTimer.current = revisionServerTime - endTime;
        } catch (error) {
            console.error(error);
        }
    };

    // 알림 1분 주기 폴링 — 서버 시간 기준 매분 정각에 발화
    useEffect(() => {
        setLastUpdated(new Date());

        let interval: ReturnType<typeof setInterval>;
        let timeout: ReturnType<typeof setTimeout>;

        (async () => {
            await syncServerTime();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            timeout = setTimeout(() => {
                (async () => {
                    const ok = await loadNotifications(true);
                    if (ok) {
                        setLastUpdated(new Date());
                        setPollError(false);
                    } else {
                        setPollError(true);
                    }
                })();
                interval = setInterval(async () => {
                    const ok = await loadNotifications(true);
                    if (ok) {
                        setLastUpdated(new Date());
                        setPollError(false);
                    } else {
                        setPollError(true);
                    }
                }, 60_000);
            }, waitTime + 200);
        })();

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, [loadNotifications]);

    const handleDeletePriceTarget = async (id: number) => {
        try {
            await deletePriceTarget(id);
            setPriceTargets(prev => prev.filter(p => p.id !== id));
        } catch (e) {
            console.error(e);
        }
    };

    const handleClick = async (notification: Notification) => {
        if (!notification.isRead) {
            await handleMarkAsRead(notification.id);
        }
        navigate(getNavigationPath(notification));
    };

    const tabFiltered = tabFilter === 'ALL' ? notifications : notifications.filter(n => n.assetType === tabFilter);
    const typeFiltered = tabFiltered.filter(n => matchesTypeFilter(n.type, typeFilter));
    const periodFiltered = typeFiltered.filter(n => matchesPeriod(n.createdAt, periodFilter));
    const query = searchQuery.trim().toLowerCase();
    const searched = query
        ? periodFiltered.filter(n => (n.assetName ?? '').toLowerCase().includes(query))
        : periodFiltered;
    const filtered = unreadOnly ? searched.filter(n => !n.isRead) : searched;
    const grouped = groupByDate(filtered);
    const hasUnread = tabFiltered.some(n => !n.isRead);

    return (
        <Box sx={{width: '100%', maxWidth: 700, mx: 'auto'}}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Box sx={{display: 'flex', alignItems: 'baseline', gap: 1.5}}>
                    <Typography variant="h5" fontWeight="bold">알림</Typography>
                    {!loading && <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>}
                </Box>
                <Box sx={{display: 'flex', gap: 1}}>
                    <Button
                        size="small"
                        startIcon={<NotificationsActiveIcon/>}
                        onClick={() => setPriceTargetDialogOpen(true)}
                    >
                        목표가 관리{priceTargets.length > 0 ? ` (${priceTargets.length})` : ''}
                    </Button>
                    <IconButton size="small" onClick={() => navigate('/notification/settings')} title="알림 설정">
                        <SettingsIcon fontSize="small"/>
                    </IconButton>
                    {hasUnread && (
                        <Button size="small" onClick={handleMarkAllAsRead}>모두 읽음</Button>
                    )}
                </Box>
            </Box>

            <Dialog open={priceTargetDialogOpen} onClose={() => setPriceTargetDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>목표가 알림 관리</DialogTitle>
                <DialogContent sx={{p: 0}}>
                    {priceTargets.length === 0 ? (
                        <Box sx={{py: 4, textAlign: 'center'}}>
                            <Typography variant="body2" color="text.secondary">
                                등록된 목표가 알림이 없습니다.
                            </Typography>
                        </Box>
                    ) : (
                        <List dense disablePadding>
                            {priceTargets.map(target => (
                                <ListItem
                                    key={target.id}
                                    secondaryAction={
                                        <IconButton size="small" onClick={() => handleDeletePriceTarget(target.id)}>
                                            <DeleteOutlineIcon fontSize="small" color="error"/>
                                        </IconButton>
                                    }
                                    sx={{px: 2}}
                                >
                                    <ListItemText
                                        primary={
                                            <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                                <Chip
                                                    label={target.assetType === 'STOCK' ? '주식' : '코인'}
                                                    size="small"
                                                    color="default"
                                                    sx={{fontSize: '0.6rem', height: 18}}
                                                />
                                                <Typography variant="body2">{target.assetName}</Typography>
                                            </Box>
                                        }
                                        secondary={`${target.targetPrice.toLocaleString()}원 ${target.direction === 'ABOVE' ? '이상' : '이하'}`}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPriceTargetDialogOpen(false)}>닫기</Button>
                </DialogActions>
            </Dialog>

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

            <Box sx={{display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap'}}>
                <TextField
                    size="small"
                    placeholder="종목명 검색"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{flex: 1, minWidth: 160}}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small"/>
                                </InputAdornment>
                            ),
                        }
                    }}
                />
                <TextField
                    size="small"
                    select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                    sx={{minWidth: 110}}
                >
                    <MenuItem value="ALL">전체 종류</MenuItem>
                    <MenuItem value="가격">가격</MenuItem>
                    <MenuItem value="목표">목표</MenuItem>
                    <MenuItem value="리밸런싱">리밸런싱</MenuItem>
                    <MenuItem value="API_KEY">API Key</MenuItem>
                </TextField>
                <TextField
                    size="small"
                    select
                    value={periodFilter}
                    onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
                    sx={{minWidth: 110}}
                >
                    <MenuItem value="ALL">전체 기간</MenuItem>
                    <MenuItem value="TODAY">오늘</MenuItem>
                    <MenuItem value="WEEK">최근 7일</MenuItem>
                    <MenuItem value="MONTH">최근 30일</MenuItem>
                </TextField>
            </Box>

            <Divider/>

            {loading ? (
                <Box>
                    {Array.from({length: 2}).map((_, groupIdx) => (
                        <Box key={groupIdx}>
                            <Typography variant="caption" sx={{display: 'block', px: 2, pt: 2, pb: 0.5}}>
                                <Skeleton width={60}/>
                            </Typography>
                            <Stack sx={{px: 1}}>
                                {Array.from({length: 5}).map((_, i) => (
                                    <Box key={i} sx={{display: 'flex', alignItems: 'center', gap: 1.5, py: 1, px: 1}}>
                                        <Skeleton variant="circular" width={20} height={20}/>
                                        <Box sx={{flex: 1}}>
                                            <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5}}>
                                                <Skeleton variant="rounded" width={32} height={18}/>
                                                <Skeleton width={120}/>
                                            </Box>
                                            <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
                                                <Skeleton width={180}/>
                                                <Skeleton width={40}/>
                                            </Box>
                                        </Box>
                                    </Box>
                                ))}
                            </Stack>
                            <Divider/>
                        </Box>
                    ))}
                </Box>
            ) : filtered.length === 0 ? (
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
                                        {(notification.direction === 'UP' || notification.direction === 'UPPER_LIMIT' || notification.direction === 'HIGH_52W' || notification.direction === 'TARGET_ABOVE' || notification.direction === 'GOAL_ACHIEVED' || notification.direction === 'REBALANCING_ASSET' || notification.direction === 'REBALANCING_STOCK') ? (
                                            <TrendingUpIcon color={notification.isRead ? 'disabled' : 'error'} fontSize="small"/>
                                        ) : (
                                            <TrendingDownIcon color={notification.isRead ? 'disabled' : 'primary'} fontSize="small"/>
                                        )}
                                    </Box>
                                    <ListItemText
                                        primary={
                                            <Box component="span" sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                                <Chip
                                                    label={notification.assetType === 'STOCK' ? '주식' : notification.assetType === 'CRYPTO' ? '코인' : '전체'}
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
                                                <Typography variant="caption" component="span" color={
                                                    notification.isRead ? 'text.disabled' :
                                                    (notification.direction === 'UP' || notification.direction === 'UPPER_LIMIT' || notification.direction === 'HIGH_52W' || notification.direction === 'TARGET_ABOVE' || notification.direction === 'GOAL_ACHIEVED' || notification.direction === 'REBALANCING_ASSET' || notification.direction === 'REBALANCING_STOCK') ? 'error' : 'primary'
                                                }>
                                                    {notification.direction === 'REBALANCING_ASSET' ? `비중 초과 (현재 ${notification.fluRt}%)` :
                                                     notification.direction === 'REBALANCING_STOCK' ? `비중 초과 (현재 ${notification.fluRt}%)` :
                                                     notification.direction === 'GOAL_ACHIEVED' ? `목표 달성 (${notification.threshold.toLocaleString()}원)` :
                                                     notification.direction === 'HIGH_52W' ? `52주 신고가 달성 (${notification.fluRt.toLocaleString()}원)` :
                                                     notification.direction === 'LOW_52W' ? `52주 신저가 달성 (${notification.fluRt.toLocaleString()}원)` :
                                                     notification.direction === 'UPPER_LIMIT' ? '상한가 도달' :
                                                     notification.direction === 'LOWER_LIMIT' ? '하한가 도달' :
                                                     notification.direction === 'TARGET_ABOVE' ? `목표가 ${notification.threshold.toLocaleString()}원 이상 도달 (현재 ${notification.fluRt.toLocaleString()}원)` :
                                                     notification.direction === 'TARGET_BELOW' ? `목표가 ${notification.threshold.toLocaleString()}원 이하 도달 (현재 ${notification.fluRt.toLocaleString()}원)` :
                                                     `${notification.direction === 'UP' ? '+' : '-'}${notification.threshold}% 도달 (${notification.fluRt > 0 ? '+' : ''}${notification.fluRt.toFixed(2)}%)`}
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
