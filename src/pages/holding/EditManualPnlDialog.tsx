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
import type {RealizedPnlItem, UpdateManualPnlMutationVars} from "../../type/RealizedPnlType.ts";
import type {ApiResponse} from "../../type/AuthType.ts";

interface EditManualPnlDialogProps {
    open: boolean;
    onClose: () => void;
    item: RealizedPnlItem | null;
    onUpdated: () => void;
    updateFn: (id: number, req: { realizedPnl: number }) => Promise<ApiResponse<unknown>>;
}

export default function EditManualPnlDialog({open, onClose, item, onUpdated, updateFn}: EditManualPnlDialogProps) {
    const [realizedPnl, setRealizedPnl] = useState("");
    const [isNegative, setIsNegative] = useState(false);
    const [formErrors, setFormErrors] = useState<{realizedPnl?: string}>({});

    // open + item 변경 시 form 초기화 — open 을 키에 포함해 같은 item 으로 다시 열 때도 리셋
    const resetKey = `${open}|${item?.id ?? 'none'}`;
    const [prevResetKey, setPrevResetKey] = useState('');
    if (resetKey !== prevResetKey) {
        setPrevResetKey(resetKey);
        if (open && item) {
            const val = item.realizedPnl;
            setIsNegative(val < 0);
            setRealizedPnl(String(Math.abs(val)));
        }
    }

    const handleClose = () => {
        setRealizedPnl("");
        setIsNegative(false);
        setFormErrors({});
        onClose();
    };

    const updateMutation = useMutation({
        mutationFn: async (vars: UpdateManualPnlMutationVars) =>
            requireOk(await updateFn(vars.id, vars.req), '실현손익 수정'),
        onSuccess: () => {
            onUpdated();
            handleClose();
        },
        onError: (err) => {
            console.error(err);
            const axiosErr = err as {response?: {status?: number; data?: {code?: string; result?: Record<string, string>}}};
            if (axiosErr.response?.status === 400 && axiosErr.response?.data?.code === 'VALIDATION_4001') {
                setFormErrors((axiosErr.response.data.result ?? {}) as typeof formErrors);
                return;
            }
            setFormErrors({realizedPnl: "실현손익 수정에 실패했습니다."});
        },
    });

    const handleSubmit = () => {
        if (!item) return;
        const errors: {realizedPnl?: string} = {};
        if (!realizedPnl) errors.realizedPnl = "실현손익을 입력해주세요.";
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        const pnlValue = Number(realizedPnl) * (isNegative ? -1 : 1);
        const vars: UpdateManualPnlMutationVars = {id: item.id, req: {realizedPnl: pnlValue}};
        updateMutation.mutate(vars);
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
                            label="실현손익" required
                            size="small"
                            value={realizedPnl ? Number(realizedPnl).toLocaleString() : ''}
                            onChange={(e) => { setRealizedPnl(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '')); if (formErrors.realizedPnl) setFormErrors(prev => ({...prev, realizedPnl: undefined})); }}
                            error={!!formErrors.realizedPnl} helperText={formErrors.realizedPnl}
                            slotProps={{htmlInput: {inputMode: 'numeric'}}}
                            autoFocus
                            sx={{flex: 1}}
                        />
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>취소</Button>
                <Button onClick={handleSubmit} disabled={updateMutation.isPending}>저장</Button>
            </DialogActions>
        </Dialog>
    );
}
