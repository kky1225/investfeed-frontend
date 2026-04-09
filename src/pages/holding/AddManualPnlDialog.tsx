import {useState} from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";
import type {MemberBroker} from "../../type/BrokerType.ts";

interface AddManualPnlDialogProps {
    open: boolean;
    onClose: () => void;
    brokers: MemberBroker[];
    onCreated: () => void;
    createFn: (req: { brokerId: number; year: number; month: number; realizedPnl: number }) => Promise<unknown>;
}

export default function AddManualPnlDialog({open, onClose, brokers, onCreated, createFn}: AddManualPnlDialogProps) {
    const currentDate = new Date();
    const [brokerId, setBrokerId] = useState<number>(0);
    const [year, setYear] = useState(currentDate.getFullYear());
    const [month, setMonth] = useState(currentDate.getMonth() + 1);
    const [realizedPnl, setRealizedPnl] = useState("");
    const [isNegative, setIsNegative] = useState(false);
    const [error, setError] = useState("");

    const handleClose = () => {
        setBrokerId(0);
        setYear(currentDate.getFullYear());
        setMonth(currentDate.getMonth() + 1);
        setRealizedPnl("");
        setIsNegative(false);
        setError("");
        onClose();
    };

    const handleSubmit = async () => {
        if (!brokerId) {
            setError("증권사/거래소를 선택해주세요.");
            return;
        }
        if (!realizedPnl) {
            setError("실현손익을 입력해주세요.");
            return;
        }
        try {
            const pnlValue = Number(realizedPnl) * (isNegative ? -1 : 1);
            await createFn({brokerId, year, month, realizedPnl: pnlValue});
            onCreated();
            handleClose();
        } catch {
            setError("실현손익 등록에 실패했습니다.");
        }
    };

    const years = Array.from({length: 10}, (_, i) => currentDate.getFullYear() - i);
    const months = Array.from({length: 12}, (_, i) => i + 1);

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <DialogTitle>실현손익 등록</DialogTitle>
            <DialogContent>
                <Box sx={{mt: 1, display: 'flex', flexDirection: 'column', gap: 2}}>
                    <TextField
                        select
                        label="증권사/거래소"
                        size="small"
                        value={brokerId || ""}
                        onChange={(e) => setBrokerId(Number(e.target.value))}
                    >
                        {brokers.map((b) => (
                            <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                        ))}
                    </TextField>
                    <Box sx={{display: 'flex', gap: 1}}>
                        <TextField
                            select
                            label="연도"
                            size="small"
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            sx={{flex: 1}}
                        >
                            {years.map((y) => (
                                <MenuItem key={y} value={y}>{y}년</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label="월"
                            size="small"
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            sx={{flex: 1}}
                        >
                            {months.map((m) => (
                                <MenuItem key={m} value={m}>{m}월</MenuItem>
                            ))}
                        </TextField>
                    </Box>
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
                <Button onClick={handleSubmit} disabled={!brokerId || !realizedPnl}>등록</Button>
            </DialogActions>
        </Dialog>
    );
}
