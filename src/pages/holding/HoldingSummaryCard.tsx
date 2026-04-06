import {useState} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import EditIcon from "@mui/icons-material/Edit";

interface HoldingSummaryCardProps {
    totPurAmt: string;
    totEvltAmt: string;
    totEvltPl: string;
    totPrftRt: string;
    dailyPl?: string;
    balance?: string;
    editable?: boolean;
    onBalanceUpdate?: (balance: number) => void;
}

export default function HoldingSummaryCard({totPurAmt, totEvltAmt, totEvltPl, totPrftRt, dailyPl, balance, editable, onBalanceUpdate}: HoldingSummaryCardProps) {
    const profitColor = Number(totEvltPl) > 0 ? 'error.main' : Number(totEvltPl) < 0 ? 'info.main' : 'text.primary';
    const dailyPlColor = dailyPl ? (Number(dailyPl) > 0 ? 'error.main' : Number(dailyPl) < 0 ? 'info.main' : 'text.primary') : undefined;
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editValue, setEditValue] = useState("");

    const handleDialogOpen = () => {
        setEditValue(String(Number(balance ?? "0")));
        setDialogOpen(true);
    };

    const handleDialogConfirm = () => {
        const parsed = Number(editValue);
        if (!isNaN(parsed) && onBalanceUpdate) {
            onBalanceUpdate(parsed);
        }
        setDialogOpen(false);
    };

    const totalAsset = balance !== undefined ? Number(totEvltAmt) + Number(balance) : null;

    return (
        <>
            <Card variant="outlined" sx={{mb: 3}}>
                <CardContent>
                    {/* 상단: 평가금액 */}
                    <Typography variant="body2" sx={{color: 'text.secondary', mb: 0.5}}>
                        총 평가금액
                    </Typography>
                    <Typography variant="h4" sx={{fontWeight: 700, mb: 2}}>
                        {Number(totEvltAmt).toLocaleString()}원
                    </Typography>

                    <Divider sx={{mb: 2}}/>

                    {/* 중단: 원금 / 총 수익 / 일간 수익 */}
                    <Stack direction="row" spacing={4} divider={<Divider orientation="vertical" flexItem/>} sx={{mb: balance !== undefined ? 2 : 0}}>
                        <Box>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>투자 원금</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600}}>
                                {Number(totPurAmt).toLocaleString()}원
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>총 수익</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600, color: profitColor}}>
                                {Number(totEvltPl) > 0 ? '+' : ''}{Number(totEvltPl).toLocaleString()}원 ({Number(totPrftRt) > 0 ? '+' : ''}{totPrftRt}%)
                            </Typography>
                        </Box>
                        {dailyPl !== undefined && (
                            <Box>
                                <Typography variant="body2" sx={{color: 'text.secondary'}}>일간 수익</Typography>
                                <Typography variant="body1" sx={{fontWeight: 600, color: dailyPlColor}}>
                                    {Number(dailyPl) > 0 ? '+' : ''}{Number(dailyPl).toLocaleString()}원
                                </Typography>
                            </Box>
                        )}
                    </Stack>

                    {/* 하단: 예수금 / 총자산 */}
                    {balance !== undefined && (
                        <>
                            <Divider sx={{mb: 2}}/>
                            <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2}}>
                                <Box>
                                    <Typography variant="body2" sx={{color: 'text.secondary'}}>예수금</Typography>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                        <Typography variant="body1" sx={{fontWeight: 600}}>
                                            {Number(balance).toLocaleString()}원
                                        </Typography>
                                        {editable && (
                                            <EditIcon
                                                onClick={handleDialogOpen}
                                                sx={{fontSize: 16, color: 'text.secondary', cursor: 'pointer', '&:hover': {color: 'text.primary'}}}
                                            />
                                        )}
                                    </Box>
                                </Box>
                                {totalAsset !== null && (
                                    <Box>
                                        <Typography variant="body2" sx={{color: 'text.secondary'}}>총 자산</Typography>
                                        <Typography variant="body1" sx={{fontWeight: 600}}>
                                            {totalAsset.toLocaleString()}원
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* 예수금 수정 다이얼로그 */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>예수금 수정</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        type="number"
                        label="예수금"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleDialogConfirm();
                        }}
                        autoFocus
                        sx={{mt: 1}}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>취소</Button>
                    <Button variant="contained" onClick={handleDialogConfirm}>저장</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
