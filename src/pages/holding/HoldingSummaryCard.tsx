import {useState} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import BlindText from "../../components/BlindText.tsx";
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
import Skeleton from "@mui/material/Skeleton";
import EditIcon from "@mui/icons-material/Edit";

interface HoldingSummaryCardProps {
    totPurAmt: string;
    totEvltAmt: string;
    totEvltPl: string;
    totPrftRt: string;
    dailyPl?: string;
    balance?: string;
    balanceLabel?: string;
    balanceUsd?: string | null;
    balanceUsdLabel?: string;
    balanceUsdKrw?: string | null;
    editable?: boolean;
    loading?: boolean;
    onBalanceUpdate?: (balance: number) => void;
}

export default function HoldingSummaryCard({totPurAmt, totEvltAmt, totEvltPl, totPrftRt, dailyPl, balance, balanceLabel = '예수금', balanceUsd, balanceUsdLabel = '외화', balanceUsdKrw, editable, loading, onBalanceUpdate}: HoldingSummaryCardProps) {
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

    // 총자산 = 주식 평가금액(미국분 원화 환산 포함) + 원화 현금 + 달러 현금(원화 환산).
    // 주식만 환산해 더하고 현금을 빼면 총자산이 실제보다 작아진다.
    const totalAsset = balance !== undefined
        ? Number(totEvltAmt) + Number(balance) + Number(balanceUsdKrw ?? 0)
        : null;

    return (
        <>
            <Card variant="outlined" sx={{mb: 3}}>
                <CardContent>
                    {/* 상단: 평가금액 */}
                    <Typography variant="body2" sx={{color: 'text.secondary', mb: 0.5}}>
                        총 평가금액
                    </Typography>
                    <Typography variant="h4" sx={{fontWeight: 700, mb: 2}}>
                        {loading ? <Skeleton width="40%"/> : <BlindText>{Number(totEvltAmt).toLocaleString()}원</BlindText>}
                    </Typography>

                    <Divider sx={{mb: 2}}/>

                    {/* 중단: 원금 / 총 수익 / 일간 수익 */}
                    <Stack direction="row" spacing={4} divider={<Divider orientation="vertical" flexItem/>} sx={{mb: balance !== undefined ? 2 : 0}}>
                        <Box>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>투자 원금</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600}}>
                                {loading ? <Skeleton width={120}/> : <BlindText>{Number(totPurAmt).toLocaleString()}원</BlindText>}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>총 수익</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600, color: loading ? undefined : profitColor}}>
                                {loading ? <Skeleton width={180}/> : <BlindText>{Number(totEvltPl) > 0 ? '+' : ''}{Number(totEvltPl).toLocaleString()}원 ({Number(totPrftRt) > 0 ? '+' : ''}{totPrftRt}%)</BlindText>}
                            </Typography>
                        </Box>
                        {dailyPl !== undefined && (
                            <Box>
                                <Typography variant="body2" sx={{color: 'text.secondary'}}>일간 수익</Typography>
                                <Typography variant="body1" sx={{fontWeight: 600, color: loading ? undefined : dailyPlColor}}>
                                    {loading ? <Skeleton width={140}/> : <BlindText>{Number(dailyPl) > 0 ? '+' : ''}{Number(dailyPl).toLocaleString()}원</BlindText>}
                                </Typography>
                            </Box>
                        )}
                    </Stack>

                    {/* 하단: 예수금 / 총자산 */}
                    {balance !== undefined && (
                        <>
                            <Divider sx={{mb: 2}}/>
                            {/* 중단(투자 원금 | 총 수익 | 일간 수익)과 같은 세로 구분선 배치.
                                원화·달러는 통화가 달라 한 칸에 섞지 않고 각각의 칸으로 나눈다. */}
                            <Stack direction="row" spacing={4} divider={<Divider orientation="vertical" flexItem/>}>
                                <Box>
                                    <Typography variant="body2" sx={{color: 'text.secondary'}}>{balanceLabel}</Typography>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                        <Typography variant="body1" sx={{fontWeight: 600}}>
                                            {loading ? <Skeleton width={120}/> : <BlindText>{Number(balance).toLocaleString()}원</BlindText>}
                                        </Typography>
                                        {!loading && editable && (
                                            <EditIcon
                                                onClick={handleDialogOpen}
                                                sx={{fontSize: 16, color: 'text.secondary', cursor: 'pointer', '&:hover': {color: 'text.primary'}}}
                                            />
                                        )}
                                    </Box>
                                </Box>
                                {/* 달러 현금. 자산 합계에는 포함하지 않는다. */}
                                {balanceUsd != null && (
                                    <Box>
                                        <Typography variant="body2" sx={{color: 'text.secondary'}}>{balanceUsdLabel}</Typography>
                                        <Typography variant="body1" sx={{fontWeight: 600}}>
                                            {loading ? <Skeleton width={100}/> : (
                                                <BlindText>
                                                    {`$${Number(balanceUsd).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                                                </BlindText>
                                            )}
                                        </Typography>
                                    </Box>
                                )}
                                {totalAsset !== null && (
                                    <Box>
                                        <Typography variant="body2" sx={{color: 'text.secondary'}}>총 자산</Typography>
                                        <Typography variant="body1" sx={{fontWeight: 600}}>
                                            {loading ? <Skeleton width={140}/> : <BlindText>{totalAsset.toLocaleString()}원</BlindText>}
                                        </Typography>
                                    </Box>
                                )}
                            </Stack>
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
                        label="예수금"
                        value={editValue ? Number(editValue).toLocaleString() : ''}
                        onChange={(e) => setEditValue(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, ''))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleDialogConfirm();
                        }}
                        autoFocus
                        sx={{mt: 1}}
                        slotProps={{htmlInput: {inputMode: 'numeric'}}}
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
