import {useRef, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import {fetchStockSearch} from "../../api/stock/StockApi.ts";
import {fetchCryptoSearch} from "../../api/crypto/CryptoApi.ts";
import {fetchCommodityList} from "../../api/commodity/CommodityApi.ts";
import type {MultiViewAssetType, SelectedAsset} from "../../type/MultiViewType.ts";
import {unwrapResponse} from "../../lib/apiResponse.ts";

interface MultiViewSearchDialogProps {
    open: boolean;
    onClose: () => void;
    onSelect: (asset: SelectedAsset) => void;
}

interface SearchItem {
    stkCd: string;
    stkNm: string;
    marketName?: string;
}

export default function MultiViewSearchDialog({open, onClose, onSelect}: MultiViewSearchDialogProps) {
    const [tab, setTab] = useState(0);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // 원자재 목록 — open && tab === 2 일 때만 fetch (lazy load)
    const {data: commodityListData} = useQuery<SearchItem[]>({
        queryKey: ['multiView', 'commodityList'],
        queryFn: async ({signal}) => {
            const result = unwrapResponse(await fetchCommodityList({signal, skipGlobalError: true}), {commodityList: [] as {stkCd: string; stkNm: string}[]});
            return (result.commodityList ?? []).map((item: {stkCd: string; stkNm: string}) => ({
                stkCd: item.stkCd,
                stkNm: item.stkNm,
            }));
        },
        enabled: open && tab === 2,
        staleTime: Infinity,  // 한 번 로드한 뒤 재요청 X (정적 데이터)
    });
    const commodityList = commodityListData ?? [];

    const handleClose = () => {
        setSearchKeyword("");
        setSearchResults([]);
        onClose();
    };

    const handleSearch = (keyword: string) => {
        setSearchKeyword(keyword);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (!keyword.trim()) {
            setSearchResults([]);
            return;
        }
        searchTimerRef.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                if (tab === 0) {
                    const data = await fetchStockSearch(keyword.trim());
                    if (data.code !== "0000") throw new Error(data.message || `주식 검색 실패 (${data.code})`);
                    setSearchResults(data.result ?? []);
                } else {
                    // 코인: backend {market, koreanName, englishName} → SearchItem 으로 매핑
                    const data = await fetchCryptoSearch(keyword.trim());
                    if (data.code !== "0000") throw new Error(data.message || `코인 검색 실패 (${data.code})`);
                    const items: SearchItem[] = (data.result ?? []).map((item: {market: string; koreanName: string; englishName?: string}) => ({
                        stkCd: item.market,
                        stkNm: item.koreanName,
                        marketName: item.englishName,
                    }));
                    setSearchResults(items);
                }
            } catch (error) {
                console.error(error);
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
    };

    const handleSelect = (item: SearchItem) => {
        const typeMap: MultiViewAssetType[] = ['STOCK', 'CRYPTO', 'COMMODITY'];
        onSelect({type: typeMap[tab], code: item.stkCd, name: item.stkNm});
        handleClose();
    };

    const handleTabChange = (_: unknown, v: number) => {
        setTab(v);
        setSearchKeyword("");
        setSearchResults([]);
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <DialogTitle>종목 선택</DialogTitle>
            <DialogContent>
                <Tabs value={tab} onChange={handleTabChange} sx={{mb: 2}}>
                    <Tab label="주식"/>
                    <Tab label="코인"/>
                    <Tab label="원자재"/>
                </Tabs>

                {tab !== 2 ? (
                    <Autocomplete
                        size="small"
                        options={searchResults}
                        getOptionLabel={(option) => `${option.stkNm} (${option.stkCd})`}
                        filterOptions={(x) => x}
                        loading={searchLoading}
                        inputValue={searchKeyword}
                        onInputChange={(_, value) => handleSearch(value)}
                        onChange={(_, value) => {
                            if (value) handleSelect(value);
                        }}
                        noOptionsText={searchKeyword ? "검색 결과 없음" : "종목명을 입력하세요"}
                        forcePopupIcon={false}
                        renderOption={(props, option) => (
                            <Box component="li" {...props} key={`${option.stkCd}-${option.marketName}`}>
                                <Stack direction="row" sx={{width: "100%", justifyContent: "space-between", alignItems: "center"}}>
                                    <Box>
                                        <Typography variant="body2">{option.stkNm}</Typography>
                                        <Typography variant="caption" color="text.secondary">{option.stkCd}</Typography>
                                    </Box>
                                    {option.marketName && (
                                        <Typography variant="caption" color="text.secondary">{option.marketName}</Typography>
                                    )}
                                </Stack>
                            </Box>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                autoFocus
                                placeholder="종목명을 입력하세요"
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
                ) : (
                    <List dense>
                        {commodityList.map((item) => (
                            <ListItemButton key={item.stkCd} onClick={() => handleSelect(item)}>
                                <ListItemText primary={item.stkNm} secondary={item.stkCd}/>
                            </ListItemButton>
                        ))}
                    </List>
                )}
            </DialogContent>
        </Dialog>
    );
}
