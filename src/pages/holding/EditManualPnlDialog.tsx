import {useEffect, useState} from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type {RealizedPnlItem} from "../../type/RealizedPnlType.ts";

interface EditManualPnlDialogProps {
    open: boolean;
    onClose: () => void;
    item: RealizedPnlItem | null;
    onUpdated: () => void;
    updateFn: (id: number, req: { realizedPnl: number }) => Promise<unknown>;
}

export default function EditManualPnlDialog({open, onClose, item, onUpdated, updateFn}: EditManualPnlDialogProps) {
    const [realizedPnl, setRealizedPnl] = useState("");
    const [isNegative, setIsNegative] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (item) {
            const val = item.realizedPnl;
            setIsNegative(val < 0);
            setRealizedPnl(String(Math.abs(val)));
        }
    }, [item]);

    const handleClose = () => {
        setRealizedPnl("");
        setIsNegative(false);
        setError("");
        onClose();
    };

    const handleSubmit = async () => {
        if (!item) return;
        if (!realizedPnl) {
            setError("실현손익을 입력해주세요.");
            return;
        }
        try {
            const pnlValue = Number(realizedPnl) * (isNegative ? -1 : 1);
            await updateFn(item.id, {realizedPnl: pnlValue});
            onUpdated();
            handleClose();
        } catch {
            setError("실현손익 수정에 실패했습니다.");
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <DialogTitle>실현손익 수정 - {item?.brokerName} ({item?.year}년 {item?.month}월)</DialogTitle>
            <DialogContent>
                <Box sx={{mt: 1, display: 'flex', flexDirection: 'column', gap: 2}}>
                    <Box sx={{display: 'flex', gap: 1, alignItems: 'center'}}>
                        <Button
                            variant={isNegative ? "outlined" : "contained"}
                            color="error"
                            size="small"
                            onClick={() => setIsNegative(false)}
                            sx={{minWidth: 50}}
                        >
                            이익
                        </Button>
                        <Button
                            variant={isNegative ? "contained" : "outlined"}
                            color="info"
                            size="small"
                            onClick={() => setIsNegative(true)}
                            sx={{minWidth: 50}}
                        >
                            손실
                        </Button>
                        <TextField
                            label="실현손익"
                            size="small"
                            value={realizedPnl ? Number(realizedPnl).toLocaleString() : ''}
                            onChange={(e) => setRealizedPnl(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, ''))}
                            slotProps={{htmlInput: {inputMode: 'numeric'}}}
                            autoFocus
                            sx={{flex: 1}}
                        />
                    </Box>
                    {error && (
                        <Typography variant="caption" color="error">{error}</Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>취소</Button>
                <Button onClick={handleSubmit} disabled={!realizedPnl}>저장</Button>
            </DialogActions>
        </Dialog>
    );
}
