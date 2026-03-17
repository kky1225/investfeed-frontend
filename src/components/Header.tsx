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
import {fetchStockSearch} from '../api/stock/StockApi.ts';
import {useNavigate} from 'react-router-dom';

interface StockSearchItem {
    stkCd: string;
    stkNm: string;
    marketName: string;
}

export default function Header() {
    const navigate = useNavigate();
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<StockSearchItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                const data = await fetchStockSearch(keyword.trim());
                setSearchResults(data.result ?? []);
            } catch {
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
    };

    const handleSelect = (_: unknown, value: StockSearchItem | null) => {
        if (!value) return;
        setSearchKeyword('');
        setSearchResults([]);
        navigate(`/stock/detail/${value.stkCd}`);
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
                getOptionLabel={(option) => `${option.stkNm} (${option.stkCd})`}
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
                    <Box component="li" {...props} key={`${option.stkCd}-${option.marketName}`}>
                        <Stack direction="row" sx={{width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 1}}>
                            <Box>
                                <Typography variant="body2">{option.stkNm}</Typography>
                                <Typography variant="caption" color="text.secondary">{option.stkCd}</Typography>
                            </Box>
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
                        placeholder="종목 검색"
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
                <MenuButton showBadge aria-label="Open notifications">
                    <NotificationsRoundedIcon/>
                </MenuButton>
                <ColorModeIconDropdown/>
            </Stack>
        </Stack>
    );
}
