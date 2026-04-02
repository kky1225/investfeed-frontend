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
    const [error, setError] = useState("");
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
        setError("");
        onClose();
    };

    const handleSearchKeywordChange = (keyword: string) => {
        setSearchKeyword(keyword);
        setError("");
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

    const handleSubmit = async () => {
        if (!selectedStock) {
            setError("종목을 선택해주세요.");
            return;
        }
        if (!purPrice || Number(purPrice) <= 0) {
            setError("매수단가를 입력해주세요.");
            return;
        }
        if (!quantity || Number(quantity) <= 0) {
            setError("수량을 입력해주세요.");
            return;
        }
        if (!purAmt || Number(purAmt) <= 0) {
            setError("투자원금을 입력해주세요.");
            return;
        }
        try {
            await createManualHolding({
                brokerId,
                stkCd: selectedStock.stkCd,
                stkNm: selectedStock.stkNm,
                purPrice: Number(purPrice),
                quantity: Number(quantity),
                purAmt: Number(purAmt),
            });
            onCreated();
            handleClose();
        } catch {
            setError("매수 등록에 실패했습니다.");
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
                            setError("");
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
                                autoFocus
                                label="종목 검색"
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
                    <TextField
                        label="매수단가"
                        type="number"
                        size="small"
                        value={purPrice}
                        onChange={e => setPurPrice(e.target.value)}
                        slotProps={{htmlInput: {min: 0}}}
                    />
                    <TextField
                        label="수량"
                        type="number"
                        size="small"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        slotProps={{htmlInput: {min: 1}}}
                    />
                    <TextField
                        label="투자원금"
                        type="number"
                        size="small"
                        value={purAmt}
                        onChange={e => {
                            setPurAmt(e.target.value);
                            setPurAmtManual(true);
                        }}
                        helperText="증권사 앱에 표시된 실제 투자원금을 직접 입력해주세요. 미입력 시 매수단가 × 수량으로 자동 계산됩니다."
                        slotProps={{htmlInput: {min: 0}}}
                    />
                    {error && (
                        <Typography variant="caption" color="error">{error}</Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>취소</Button>
                <Button onClick={handleSubmit} disabled={!selectedStock || !purPrice || !quantity || !purAmt}>등록</Button>
            </DialogActions>
        </Dialog>
    );
}
