import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import {Box, CardActionArea, Tooltip} from "@mui/material";
import {useNavigate} from "react-router-dom";
import Card from "@mui/material/Card";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import {renderChangeAmount} from "./CustomRender.tsx";
import {RecommendType, TodayDirection} from "../type/RecommendType.ts";

export interface RecommendCardProps {
    id: string,
    title: string,
    value: string,
    changeAmount: string,
    fluRt: string,
    trend: 'up' | 'down' | 'neutral',
    type?: RecommendType,
    todayDirection?: TodayDirection | null,
    isHolding?: boolean,
    streakDays?: number,
}

interface TypeStyle {
    label: string;
    chipColor: 'error' | 'info' | 'default';
    chipVariant: 'filled' | 'outlined';
    barColor: string;
    barWidth: number;
}

const typeStyleMap: Record<RecommendType, TypeStyle> = {
    STRONG_BUY:  { label: 'STRONG BUY',  chipColor: 'error',   chipVariant: 'filled',   barColor: '#b71c1c', barWidth: 5 },
    BUY:         { label: 'BUY',         chipColor: 'error',   chipVariant: 'outlined', barColor: '#e53935', barWidth: 3 },
    HOLD:        { label: 'HOLD',        chipColor: 'default', chipVariant: 'outlined', barColor: '#9e9e9e', barWidth: 3 },
    SELL:        { label: 'SELL',        chipColor: 'info',    chipVariant: 'outlined', barColor: '#1e88e5', barWidth: 3 },
    STRONG_SELL: { label: 'STRONG SELL', chipColor: 'info',    chipVariant: 'filled',   barColor: '#0d47a1', barWidth: 5 },
};

const todayTooltip = (direction: TodayDirection): string =>
    direction === 'MATCH'
        ? '당일 매매 동향이 리포트와 동일 추세'
        : '당일 매매 동향이 리포트와 다른 추세';

const RecommendCard = (
    { id, title, value, changeAmount, fluRt, trend, type, todayDirection, isHolding, streakDays }: RecommendCardProps,
) => {
    const navigate = useNavigate();

    const labelColors = {
        up: 'error' as const,
        down: 'info' as const,
        neutral: 'default' as const,
    };

    const color = labelColors[trend];
    const trendValues = { up: `${fluRt}%`, down: `${fluRt}%`, neutral: `${fluRt}%` };

    const onClick = (id: string) => {
        navigate(`/stock/detail/${id}`);
    }

    const style = type ? typeStyleMap[type] : undefined;
    const isBuySide = type === 'STRONG_BUY' || type === 'BUY';
    const isSellSide = type === 'STRONG_SELL' || type === 'SELL';
    const showStreak = !!streakDays && streakDays >= 2 && (isBuySide || isSellSide);
    const streakColor = isBuySide ? '#e53935' : '#1e88e5';
    const streakLabel = `${streakDays}일연속 ${isBuySide ? 'BUY' : 'SELL'} REPORT`;

    return (
        <CardActionArea
            onClick={() => onClick(id)}
            sx={{
                height: '100%',
                '&[data-active]': {
                    backgroundColor: 'action.selected',
                    '&:hover': {
                        backgroundColor: 'action.selectedHover',
                    },
                },
            }}
        >
            <Card
                variant="outlined"
                sx={{
                    width: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    borderLeft: style ? `${style.barWidth}px solid ${style.barColor}` : undefined,
                }}
            >
                <CardContent>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                {title}
                            </Typography>
                            {todayDirection && (
                                <Tooltip title={todayTooltip(todayDirection)} arrow>
                                    {todayDirection === 'MATCH' ? (
                                        <CheckCircleOutlineIcon
                                            fontSize="small"
                                            sx={{ color: 'success.main', mb: 0.5 }}
                                        />
                                    ) : (
                                        <ErrorOutlineIcon
                                            fontSize="small"
                                            sx={{ color: 'warning.main', mb: 0.5 }}
                                        />
                                    )}
                                </Tooltip>
                            )}
                        </Stack>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            {isHolding && (
                                <Chip
                                    size="small"
                                    label="보유중"
                                    variant="outlined"
                                    sx={{ borderColor: 'success.main', color: 'success.main' }}
                                />
                            )}
                            {style && (
                                <Chip
                                    size="small"
                                    label={style.label}
                                    color={style.chipColor}
                                    variant={style.chipVariant}
                                    sx={{ fontWeight: style.chipVariant === 'filled' ? 700 : 500 }}
                                />
                            )}
                        </Stack>
                    </Stack>
                    <Box sx={{ mt: 1 }}>
                        <Stack
                            direction="row"
                            sx={{
                                alignContent: { xs: 'center', sm: 'flex-start' },
                                alignItems: 'center',
                                gap: 1,
                            }}
                        >
                            <Typography variant="h4" component="p">
                                {value}
                            </Typography>
                            {renderChangeAmount(changeAmount)}
                            <Chip size="small" color={color} label={trendValues[trend]} />
                            {showStreak && (
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    label={streakLabel}
                                    sx={{ borderColor: streakColor, color: streakColor }}
                                />
                            )}
                        </Stack>
                    </Box>
                </CardContent>
            </Card>
        </CardActionArea>
    )
}

export default RecommendCard;
