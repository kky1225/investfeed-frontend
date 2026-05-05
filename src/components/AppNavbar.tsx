import {useRef, useState} from 'react';
import { styled } from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import MuiToolbar from '@mui/material/Toolbar';
import { tabsClasses } from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import SideMenuMobile from './SideMenuMobile';
import MenuButton from './MenuButton';
import ColorModeIconDropdown from './ColorModeSelect.tsx';
import NotificationPopover from './NotificationPopover';
import {useNotification} from '../context/NotificationContext';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Chip from '@mui/material/Chip';
import {fetchStockSearch} from '../api/stock/StockApi.ts';
import {fetchCryptoSearch} from '../api/crypto/CryptoApi.ts';
import {useNavigate} from 'react-router-dom';

interface SearchItem {
    code: string;
    name: string;
    marketName: string;
    category: '주식' | '코인';
}

const Toolbar = styled(MuiToolbar)({
    width: '100%',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'start',
    justifyContent: 'center',
    gap: '12px',
    flexShrink: 0,
    [`& ${tabsClasses.flexContainer}`]: {
        gap: '8px',
        p: '8px',
        pb: 0,
    },
});

export default function AppNavbar() {
    const navigate = useNavigate();
    const {unreadCount, refreshAll} = useNotification();
    const [open, setOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [notificationAnchorEl, setNotificationAnchorEl] = useState<HTMLElement | null>(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const toggleDrawer = (newOpen: boolean) => () => {
        setOpen(newOpen);
    };

    const handleSearchKeywordChange = (keyword: string) => {
        setSearchKeyword(keyword);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (!keyword.trim()) {
            setSearchResults([]);
            return;
        }

        searchTimerRef.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const [stockData, cryptoData] = await Promise.all([
                    fetchStockSearch(keyword.trim()),
                    fetchCryptoSearch(keyword.trim()),
                ]);
                if (stockData.code !== "0000") throw new Error(stockData.message || `주식 검색 실패 (${stockData.code})`);
                if (cryptoData.code !== "0000") throw new Error(cryptoData.message || `코인 검색 실패 (${cryptoData.code})`);

                const stockResults: SearchItem[] = (stockData.result ?? []).map((s: { stkCd: string; stkNm: string; marketName: string }) => ({
                    code: s.stkCd,
                    name: s.stkNm,
                    marketName: s.marketName,
                    category: '주식' as const,
                }));

                const cryptoResults: SearchItem[] = (cryptoData.result ?? []).map((c: { market: string; koreanName: string; englishName: string }) => ({
                    code: c.market,
                    name: c.koreanName,
                    marketName: 'Upbit',
                    category: '코인' as const,
                }));

                setSearchResults([...cryptoResults, ...stockResults]);
            } catch (error) {
                console.error(error);
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
    };

    const handleSelect = (_: unknown, value: SearchItem | null) => {
        if (!value) return;
        setSearchKeyword('');
        setSearchResults([]);
        setSearchOpen(false);
        if (value.category === '코인') {
            navigate(`/crypto/detail/${value.code}`);
        } else {
            navigate(`/stock/detail/${value.code}`);
        }
    };

    return (
        <AppBar
            position="fixed"
            sx={{
                display: { xs: 'auto', md: 'none' },
                boxShadow: 0,
                bgcolor: 'background.paper',
                backgroundImage: 'none',
                borderBottom: '1px solid',
                borderColor: 'divider',
                top: 'var(--template-frame-height, 0px)',
            }}
        >
            <Toolbar variant="regular">
                <Stack
                    direction="row"
                    sx={{
                        alignItems: 'center',
                        flexGrow: 1,
                        width: '100%',
                        gap: 1,
                    }}
                >
                    <Stack
                        direction="row"
                        spacing={1}
                        sx={{ justifyContent: 'center', mr: 'auto' }}
                    >
                        <CustomIcon />
                        <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>
                            InvestFeed
                        </Typography>
                    </Stack>
                    <MenuButton aria-label="search" onClick={() => setSearchOpen(prev => !prev)}>
                        <SearchRoundedIcon />
                    </MenuButton>
                    <MenuButton
                        showBadge={unreadCount > 0}
                        aria-label="Open notifications"
                        onClick={(e) => {
                            refreshAll();
                            setNotificationAnchorEl(e.currentTarget);
                        }}
                    >
                        <NotificationsRoundedIcon />
                    </MenuButton>
                    <ColorModeIconDropdown />
                    <MenuButton aria-label="menu" onClick={toggleDrawer(true)}>
                        <MenuRoundedIcon />
                    </MenuButton>
                    <SideMenuMobile open={open} toggleDrawer={toggleDrawer} />
                    <NotificationPopover
                        anchorEl={notificationAnchorEl}
                        open={Boolean(notificationAnchorEl)}
                        onClose={() => setNotificationAnchorEl(null)}
                    />
                </Stack>
                <Collapse in={searchOpen} sx={{width: '100%'}}>
                    <Autocomplete
                        options={searchResults}
                        getOptionLabel={(option) => `${option.name} (${option.code})`}
                        filterOptions={(x) => x}
                        loading={searchLoading}
                        inputValue={searchKeyword}
                        value={null}
                        onInputChange={(_, value) => handleSearchKeywordChange(value)}
                        onChange={handleSelect}
                        noOptionsText={searchKeyword ? '검색 결과 없음' : '종목명을 입력하세요'}
                        fullWidth
                        forcePopupIcon={false}
                        slotProps={{
                            clearIndicator: { size: 'small', sx: { padding: '1px', '& svg': { fontSize: '16px' } } },
                        }}
                        renderOption={(props, option) => (
                            <Box component="li" {...props} key={`${option.category}-${option.code}-${option.marketName}`}>
                                <Stack direction="row" sx={{width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 1}}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Chip
                                            label={option.category}
                                            size="small"
                                            color="default"
                                            sx={{ fontSize: '0.65rem', height: 20 }}
                                        />
                                        <Box>
                                            <Typography variant="body2">{option.name}</Typography>
                                            <Typography variant="caption" color="text.secondary">{option.code}</Typography>
                                        </Box>
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary" sx={{flexShrink: 0}}>
                                        {option.marketName}
                                    </Typography>
                                </Stack>
                            </Box>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                autoFocus
                                size="small"
                                placeholder="종목/코인 검색"
                                slotProps={{
                                    input: {
                                        ...params.InputProps,
                                        endAdornment: (
                                            <>
                                                {searchLoading ? <CircularProgress size={16}/> : null}
                                                {params.InputProps.endAdornment}
                                            </>
                                        ),
                                    }
                                }}
                            />
                        )}
                    />
                </Collapse>
            </Toolbar>
        </AppBar>
    );
}

export function CustomIcon() {
    return (
        <Box
            sx={{
                width: '1.5rem',
                height: '1.5rem',
                bgcolor: 'black',
                borderRadius: '999px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                alignSelf: 'center',
                backgroundImage:
                    'linear-gradient(135deg, hsl(210, 98%, 60%) 0%, hsl(210, 100%, 35%) 100%)',
                color: 'hsla(210, 100%, 95%, 0.9)',
                border: '1px solid',
                borderColor: 'hsl(210, 100%, 55%)',
                boxShadow: 'inset 0 2px 5px rgba(255, 255, 255, 0.3)',
            }}
        >
            <DashboardRoundedIcon color="inherit" sx={{ fontSize: '1rem' }} />
        </Box>
    );
}
