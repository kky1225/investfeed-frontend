import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import BlindText from "../../components/BlindText.tsx";

interface AssetSummaryCardProps {
    totalAsset: number;
    totalEvltAmt: number;
    totalPurAmt: number;
    totalEvltPl: number;
    totalPrftRt: string;
    totalCash: number;
}

export default function AssetSummaryCard({totalAsset, totalEvltAmt, totalPurAmt, totalEvltPl, totalPrftRt, totalCash}: AssetSummaryCardProps) {
    const profitColor = totalEvltPl > 0 ? 'error.main' : totalEvltPl < 0 ? 'info.main' : 'text.primary';

    return (
        <Card variant="outlined" sx={{mb: 3}}>
            <CardContent>
                <Typography variant="body2" sx={{color: 'text.secondary', mb: 0.5}}>
                    총 자산
                </Typography>
                <Typography variant="h4" sx={{fontWeight: 700, mb: 2}}>
                    <BlindText>{totalAsset.toLocaleString()}원</BlindText>
                </Typography>

                <Divider sx={{mb: 2}}/>

                <Stack direction="row" spacing={4} divider={<Divider orientation="vertical" flexItem/>} sx={{mb: 2}}>
                    <Box>
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>총 평가금액</Typography>
                        <Typography variant="body1" sx={{fontWeight: 600}}>
                            <BlindText>{totalEvltAmt.toLocaleString()}원</BlindText>
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>투자 원금</Typography>
                        <Typography variant="body1" sx={{fontWeight: 600}}>
                            <BlindText>{totalPurAmt.toLocaleString()}원</BlindText>
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>총 수익</Typography>
                        <Typography variant="body1" sx={{fontWeight: 600, color: profitColor}}>
                            <BlindText>{totalEvltPl > 0 ? '+' : ''}{totalEvltPl.toLocaleString()}원 ({Number(totalPrftRt) > 0 ? '+' : ''}{totalPrftRt}%)</BlindText>
                        </Typography>
                    </Box>
                </Stack>

                <Divider sx={{mb: 2}}/>

                <Box>
                    <Typography variant="body2" sx={{color: 'text.secondary'}}>현금 (예수금)</Typography>
                    <Typography variant="body1" sx={{fontWeight: 600}}>
                        <BlindText>{totalCash.toLocaleString()}원</BlindText>
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
}
