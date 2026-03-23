import {useRef, useState} from 'react';
import Stack from '@mui/material/Stack';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import NavbarBreadcrumbs from './NavbarBreadcrumbs';
import MenuButton from './MenuButton';
import ColorModeIconDropdown from './ColorModeSelect.tsx';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import InputAdornment from '@mui/material/InputAdornment';
import Chip from '@mui/material/Chip';
import {fetchStockSearch} from '../api/stock/StockApi.ts';
import {fetchCryptoSearch} from '../api/crypto/CryptoApi.ts';
import {useNavigate} from 'react-router-dom';
import {useNotification} from '../context/NotificationContext';
import NotificationPopover from './NotificationPopover';

interface SearchItem {
    code: string;
    name: string;
    marketName: string;
    category: '주식' | '코인';
}

export default function Header() {
    const navigate = useNavigate();
    const {unreadCount, refreshAll} = useNotification();
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [notificationAnchorEl, setNotificationAnchorEl] = useState<HTMLElement | null>(null);

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
            } catch {
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
        if (value.category === '코인') {
            navigate(`/crypto/detail/${value.code}`);
        } else {
            navigate(`/stock/detail/${value.code}`);
        }
    };

    return (
        <Stack
            direction="row"
            sx={{
                display: {xs: 'none', md: 'flex'},
                width: '100%',
                alignItems: {xs: 'flex-start', md: 'center'},
                justifyContent: 'space-between',
                maxWidth: {sm: '100%', md: '1700px'},
                pt: 1.5,
            }}
            spacing={2}
        >
            <NavbarBreadcrumbs/>
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
                forcePopupIcon={false}
                slotProps={{
                    clearIndicator: { size: 'small', sx: { padding: '1px', '& svg': { fontSize: '16px' } } },
                }}
                sx={{width: 280}}
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
                        size="small"
                        placeholder="종목/코인 검색"
                        slotProps={{
                            input: {
                                ...params.InputProps,
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon fontSize="small" sx={{color: 'text.disabled'}}/>
                                    </InputAdornment>
                                ),
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
            <Stack direction="row" sx={{gap: 1}}>
                <MenuButton
                    showBadge={unreadCount > 0}
                    aria-label="Open notifications"
                    onClick={(e) => {
                        refreshAll();
                        setNotificationAnchorEl(e.currentTarget);
                    }}
                >
                    <NotificationsRoundedIcon/>
                </MenuButton>
                <ColorModeIconDropdown/>
            </Stack>
            <NotificationPopover
                anchorEl={notificationAnchorEl}
                open={Boolean(notificationAnchorEl)}
                onClose={() => setNotificationAnchorEl(null)}
            />
        </Stack>
    );
}
