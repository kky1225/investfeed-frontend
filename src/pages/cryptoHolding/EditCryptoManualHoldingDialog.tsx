import {useEffect, useState} from "react";
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
    const [purAmt, setPurAmt] = useState("");
    const [purAmtManual, setPurAmtManual] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (holding) {
            setPurPrice(String(holding.purPrice));
            setQuantity(String(holding.quantity));
            setPurAmt(String(holding.purAmt));
            setPurAmtManual(false);
        }
    }, [holding]);

    useEffect(() => {
        if (!purAmtManual && purPrice && quantity) {
            setPurAmt(String(Number(purPrice) * Number(quantity)));
        }
    }, [purPrice, quantity, purAmtManual]);

    const handleClose = () => {
        setError("");
        setPurAmtManual(false);
        onClose();
    };

    const handleSubmit = async () => {
        if (!holding) return;
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
            await updateCryptoManualHolding(holding.id, {
                purPrice: Number(purPrice),
                quantity: Number(quantity),
                purAmt: Number(purAmt),
            });
            onUpdated();
            handleClose();
        } catch {
            setError("수정에 실패했습니다.");
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
                        autoFocus
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
                        helperText="거래소 앱에 표시된 실제 투자원금을 직접 입력해주세요."
                        slotProps={{htmlInput: {inputMode: 'numeric'}}}
                    />
                    {error && (
                        <Typography variant="caption" color="error">{error}</Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>취소</Button>
                <Button onClick={handleSubmit} disabled={!purPrice || !quantity || !purAmt}>저장</Button>
            </DialogActions>
        </Dialog>
    );
}
