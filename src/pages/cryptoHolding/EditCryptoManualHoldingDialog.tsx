import {useMemo, useState} from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import {updateCryptoManualHolding} from "../../api/cryptoBroker/CryptoBrokerApi.ts";
import type {ManualHolding} from "../../type/BrokerType.ts";

interface EditCryptoManualHoldingDialogProps {
    open: boolean;
    onClose: () => void;
    holding: ManualHolding | null;
    onUpdated: () => void;
}

export default function EditCryptoManualHoldingDialog({open, onClose, holding, onUpdated}: EditCryptoManualHoldingDialogProps) {
    const [purPrice, setPurPrice] = useState("");
    const [quantity, setQuantity] = useState("");
    // purAmtOverride: null = 자동 계산, string = 사용자 직접 입력 (또는 holding 초기값)
    const [purAmtOverride, setPurAmtOverride] = useState<string | null>(null);
    const [formErrors, setFormErrors] = useState<{purPrice?: string; quantity?: string; purAmt?: string}>({});

    // open + holding 변경 시 form 초기화 — open 을 키에 포함해 같은 holding 으로 다시 열 때도 리셋
    const resetKey = `${open}|${holding?.id ?? 'none'}`;
    const [prevResetKey, setPrevResetKey] = useState('');
    if (resetKey !== prevResetKey) {
        setPrevResetKey(resetKey);
        if (open && holding) {
            setPurPrice(String(holding.purPrice));
            setQuantity(String(holding.quantity));
            setPurAmtOverride(String(holding.purAmt));
        }
    }

    // purAmt = override 가 있으면 그 값, 없으면 자동 계산
    const purAmt = useMemo<string>(() => {
        if (purAmtOverride !== null) return purAmtOverride;
        if (purPrice && quantity) return String(Number(purPrice) * Number(quantity));
        return "";
    }, [purAmtOverride, purPrice, quantity]);

    const handleClose = () => {
        setFormErrors({});
        onClose();
    };

    const handleSubmit = async () => {
        if (!holding) return;
        const errors: {purPrice?: string; quantity?: string; purAmt?: string} = {};
        if (!purPrice || Number(purPrice) <= 0) errors.purPrice = "매수단가를 입력해주세요.";
        if (!quantity || Number(quantity) <= 0) errors.quantity = "수량을 입력해주세요.";
        if (!purAmt || Number(purAmt) <= 0) errors.purAmt = "투자원금을 입력해주세요.";
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        try {
            const res = await updateCryptoManualHolding(holding.id, {
                purPrice: Number(purPrice),
                quantity: Number(quantity),
                purAmt: Number(purAmt),
            });
            if (res.code !== "0000") throw new Error(res.message || `수동 보유코인 수정 실패 (${res.code})`);
            onUpdated();
            handleClose();
        } catch (err) {
            console.error(err);
            const axiosErr = err as {response?: {status?: number; data?: {code?: string; result?: Record<string, string>}}};
            if (axiosErr.response?.status === 400 && axiosErr.response?.data?.code === 'VALIDATION_4001') {
                setFormErrors((axiosErr.response.data.result ?? {}) as typeof formErrors);
                return;
            }
            setFormErrors({purAmt: "수정에 실패했습니다."});
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <DialogTitle>보유코인 수정</DialogTitle>
            <DialogContent>
                <Box sx={{mt: 1, display: 'flex', flexDirection: 'column', gap: 2}}>
                    <Typography variant="body1" fontWeight={600}>
                        {holding?.stkNm}
                    </Typography>
                    <TextField
                        autoFocus required
                        label="매수단가"
                        size="small"
                        value={purPrice ? Number(purPrice).toLocaleString() : ''}
                        onChange={e => {
                            setPurPrice(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, ''));
                            setPurAmtOverride(null);
                            if (formErrors.purPrice) setFormErrors(prev => ({...prev, purPrice: undefined}));
                        }}
                        error={!!formErrors.purPrice} helperText={formErrors.purPrice}
                        slotProps={{htmlInput: {inputMode: 'numeric'}}}
                    />
                    <TextField
                        label="수량" required
                        type="number"
                        size="small"
                        value={quantity}
                        onChange={e => {
                            setQuantity(e.target.value);
                            setPurAmtOverride(null);
                            if (formErrors.quantity) setFormErrors(prev => ({...prev, quantity: undefined}));
                        }}
                        error={!!formErrors.quantity} helperText={formErrors.quantity}
                        slotProps={{htmlInput: {min: 0, step: "any"}}}
                    />
                    <TextField
                        label="투자원금" required
                        size="small"
                        value={purAmt ? Number(purAmt).toLocaleString() : ''}
                        onChange={e => {
                            const val = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                            setPurAmtOverride(val === '' ? null : val);
                            if (formErrors.purAmt) setFormErrors(prev => ({...prev, purAmt: undefined}));
                        }}
                        error={!!formErrors.purAmt}
                        helperText={formErrors.purAmt ?? "거래소 앱에 표시된 실제 투자원금을 직접 입력해주세요."}
                        slotProps={{htmlInput: {inputMode: 'numeric'}}}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>취소</Button>
                <Button onClick={handleSubmit}>저장</Button>
            </DialogActions>
        </Dialog>
    );
}
