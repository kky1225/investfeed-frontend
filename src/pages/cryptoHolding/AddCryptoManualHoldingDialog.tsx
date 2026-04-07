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
import {fetchCryptoSearch} from "../../api/crypto/CryptoApi.ts";
import {createCryptoManualHolding} from "../../api/cryptoBroker/CryptoBrokerApi.ts";

interface CryptoSearchItem {
    market: string;
    koreanName: string;
    englishName: string;
}

interface AddCryptoManualHoldingDialogProps {
    open: boolean;
    onClose: () => void;
    brokerId: number;
    onCreated: () => void;
}

export default function AddCryptoManualHoldingDialog({open, onClose, brokerId, onCreated}: AddCryptoManualHoldingDialogProps) {
    const [selectedCrypto, setSelectedCrypto] = useState<CryptoSearchItem | null>(null);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [searchResults, setSearchResults] = useState<CryptoSearchItem[]>([]);
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
        setSelectedCrypto(null);
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
                const data = await fetchCryptoSearch(keyword.trim());
                setSearchResults(data.result ?? []);
            } catch {
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
    };

    const handleSubmit = async () => {
        if (!selectedCrypto) {
            setError("코인을 선택해주세요.");
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
            await createCryptoManualHolding({
                brokerId,
                stkCd: selectedCrypto.market,
                stkNm: selectedCrypto.koreanName,
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
                        getOptionLabel={(option) => `${option.koreanName} (${option.market})`}
                        filterOptions={(x) => x}
                        loading={searchLoading}
                        value={selectedCrypto}
                        inputValue={searchKeyword}
                        onInputChange={(_, value) => handleSearchKeywordChange(value)}
                        onChange={(_, value) => {
                            setSelectedCrypto(value);
                            setError("");
                        }}
                        noOptionsText={searchKeyword ? "검색 결과 없음" : "코인명을 입력하세요"}
                        forcePopupIcon={false}
                        slotProps={{
                            clearIndicator: {size: "small", sx: {padding: "1px", "& svg": {fontSize: "16px"}}},
                        }}
                        renderOption={(props, option) => (
                            <Box component="li" {...props} key={option.market}>
                                <Stack direction="row" sx={{width: "100%", justifyContent: "space-between", alignItems: "center", gap: 1}}>
                                    <Box>
                                        <Typography variant="body2">{option.koreanName}</Typography>
                                        <Typography variant="caption" color="text.secondary">{option.market}</Typography>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" sx={{flexShrink: 0}}>
                                        {option.englishName}
                                    </Typography>
                                </Stack>
                            </Box>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                autoFocus
                                label="코인 검색"
                                placeholder="코인명을 입력하세요"
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
                        size="small"
                        value={purPrice ? Number(purPrice).toLocaleString() : ''}
                        onChange={e => setPurPrice(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, ''))}
                        slotProps={{htmlInput: {inputMode: 'numeric'}}}
                    />
                    <TextField
                        label="수량"
                        type="number"
                        size="small"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        slotProps={{htmlInput: {min: 0, step: "any"}}}
                    />
                    <TextField
                        label="투자원금"
                        size="small"
                        value={purAmt ? Number(purAmt).toLocaleString() : ''}
                        onChange={e => {
                            setPurAmt(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, ''));
                            setPurAmtManual(true);
                        }}
                        helperText="거래소 앱에 표시된 실제 투자원금을 직접 입력해주세요. 미입력 시 매수단가 x 수량으로 자동 계산됩니다."
                        slotProps={{htmlInput: {inputMode: 'numeric'}}}
                    />
                    {error && (
                        <Typography variant="caption" color="error">{error}</Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>취소</Button>
                <Button onClick={handleSubmit} disabled={!selectedCrypto || !purPrice || !quantity || !purAmt}>등록</Button>
            </DialogActions>
        </Dialog>
    );
}
