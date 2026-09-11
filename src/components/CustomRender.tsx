import Chip from "@mui/material/Chip";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import RemoveIcon from "@mui/icons-material/Remove";

const COLORS = {
    up: '#d32f2f',   // MUI error.main
    down: '#0288d1', // MUI info.main
};

export const TREND_COLORS = {up: COLORS.up, down: COLORS.down, neutral: 'inherit'};

export type Trend = 'up' | 'down' | 'neutral';

export function getTrend(changeRate: string | null | undefined): Trend {
    if (!changeRate) return 'neutral';
    if (changeRate.startsWith('+')) return 'up';
    if (changeRate.startsWith('-')) return 'down';
    return 'neutral';
}

export function TrendIcon({trend}: {trend: Trend}) {
    if (trend === 'up') return <ArrowDropUpIcon sx={{color: TREND_COLORS.up, fontSize: 20}}/>;
    if (trend === 'down') return <ArrowDropDownIcon sx={{color: TREND_COLORS.down, fontSize: 20}}/>;
    return <RemoveIcon sx={{color: 'text.disabled', fontSize: 14}}/>;
}

export function renderTradeColor(trade: number, currency: 'KRW' | 'USD' = 'KRW') {
    const sign = trade > 0 ? '+' : trade < 0 ? '-' : '';
    const text = currency === 'USD'
        ? `$${Math.abs(trade).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
        : Math.abs(trade).toLocaleString();

    return (
        <span style={{color: trade == 0 ? '' : trade > 0 ? COLORS.up : COLORS.down}}>
            {`${sign}${text}`}
        </span>
    )
}

export function renderTradePricaColor(trade: string) {
    const value = Number(trade.slice(0, -1)) / 10;
    const formatted = value.toLocaleString('ko-KR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });

    return (
        <span style={{color: value == 0 ? '' : value > 0 ? COLORS.up : COLORS.down}}>
            {value > 0 ? `+${formatted}억` : `${formatted}억`}
        </span>
    )
}

/**
 * 등락률 표기용 부호 정규화.
 *
 * 키움 flu_rt 는 "+3.51" 처럼 부호가 붙어 오지만, 서버가 계산한 prftRt 나
 * 미국·코인의 changeRate 는 "3.51" 로 부호가 없다. 하락은 숫자 자체에 - 가 있어 보이므로
 * 상승에도 + 를 붙여 좌우 표기를 맞춘다.
 */
export function signedRate(value: number | string | null | undefined): string {
    if (value === null || value === undefined || isNaN(Number(value))) return '-';

    const text = String(value);
    return `${Number(value) > 0 && !text.startsWith('+') ? `+${text}` : text}%`;
}

export function renderChip (status: number | string) {
    if (status === null || status === undefined || isNaN(Number(status))) {
        return <Chip label="-" color="default" />;
    }

    const value = Number(status);
    const colors = value === 0 ? 'default' : value > 0 ? 'error' : 'info';

    return <Chip label={signedRate(status)} color={colors} />;
}

export function renderChangeAmount(value: string | number, unit: string = '원') {
    const num = typeof value === 'string' ? Number(value) : value;
    const isUsd = unit === '달러';

    if (isNaN(num) || num === 0) {
        return <span style={{ fontSize: '0.85em' }}>{isUsd ? '$0.00' : `0${unit}`}</span>;
    }

    const formatted = isUsd
        ? Math.abs(num).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})
        : Math.abs(num).toLocaleString();
    const color = num > 0 ? COLORS.up : COLORS.down;
    const sign = num > 0 ? '+' : '-';

    return (
        <span style={{ color, fontSize: '0.85em' }}>
            {isUsd ? `${sign}$${formatted}` : `${sign}${formatted}${unit}`}
        </span>
    );
}