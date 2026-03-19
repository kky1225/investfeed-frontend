import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import {LineChart} from "@mui/x-charts";
import {FearGreedItem} from "../type/CryptoType.ts";

interface FearGreedGaugeProps {
    current: FearGreedItem;
    history: FearGreedItem[];
}

const FearGreedGauge = ({current, history}: FearGreedGaugeProps) => {

    const getColor = (value: number) => {
        if (value <= 25) return '#ea3943';       // Extreme Fear - 빨강
        if (value <= 45) return '#ea8c00';       // Fear - 주황
        if (value <= 55) return '#f5d100';       // Neutral - 노랑
        if (value <= 75) return '#16c784';       // Greed - 연두
        return '#16c784';                         // Extreme Greed - 초록
    };

    const getLabel = (classification: string) => {
        switch (classification) {
            case 'Extreme Fear': return '극도의 공포';
            case 'Fear': return '공포';
            case 'Neutral': return '중립';
            case 'Greed': return '탐욕';
            case 'Extreme Greed': return '극도의 탐욕';
            default: return classification;
        }
    };

    const color = getColor(current.value);

    // 게이지 SVG 파라미터
    const size = 180;
    const strokeWidth = 16;
    const radius = (size - strokeWidth) / 2;
    const circumference = Math.PI * radius; // 반원
    const progress = (current.value / 100) * circumference;

    // 30일 추이 차트 데이터 (역순: 오래된 순)
    const chartHistory = [...history].reverse();
    const chartData = chartHistory.map(item => item.value);
    const chartDates = chartHistory.map(item => item.date);

    return (
        <Card variant="outlined" sx={{width: '100%', height: '100%'}}>
            <CardContent>
                <Typography component="h2" variant="subtitle2" gutterBottom>
                    공포 & 탐욕 지수
                </Typography>
                <Stack
                    direction="row"
                    sx={{
                        justifyContent: 'center',
                        alignItems: 'center',
                        mt: 1,
                    }}
                >
                    {/* 게이지 */}
                    <Box sx={{position: 'relative', width: size, height: size / 2 + 30}}>
                        <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
                            {/* 배경 아크 */}
                            <path
                                d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
                                fill="none"
                                stroke="#e0e0e0"
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                            />
                            {/* 진행 아크 */}
                            <path
                                d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
                                fill="none"
                                stroke={color}
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                strokeDasharray={`${progress} ${circumference}`}
                            />
                        </svg>
                        {/* 중앙 값 */}
                        <Box
                            sx={{
                                position: 'absolute',
                                top: '55%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center',
                            }}
                        >
                            <Typography variant="h3" fontWeight={700} sx={{color: color, lineHeight: 1}}>
                                {current.value}
                            </Typography>
                            <Typography variant="body2" sx={{color: color, fontWeight: 600, mt: 0.5}}>
                                {getLabel(current.classification)}
                            </Typography>
                        </Box>
                    </Box>
                </Stack>

                {/* 30일 추이 라인차트 */}
                <Typography variant="caption" sx={{color: 'text.secondary', mt: 1, display: 'block'}}>
                    최근 30일 추이
                </Typography>
                <LineChart
                    xAxis={[
                        {
                            scaleType: 'point',
                            data: chartDates,
                            tickLabelStyle: {display: 'none'},
                            tickInterval: (i: number) => i % 7 === 0,
                        },
                    ]}
                    yAxis={[
                        {
                            min: 0,
                            max: 100,
                            width: 30,
                        },
                    ]}
                    series={[
                        {
                            data: chartData,
                            showMark: false,
                            curve: 'linear',
                            area: true,
                            color: color,
                        },
                    ]}
                    margin={{left: 10, right: 10, top: 10, bottom: 10}}
                    grid={{horizontal: true}}
                    sx={{
                        height: {
                            xs: 120,
                            sm: 120,
                            md: 150,
                        },
                    }}
                />
            </CardContent>
        </Card>
    );
};

export default FearGreedGauge;
