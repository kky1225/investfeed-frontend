import {useState} from "react";
import {useMutation} from "@tanstack/react-query";
import {requireOk} from "../../lib/apiResponse.ts";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import type {MemberBroker} from "../../type/BrokerType.ts";
import type {ApiResponse} from "../../type/AuthType.ts";
import type {ManualRealizedPnlCreateReq} from "../../type/RealizedPnlType.ts";

interface AddManualPnlDialogProps {
    open: boolean;
    onClose: () => void;
    brokers: MemberBroker[];
    onCreated: () => void;
    createFn: (req: { brokerId: number; year: number; month: number; realizedPnl: number }) => Promise<ApiResponse<unknown>>;
}

export default function AddManualPnlDialog({open, onClose, brokers, onCreated, createFn}: AddManualPnlDialogProps) {
    const currentDate = new Date();
    const [brokerId, setBrokerId] = useState<number>(0);
    const [year, setYear] = useState(currentDate.getFullYear());
    const [month, setMonth] = useState(currentDate.getMonth() + 1);
    const [realizedPnl, setRealizedPnl] = useState("");
    const [isNegative, setIsNegative] = useState(false);
    const [formErrors, setFormErrors] = useState<{brokerId?: string; realizedPnl?: string}>({});

    const handleClose = () => {
        setBrokerId(0);
        setYear(currentDate.getFullYear());
        setMonth(currentDate.getMonth() + 1);
        setRealizedPnl("");
        setIsNegative(false);
        setFormErrors({});
        onClose();
    };

    const createMutation = useMutation({
        mutationFn: async (req: ManualRealizedPnlCreateReq) =>
            requireOk(await createFn(req), '실현손익 등록'),
        onSuccess: () => {
            onCreated();
            handleClose();
        },
        onError: (err) => {
            console.error(err);
            const axiosErr = err as {response?: {status?: number; data?: {code?: string; result?: Record<string, string>}}};
            if (axiosErr.response?.status === 400 && axiosErr.response?.data?.code === 'VALIDATION_4001') {
                setFormErrors((axiosErr.response.data.result ?? {}) as typeof formErrors);
                return;
            }
            setFormErrors({realizedPnl: "실현손익 등록에 실패했습니다."});
        },
    });

    const handleSubmit = () => {
        const errors: {brokerId?: string; realizedPnl?: string} = {};
        if (!brokerId) errors.brokerId = "증권사/거래소를 선택해주세요.";
        if (!realizedPnl) errors.realizedPnl = "실현손익을 입력해주세요.";
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        const pnlValue = Number(realizedPnl) * (isNegative ? -1 : 1);
        const req: ManualRealizedPnlCreateReq = {brokerId, year, month, realizedPnl: pnlValue};
        createMutation.mutate(req);
    };

    const years = Array.from({length: 10}, (_, i) => currentDate.getFullYear() - i);
    const months = Array.from({length: 12}, (_, i) => i + 1);

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <DialogTitle>실현손익 등록</DialogTitle>
            <DialogContent>
                <Box sx={{mt: 1, display: 'flex', flexDirection: 'column', gap: 2}}>
                    <TextField
                        select required
                        label="증권사/거래소"
                        size="small"
                        value={brokerId || ""}
                        onChange={(e) => { setBrokerId(Number(e.target.value)); if (formErrors.brokerId) setFormErrors(prev => ({...prev, brokerId: undefined})); }}
                        error={!!formErrors.brokerId} helperText={formErrors.brokerId}
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
                            label="실현손익" required
                            size="small"
                            value={realizedPnl ? Number(realizedPnl).toLocaleString() : ''}
                            onChange={(e) => { setRealizedPnl(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '')); if (formErrors.realizedPnl) setFormErrors(prev => ({...prev, realizedPnl: undefined})); }}
                            error={!!formErrors.realizedPnl} helperText={formErrors.realizedPnl}
                            slotProps={{htmlInput: {inputMode: 'numeric'}}}
                            sx={{flex: 1}}
                        />
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>취소</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>등록</Button>
            </DialogActions>
        </Dialog>
    );
}
