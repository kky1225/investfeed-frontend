import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";

interface HoldingSummaryCardProps {
    totPurAmt: string;
    totEvltAmt: string;
    totEvltPl: string;
    totPrftRt: string;
    dailyPl?: string;
}

export default function HoldingSummaryCard({totPurAmt, totEvltAmt, totEvltPl, totPrftRt, dailyPl}: HoldingSummaryCardProps) {
    const profitColor = Number(totEvltPl) > 0 ? 'error.main' : Number(totEvltPl) < 0 ? 'info.main' : 'text.primary';
    const dailyPlColor = dailyPl ? (Number(dailyPl) > 0 ? 'error.main' : Number(dailyPl) < 0 ? 'info.main' : 'text.primary') : undefined;

    return (
        <Card variant="outlined" sx={{mb: 3}}>
            <CardContent>
                <Typography variant="body2" sx={{color: 'text.secondary', mb: 0.5}}>
                    총 평가금액
                </Typography>
                <Typography variant="h4" sx={{fontWeight: 700, mb: 2}}>
                    {Number(totEvltAmt).toLocaleString()}원
                </Typography>

                <Stack direction="row" spacing={4} divider={<Divider orientation="vertical" flexItem/>}>
                    <Box>
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>투자 원금</Typography>
                        <Typography variant="body1" sx={{fontWeight: 600}}>
                            {Number(totPurAmt).toLocaleString()}원
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>총 수익</Typography>
                        <Typography variant="body1" sx={{fontWeight: 600, color: profitColor}}>
                            {Number(totEvltPl) > 0 ? '+' : ''}{Number(totEvltPl).toLocaleString()}원
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>수익률</Typography>
                        <Typography variant="body1" sx={{fontWeight: 600, color: profitColor}}>
                            {Number(totPrftRt) > 0 ? '+' : ''}{totPrftRt}%
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
            </CardContent>
        </Card>
    );
}
