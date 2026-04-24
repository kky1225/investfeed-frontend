import {useEffect, useRef, useState} from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {fetchStockSearch} from "../../api/stock/StockApi.ts";
import {createManualHolding} from "../../api/broker/BrokerApi.ts";

interface StockSearchItem {
    stkCd: string;
    stkNm: string;
    marketName: string;
}

interface AddManualHoldingDialogProps {
    open: boolean;
    onClose: () => void;
    brokerId: number;
    onCreated: () => void;
}

export default function AddManualHoldingDialog({open, onClose, brokerId, onCreated}: AddManualHoldingDialogProps) {
    const [selectedStock, setSelectedStock] = useState<StockSearchItem | null>(null);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [searchResults, setSearchResults] = useState<StockSearchItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [purPrice, setPurPrice] = useState("");
    const [quantity, setQuantity] = useState("");
    const [purAmt, setPurAmt] = useState("");
    const [purAmtManual, setPurAmtManual] = useState(false);
    const [formErrors, setFormErrors] = useState<{stkCd?: string; purPrice?: string; quantity?: string; purAmt?: string}>({});
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        if (!purAmtManual && purPrice && quantity) {
            setPurAmt(String(Number(purPrice) * Number(quantity)));
        }
    }, [purPrice, quantity, purAmtManual]);

    const handleClose = () => {
        setSelectedStock(null);
        setSearchKeyword("");
        setSearchResults([]);
        setPurPrice("");
        setQuantity("");
        setPurAmt("");
        setPurAmtManual(false);
        setFormErrors({});
        onClose();
    };

    const handleSearchKeywordChange = (keyword: string) => {
        setSearchKeyword(keyword);
        if (formErrors.stkCd) setFormErrors(prev => ({...prev, stkCd: undefined}));
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
            } catch (error) {
                console.error(error);
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
    };

    const handleSubmit = async () => {
        const errors: {stkCd?: string; purPrice?: string; quantity?: string; purAmt?: string} = {};
        if (!selectedStock) errors.stkCd = "종목을 선택해주세요.";
        if (!purPrice || Number(purPrice) <= 0) errors.purPrice = "매수단가를 입력해주세요.";
        if (!quantity || Number(quantity) <= 0) errors.quantity = "수량을 입력해주세요.";
        if (!purAmt || Number(purAmt) <= 0) errors.purAmt = "투자원금을 입력해주세요.";
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        try {
            await createManualHolding({
                brokerId,
                stkCd: selectedStock!.stkCd,
                stkNm: selectedStock!.stkNm,
                purPrice: Number(purPrice),
                quantity: Number(quantity),
                purAmt: Number(purAmt),
            });
            onCreated();
            handleClose();
        } catch (err) {
            console.error(err);
            const axiosErr = err as {response?: {status?: number; data?: {code?: string; result?: Record<string, string>}}};
            if (axiosErr.response?.status === 400 && axiosErr.response?.data?.code === 'VALIDATION_4001') {
                setFormErrors((axiosErr.response.data.result ?? {}) as typeof formErrors);
                return;
            }
            setFormErrors({purAmt: "매수 등록에 실패했습니다."});
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <DialogTitle>매수 등록</DialogTitle>
            <DialogContent>
                <Box sx={{mt: 1, display: 'flex', flexDirection: 'column', gap: 2}}>
                    <Autocomplete
                        size="small"
                        options={searchResults}
                        getOptionLabel={(option) => `${option.stkNm} (${option.stkCd})`}
                        filterOptions={(x) => x}
                        loading={searchLoading}
                        value={selectedStock}
                        inputValue={searchKeyword}
                        onInputChange={(_, value) => handleSearchKeywordChange(value)}
                        onChange={(_, value) => {
                            setSelectedStock(value);
                            if (formErrors.stkCd) setFormErrors(prev => ({...prev, stkCd: undefined}));
                        }}
                        noOptionsText={searchKeyword ? "검색 결과 없음" : "종목명을 입력하세요"}
                        forcePopupIcon={false}
                        slotProps={{
                            clearIndicator: {size: "small", sx: {padding: "1px", "& svg": {fontSize: "16px"}}},
                        }}
                        renderOption={(props, option) => (
                            <Box component="li" {...props} key={`${option.stkCd}-${option.marketName}`}>
                                <Stack direction="row" sx={{width: "100%", justifyContent: "space-between", alignItems: "center", gap: 1}}>
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
                                autoFocus required
                                label="종목 검색"
                                placeholder="종목명을 입력하세요"
                                error={!!formErrors.stkCd}
                                helperText={formErrors.stkCd}
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
                    <TextField
                        label="매수단가" required
                        size="small"
                        value={purPrice ? Number(purPrice).toLocaleString() : ''}
                        onChange={e => { setPurPrice(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '')); if (formErrors.purPrice) setFormErrors(prev => ({...prev, purPrice: undefined})); }}
                        error={!!formErrors.purPrice} helperText={formErrors.purPrice}
                        slotProps={{htmlInput: {inputMode: 'numeric'}}}
                    />
                    <TextField
                        label="수량" required
                        size="small"
                        value={quantity ? Number(quantity).toLocaleString() : ''}
                        onChange={e => { setQuantity(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '')); if (formErrors.quantity) setFormErrors(prev => ({...prev, quantity: undefined})); }}
                        error={!!formErrors.quantity} helperText={formErrors.quantity}
                        slotProps={{htmlInput: {inputMode: 'numeric'}}}
                    />
                    <TextField
                        label="투자원금" required
                        size="small"
                        value={purAmt ? Number(purAmt).toLocaleString() : ''}
                        onChange={e => {
                            setPurAmt(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, ''));
                            setPurAmtManual(true);
                            if (formErrors.purAmt) setFormErrors(prev => ({...prev, purAmt: undefined}));
                        }}
                        error={!!formErrors.purAmt}
                        helperText={formErrors.purAmt ?? "증권사 앱에 표시된 실제 투자원금을 직접 입력해주세요. 미입력 시 매수단가 × 수량으로 자동 계산됩니다."}
                        slotProps={{htmlInput: {inputMode: 'numeric'}}}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>취소</Button>
                <Button onClick={handleSubmit}>등록</Button>
            </DialogActions>
        </Dialog>
    );
}
