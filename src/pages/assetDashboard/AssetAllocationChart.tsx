import {Fragment} from "react";
import {PieChart} from '@mui/x-charts/PieChart';
import {useDrawingArea} from '@mui/x-charts/hooks';
import {styled} from '@mui/material/styles';
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import LinearProgress, {linearProgressClasses} from "@mui/material/LinearProgress";
import {useMediaQuery, useTheme} from "@mui/material";
import {useBlindMode} from "../../context/BlindModeContext.tsx";

interface AssetAllocationChartProps {
    stockTotal: number;
    cryptoTotal: number;
    cashTotal: number;
    totalAsset: number;
    selectedGroup: 'stock' | 'crypto' | null;
    onGroupSelect: (group: 'stock' | 'crypto' | null) => void;
}

interface StyledTextProps {
    variant: 'primary' | 'secondary';
}

const StyledText = styled('text', {
    shouldForwardProp: (prop) => prop !== 'variant',
})<StyledTextProps>(({theme}) => ({
    textAnchor: 'middle',
    dominantBaseline: 'central',
    fill: (theme.vars || theme).palette.text.secondary,
    variants: [
        {props: {variant: 'primary'}, style: {fontSize: theme.typography.h5.fontSize, fontWeight: theme.typography.h5.fontWeight}},
        {props: ({variant}) => variant !== 'primary', style: {fontSize: theme.typography.body2.fontSize, fontWeight: theme.typography.body2.fontWeight}},
    ],
}));

function PieCenterLabel({primaryText, secondaryText, small}: { primaryText: string; secondaryText: string; small?: boolean }) {
    const {width, height, left, top} = useDrawingArea();
    const {isBlind} = useBlindMode();
    const gap = small ? 18 : 24;
    const primaryY = top + height / 2 - (small ? 8 : 10);
    const secondaryY = primaryY + gap;

    // primary(총 자산 금액) 는 블라인드 대상. BlindText 와 동일한 blur(8px) 적용 (SVG text 도 CSS filter 지원).
    const primaryStyle = {
        ...(small ? {fontSize: '0.85rem'} : {}),
        ...(isBlind ? {filter: 'blur(8px)'} : {}),
    };

    return (
        <Fragment>
            <StyledText variant="primary" x={left + width / 2} y={primaryY} style={primaryStyle}>
                {primaryText}
            </StyledText>
            <StyledText variant="secondary" x={left + width / 2} y={secondaryY} style={small ? {fontSize: '0.7rem'} : undefined}>
                {secondaryText}
            </StyledText>
        </Fragment>
    );
}

const colors = ['hsl(220, 80%, 65%)', 'hsl(35, 90%, 60%)', 'hsl(0, 0%, 70%)'];

export default function AssetAllocationChart({stockTotal, cryptoTotal, cashTotal, totalAsset, selectedGroup, onGroupSelect}: AssetAllocationChartProps) {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

    const chartSize = isSmallScreen ? 200 : 280;
    const innerRadius = isSmallScreen ? 50 : 75;
    const outerRadius = isSmallScreen ? 70 : 100;
    const chartMargin = isSmallScreen
        ? {left: 30, right: 30, top: 40, bottom: 40}
        : {left: 50, right: 80, top: 80, bottom: 80};

    const pieData = [
        {id: 'stock', label: '주식', value: stockTotal},
        {id: 'crypto', label: '코인', value: cryptoTotal},
        {id: 'cash', label: '현금', value: cashTotal},
    ].filter(d => d.value > 0);

    if (pieData.length === 0) {
        return (
            <Card variant="outlined" sx={{display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1, mb: 3}}>
                <CardContent>
                    <Typography component="h2" variant="subtitle2">
                        자산 배분
                    </Typography>
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4}}>
                        <Typography variant="body2" color="text.secondary">
                            등록된 자산이 없습니다.
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    }

    const progressData = [
        {name: '주식', value: totalAsset > 0 ? stockTotal / totalAsset * 100 : 0, color: colors[0], group: 'stock' as const},
        {name: '코인', value: totalAsset > 0 ? cryptoTotal / totalAsset * 100 : 0, color: colors[1], group: 'crypto' as const},
        {name: '현금', value: totalAsset > 0 ? cashTotal / totalAsset * 100 : 0, color: colors[2], group: null},
    ].filter(d => d.value > 0);

    const handleItemClick = (_: unknown, d: { dataIndex: number }) => {
        const item = pieData[d.dataIndex];
        if (!item) return;
        if (item.id === 'stock') onGroupSelect(selectedGroup === 'stock' ? null : 'stock');
        else if (item.id === 'crypto') onGroupSelect(selectedGroup === 'crypto' ? null : 'crypto');
        else onGroupSelect(null);
    };

    const pieColors = pieData.map(d => {
        if (d.id === 'stock') return colors[0];
        if (d.id === 'crypto') return colors[1];
        return colors[2];
    });

    return (
        <Card variant="outlined" sx={{display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1, mb: 3}}>
            <CardContent>
                <Typography component="h2" variant="subtitle2">
                    자산 배분
                </Typography>
                <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <PieChart
                        colors={pieColors}
                        margin={chartMargin}
                        series={[{
                            data: pieData,
                            innerRadius,
                            outerRadius,
                            paddingAngle: 2,
                            highlightScope: {fade: 'global', highlight: 'item'},
                        }]}
                        height={chartSize}
                        width={chartSize}
                        onItemClick={handleItemClick}
                        sx={{
                            // slice(개별 arc) 위에서만 pointer. 차트 margin(빈 여백) 에선 default 커서 유지.
                            '& .MuiPieArc-root': {cursor: 'pointer'},
                        }}
                    >
                        <PieCenterLabel primaryText={totalAsset.toLocaleString()} secondaryText="Total" small={isSmallScreen}/>
                    </PieChart>
                </Box>
                {progressData.map((item, index) => (
                    <Stack
                        key={index}
                        direction="row"
                        onClick={() => {
                            if (item.group) onGroupSelect(selectedGroup === item.group ? null : item.group);
                        }}
                        sx={{
                            alignItems: 'center', gap: 2, pb: 2,
                            cursor: item.group ? 'pointer' : 'default',
                            opacity: selectedGroup && selectedGroup !== item.group ? 0.5 : 1,
                            transition: 'opacity 0.2s',
                        }}
                    >
                        <Stack sx={{gap: 1, flexGrow: 1}}>
                            <Stack direction="row" sx={{justifyContent: 'space-between', alignItems: 'center', gap: 2}}>
                                <Typography variant="body2" sx={{fontWeight: '500'}}>
                                    {item.name}
                                </Typography>
                                <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                    {item.value.toFixed(1)}%
                                </Typography>
                            </Stack>
                            <LinearProgress
                                variant="determinate"
                                value={item.value}
                                sx={{[`& .${linearProgressClasses.bar}`]: {backgroundColor: item.color}}}
                            />
                        </Stack>
                    </Stack>
                ))}
            </CardContent>
        </Card>
    );
}
