import {useEffect, useState} from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import type {GoalType, InvestmentGoalRes} from "../../type/GoalType.ts";
import {goalTypeLabel} from "../../type/GoalType.ts";
import {createGoal, updateGoal} from "../../api/goal/GoalApi.ts";

interface GoalSettingDialogProps {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    editGoal?: InvestmentGoalRes | null;
    existingTypes: GoalType[];
}

const goalTypes: GoalType[] = ['TOTAL_ASSET', 'MONTHLY_REALIZED_PNL', 'YEARLY_REALIZED_PNL'];

export default function GoalSettingDialog({open, onClose, onSaved, editGoal, existingTypes}: GoalSettingDialogProps) {
    const [type, setType] = useState<GoalType>('TOTAL_ASSET');
    const [targetAmount, setTargetAmount] = useState("");
    const [targetAmountError, setTargetAmountError] = useState("");

    useEffect(() => {
        if (editGoal) {
            setType(editGoal.type);
            setTargetAmount(String(editGoal.targetAmount));
        } else {
            const available = goalTypes.filter(t => !existingTypes.includes(t));
            if (available.length > 0) setType(available[0]);
            setTargetAmount("");
        }
        setTargetAmountError("");
    }, [open, editGoal]);

    const handleClose = () => {
        setTargetAmountError("");
        onClose();
    };

    const handleSubmit = async () => {
        if (!targetAmount || Number(targetAmount) <= 0) {
            setTargetAmountError("목표 금액을 입력해주세요.");
            return;
        }
        setTargetAmountError("");
        try {
            if (editGoal) {
                await updateGoal(editGoal.id, {targetAmount: Number(targetAmount)});
            } else {
                await createGoal({type, targetAmount: Number(targetAmount)});
            }
            onSaved();
            handleClose();
        } catch (err) {
            console.error(err);
            const axiosErr = err as {response?: {status?: number; data?: {code?: string; result?: Record<string, string>}}};
            if (axiosErr.response?.status === 400 && axiosErr.response?.data?.code === 'VALIDATION_4001') {
                const result = axiosErr.response.data.result ?? {};
                if (result.targetAmount) setTargetAmountError(result.targetAmount);
                return;
            }
            setTargetAmountError(editGoal ? "목표 수정에 실패했습니다." : "이미 해당 유형의 목표가 존재합니다.");
        }
    };

    const availableTypes = goalTypes.filter(t => !existingTypes.includes(t) || t === editGoal?.type);

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <DialogTitle>
                {editGoal ? "투자 목표 수정" : "투자 목표 설정"}
                <Tooltip title="매시 정각에 목표 달성 여부를 확인하여 알림이 발송됩니다." placement="right">
                    <HelpOutlineIcon sx={{fontSize: 16, ml: 1, verticalAlign: 'middle', color: 'text.secondary'}}/>
                </Tooltip>
            </DialogTitle>
            <DialogContent>
                <Box sx={{mt: 1, display: 'flex', flexDirection: 'column', gap: 2}}>
                    {editGoal ? (
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 0.5}}>목표 유형</Typography>
                            <Typography variant="body1">{goalTypeLabel[type]}</Typography>
                        </Box>
                    ) : (
                        <TextField
                            select required
                            label="목표 유형"
                            size="small"
                            value={type}
                            onChange={(e) => setType(e.target.value as GoalType)}
                        >
                            {availableTypes.map((t) => (
                                <MenuItem key={t} value={t}>{goalTypeLabel[t]}</MenuItem>
                            ))}
                        </TextField>
                    )}
                    <TextField
                        label="목표 금액 (원)" required
                        size="small"
                        value={targetAmount ? Number(targetAmount).toLocaleString() : ''}
                        onChange={(e) => { setTargetAmount(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '')); if (targetAmountError) setTargetAmountError(""); }}
                        error={!!targetAmountError} helperText={targetAmountError}
                        slotProps={{htmlInput: {inputMode: 'numeric'}}}
                        autoFocus
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>취소</Button>
                <Button onClick={handleSubmit}>{editGoal ? "수정" : "등록"}</Button>
            </DialogActions>
        </Dialog>
    );
}
