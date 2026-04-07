import {useEffect, useState} from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {createPriceTarget, fetchPriceTargets, deletePriceTarget} from "../api/notification/NotificationApi.ts";
import type {AssetType, PriceTarget} from "../type/NotificationType.ts";

interface PriceTargetDialogProps {
    open: boolean;
    onClose: () => void;
    assetType: AssetType;
    assetCode: string;
    assetName: string;
    currentPrice: string;
}

export default function PriceTargetDialog({open, onClose, assetType, assetCode, assetName, currentPrice}: PriceTargetDialogProps) {
    const [targetPrice, setTargetPrice] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [targets, setTargets] = useState<PriceTarget[]>([]);

    useEffect(() => {
        if (!open) return;
        (async () => {
            try {
                const res = await fetchPriceTargets();
                const all: PriceTarget[] = res.result ?? [];
                setTargets(all.filter(t => t.assetCode === assetCode));
            } catch (e) {
                console.error(e);
            }
        })();
    }, [open, assetCode]);

    const handleClose = () => {
        setTargetPrice("");
        setError("");
        onClose();
    };

    const handleSubmit = async () => {
        const cur = Number(currentPrice.replace(/,/g, ''));
        const target = Number(targetPrice);

        if (!targetPrice || target <= 0) {
            setError("목표가를 입력해주세요.");
            return;
        }

        const direction = target >= cur ? 'ABOVE' as const : 'BELOW' as const;

        setLoading(true);
        try {
            const res = await createPriceTarget({
                assetType,
                assetCode,
                assetName,
                targetPrice: target,
                direction,
            });
            setTargets(prev => [res.result, ...prev]);
            setTargetPrice("");
            setError("");
        } catch {
            setError("목표가 알림 등록에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deletePriceTarget(id);
            setTargets(prev => prev.filter(t => t.id !== id));
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <DialogTitle>목표가 알림 설정</DialogTitle>
            <DialogContent>
                <Box sx={{mt: 1, display: 'flex', flexDirection: 'column', gap: 2}}>
                    <Typography variant="body1" fontWeight={600}>
                        {assetName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        현재가: {Number(currentPrice.replace(/,/g, '')).toLocaleString()}원
                    </Typography>
                    <TextField
                        autoFocus
                        label="목표가 (원)"
                        size="small"
                        value={targetPrice ? Number(targetPrice).toLocaleString() : ''}
                        onChange={e => {
                            const raw = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                            setTargetPrice(raw);
                            setError("");
                        }}
                        slotProps={{htmlInput: {inputMode: 'numeric'}}}
                        helperText={(() => {
                            const cur = Number(currentPrice.replace(/,/g, ''));
                            const target = Number(targetPrice);
                            if (!targetPrice || target <= 0 || cur <= 0) return ' ';
                            if (target === cur) return '현재가와 동일합니다';
                            const diff = ((target - cur) / cur) * 100;
                            const sign = diff > 0 ? '+' : '';
                            const clr = diff > 0 ? '#f44336' : '#2196f3';
                            return <span>현재가 대비 <span style={{color: clr}}>{sign}{diff.toFixed(2)}%</span> 도달 시 알림</span>;
                        })()}
                    />
                    {error && (
                        <Typography variant="caption" color="error">{error}</Typography>
                    )}

                    {targets.length > 0 && (
                        <>
                            <Divider/>
                            <Typography variant="subtitle2" color="text.secondary">
                                등록된 목표가 ({targets.length})
                            </Typography>
                            <List dense disablePadding sx={{mt: -1}}>
                                {targets.map(target => (
                                    <ListItem
                                        key={target.id}
                                        secondaryAction={
                                            <IconButton size="small" onClick={() => handleDelete(target.id)}>
                                                <DeleteOutlineIcon fontSize="small" color="error"/>
                                            </IconButton>
                                        }
                                        sx={{px: 0}}
                                    >
                                        <ListItemText
                                            primary={`${target.targetPrice.toLocaleString()}원 ${target.direction === 'ABOVE' ? '이상' : '이하'}`}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>닫기</Button>
                <Button onClick={handleSubmit} disabled={!targetPrice || loading}>등록</Button>
            </DialogActions>
        </Dialog>
    );
}
