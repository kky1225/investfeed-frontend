import Chip from "@mui/material/Chip";

const COLORS = {
    up: '#d32f2f',   // MUI error.main
    down: '#0288d1', // MUI info.main
};

export function renderTradeColor(trade: number) {
    const text = trade.toLocaleString()

    return (
        <span style={{color: trade == 0 ? '' : trade > 0 ? COLORS.up : COLORS.down}}>
            {trade > 0 ? `+${text}` : `${text}`}
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

export function renderChip (status: number) {
    const colors = status == 0 ? 'default' : status > 0 ? 'error': 'info';

    return <Chip label={`${status}%`} color={colors} />;
}

export function renderChangeAmount(value: string | number, unit: string = '원') {
    const num = typeof value === 'string' ? Number(value) : value;
    if (isNaN(num) || num === 0) return <span style={{ fontSize: '0.85em' }}>{`0${unit}`}</span>;

    const formatted = Math.abs(num).toLocaleString();
    const color = num > 0 ? COLORS.up : COLORS.down;
    const sign = num > 0 ? '+' : '-';

    return (
        <span style={{ color, fontSize: '0.85em' }}>
            {`${sign}${formatted}${unit}`}
        </span>
    );
}